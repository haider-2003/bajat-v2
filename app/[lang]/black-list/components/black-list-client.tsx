"use client"

import * as React from "react"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useTable,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table"
import {
  AlertCircle,
  CalendarDays,
  LayoutGrid,
  Phone,
  Rows3,
  Search,
} from "lucide-react"

import {
  AppliedFilters,
  DateRangeEditor,
  describeRange,
  type FilterDefinition,
  FilterMenu,
  TextEditor,
  TextFilter,
} from "@/components/filters"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import {
  TableRecordSheet,
  useRecordSheet,
} from "@/components/table/record-sheet"
import { TableView } from "@/components/table/table-view"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useGetBlackLists } from "@/features/black-list/api"
import type { BlackList } from "@/features/black-list/types"
import { useT } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/translate"
import { useDebounce } from "@/hooks/use-debounce"
import { useListQuery } from "@/hooks/use-list-query"
import { useStickyState } from "@/hooks/use-sticky-state"
import { features } from "@/lib/table-features"
import { cn } from "@/lib/utils"
import { buildFilter } from "@/utils/api/filters"
import { readPageInfo } from "@/utils/api/pagination"
import { DEFAULT_PAGE_SIZE } from "@/utils/constants"
import { toInstantRange } from "@/utils/date"
import { phoneDigits } from "@/utils/format"

import { createColumns } from "./columns"
import { RemoveEntryButton } from "./entry-actions"
import { RemoveEntryDialog } from "./remove-entry-dialog"
import { CardView } from "./view-cards"

/**
 * Black List — view switcher + toolbar.
 *
 * The same architecture as the other list screens: server-driven rows, filters
 * as top-level query params, `useListQuery` owning the page, `keepPreviousData`
 * so paging doesn't blink. See docs/filtering-sorting-pagination.md.
 *
 * Rows come from `GET /blacklist`, **paged and filtered by the server**
 * (docs/api-types.md § black-list).
 *
 * ### Two views, not three
 *
 * There is no board. A board groups by a status, and a black list entry has
 * none — it exists, or it has been removed. A board here would be one column
 * called "Blocked", which is a table with worse density.
 *
 * ### What this screen deliberately does not filter on
 *
 * `/blacklist` reads five parameters: `search`, `name`, `phone`,
 * `created_at_range[]` and `updated_at_range[]`. Three of them are wired up
 * here, and the two that are not were left out on purpose:
 *
 *  - **`name`** is what `search` already covers. A second box that searches one
 *    column of two is a control whose only observable effect is being narrower
 *    than the one beside it.
 *  - **`updated_at_range`** filters on a field that never changes: there is no
 *    `PUT /blacklist/{id}`, so `updatedAt` tracks `createdAt` for every row and
 *    the window would duplicate "Blocked on" exactly.
 *
 * There is no organization filter either, and that one is an absence rather
 * than a choice: the endpoint does not read `organization_id`. Adding the
 * control anyway is §6's silent failure — a field name the backend does not
 * know still becomes a real query parameter, raises no error anywhere, and
 * leaves the table quietly unfiltered.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * The page-header count. Deliberately the **unfiltered** total, and pinned to
 * the default query so it shares the table's first cache entry instead of
 * firing a second request: a page title should say how much exists, not how
 * much survived the current filter — the pagination bar covers that.
 */
const COUNT_QUERY = { page: 1, pageSize: DEFAULT_PAGE_SIZE } as const

export function BlackListCount() {
  const query = useGetBlackLists(COUNT_QUERY)
  const total = readPageInfo(query.data?.data).total

  if (query.isPending) return <span className="text-text-placeholder">—</span>
  return <>{total ?? query.data?.data.data?.length ?? 0}</>
}

type ViewMode = "table" | "cards"

const VIEWS: {
  id: ViewMode
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** Table needs width; below lg it is replaced by cards. */
  desktopOnly?: boolean
}[] = [
  { id: "table", labelKey: "views.table", icon: Rows3, desktopOnly: true },
  { id: "cards", labelKey: "views.cards", icon: LayoutGrid },
]

const STORAGE_KEY = "bajat-black-list-view"

/**
 * Filters, sort, page and page size, remembered for the tab — so opening a
 * row and coming back lands on the list you left. See hooks/use-sticky-state.ts.
 */
const LIST_KEY = "bajat-black-list"

export function BlackListClient() {
  const t = useT()
  // Lazy initialiser rather than an effect: the saved view is read once, and
  // reading it during the first render avoids a flash of the default layout.
  // Guarded for SSR, where `localStorage` does not exist.
  const [view, setView] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table"
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
      if (saved && VIEWS.some((v) => v.id === saved)) return saved
    } catch {
      // Ignore; the default view is fine.
    }
    return "table"
  })
  const [isDesktop, setIsDesktop] = React.useState(true)
  const [sorting, setSorting] = useStickyState<SortingState>(
    `${LIST_KEY}:sorting`,
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})

  // Server-driven: every one of these goes out as a query param, so changing
  // any of them refetches rather than re-filtering what is already on screen.

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce.
  const [query, setQuery] = useStickyState(`${LIST_KEY}:query`, "")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [phoneQuery, setPhoneQuery] = useStickyState(
    `${LIST_KEY}:phoneQuery`,
    ""
  )
  const phone = useDebounce(phoneDigits(phoneQuery), SEARCH_DEBOUNCE_MS)

  // The window the entry was blocked in, held as two `yyyy-mm-dd` days — what
  // the calendar selects, with no timezone attached. They become instants only
  // on the way out.
  const [blockedFrom, setBlockedFrom] = useStickyState(
    `${LIST_KEY}:blockedFrom`,
    ""
  )
  const [blockedTo, setBlockedTo] = useStickyState(`${LIST_KEY}:blockedTo`, "")

  /** The entry queued for removal, held as a row rather than an id — see below. */
  const [removing, setRemoving] = React.useState<BlackList | null>(null)

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<BlackList>()


  // Track the lg breakpoint so the table can fall back to cards (§8.12).
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const chooseView = (next: ViewMode) => {
    setView(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference simply won't persist.
    }
  }

  /**
   * Everything this screen filters on, keyed by the field name it is sent as.
   *
   * `search`, `phone` and `createdAtRange` — the last carrying the `[start,
   * end]` pair `toInstantRange` builds, where **position is the contract**: the
   * backend reads element 0 as the start and element 1 as the end.
   *
   * `phone` is the digits only. The stored number is bare — `"9647701234567"` —
   * so a filter forwarding `+964 770 123 4567` verbatim would match nothing,
   * and would do it silently.
   */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        phone,
        createdAtRange: toInstantRange(blockedFrom, blockedTo),
      }),
    [search, phone, blockedFrom, blockedTo]
  )

  // Page state lives with the filters: `useListQuery` derives page 1 whenever
  // the filter set or the page size changes, so no control here has to
  // remember to reset it.
  const {
    query: listQuery,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useListQuery(filter, {
    pageSize: DEFAULT_PAGE_SIZE,
    storageKey: LIST_KEY,
  })

  // `useGetList` hands back the whole Axios response, so rows sit two `data`
  // levels down. `keepPreviousData` is what makes paging work at all: every
  // page is a new query key, so without it `data` would be undefined for the
  // whole trip and the row count, the total and the page range would all blink
  // to zero between pages.
  const entriesQuery = useGetBlackLists(listQuery, {
    placeholderData: keepPreviousData,
  })
  const data = React.useMemo(
    () => entriesQuery.data?.data.data ?? [],
    [entriesQuery.data]
  )

  /**
   * The entry in the confirmation, re-read from the current rows.
   *
   * Held as a snapshot *and* refreshed from the list. Deriving it purely from
   * the rows would slam the dialog shut the moment a background refetch moved
   * that row off the page; keeping only the snapshot would show stale details
   * for a row that has since changed hands. The snapshot is the fallback, so
   * the dialog survives its row disappearing mid-confirmation.
   */
  const removingEntry = React.useMemo(() => {
    if (!removing) return null
    return data.find((entry) => entry.id === removing.id) ?? removing
  }, [data, removing])

  // `meta.total` is the documented contract, but not every endpoint sends a
  // `meta` block — `readPageInfo` also looks at the body root, where a bare
  // Laravel paginator puts `total` / `last_page` / `per_page`. A missing total
  // means "unknown", never "zero": zero would disable Next forever and print
  // an empty state over a table that plainly has rows.
  const pageInfo = React.useMemo(
    () => readPageInfo(entriesQuery.data?.data),
    [entriesQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  /**
   * The only way `page` changes. Clamping in the handler rather than during
   * render: setting state while rendering re-runs the component immediately,
   * so any moment the total read low — a not-yet-loaded page, a placeholder, a
   * failed fetch — the clamp would fight the click and snap back to page 1.
   */
  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  // Keyed on `t` as well as the handler: the headers and the View menu's
  // column names are translated, so the list is language-dependent.
  const columns = React.useMemo(() => createColumns(t, setRemoving), [t])

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (r) => String(r.id),
  })

  const hasRows = data.length > 0

  const effectiveView: ViewMode = view === "table" && !isDesktop ? "cards" : view

  const pagination = (
    <Pagination
      page={page}
      pageSize={pageSize}
      rowCount={data.length}
      total={total}
      lastPage={lastPage}
      perPage={perPage}
      onPageChange={goToPage}
      // No `setPage(1)` alongside it: row 30 of 25-per-page is not row 30 of
      // 100-per-page, and `useListQuery` already treats the size as part of
      // what the page number is valid for.
      onPageSizeChange={setPageSize}
      // Deliberately not disabled while fetching: with the previous page still
      // on screen the controls stay meaningful.
      busy={entriesQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  /**
   * The filters that live behind the sheet below `lg` — everything except
   * search, which stays on the toolbar at every width because it is the one
   * people reach for first (§6.7).
   */
  const clearFilters = () => {
    setQuery("")
    setPhoneQuery("")
    setBlockedFrom("")
    setBlockedTo("")
  }

  /** Whether the server was asked for anything narrower than "everything". */
  const filtered = filter.length > 0

  /**
   * Every filter this screen offers, described once: the Filter menu lists
   * them, the chip row shows the set ones, and both open the same editor
   * (components/filters/filter-builder.tsx). Chip text is the *typed* value —
   * the chip is the editor's own label, so it moves with the keystroke.
   */
  const filters: FilterDefinition[] = [
    {
      // Phone is its own field rather than part of search, and it is the one
      // that matters most on this screen: checking whether a specific number
      // is barred is the question this list gets asked. Punctuation-tolerant,
      // because the stored number is bare digits.
      key: "phone",
      label: t("filters.attributes.phone"),
      icon: Phone,
      value: phoneQuery.trim() || undefined,
      editor: (
        <TextEditor
          type="tel"
          inputMode="tel"
          value={phoneQuery}
          onChange={setPhoneQuery}
          placeholder={t("members.phonePlaceholder")}
          label={t("members.phoneFilterLabel")}
        />
      ),
      onClear: () => setPhoneQuery(""),
    },
    {
      // Either end alone is a question somebody asks of this list: "blocked
      // since Monday" is the recent additions, "blocked before January" is
      // what has been sitting here long enough to be worth reviewing.
      key: "blocked",
      label: t("filters.attributes.blocked"),
      icon: CalendarDays,
      value: describeRange(t, blockedFrom, blockedTo) || undefined,
      editor: (
        <DateRangeEditor
          from={blockedFrom}
          to={blockedTo}
          onFromChange={setBlockedFrom}
          onToChange={setBlockedTo}
        />
      ),
      onClear: () => {
        setBlockedFrom("")
        setBlockedTo("")
      },
    },
  ]

  /**
   * An empty black list is the normal state for a new organization, which is
   * not true of any other list in this app — so "no rows" needs two readings
   * here, and the default "try clearing a filter" is wrong for one of them.
   */
  const emptyTitle = filtered
    ? t("blackList.emptyFiltered")
    : t("blackList.emptyTitle")
  const emptyHint = filtered ? undefined : t("blackList.emptyHint")

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar — left group is the view switcher, right group the controls
          (§6.1). Below `lg` that single row becomes two: the switcher and the
          Filter button, then search across the full width, per §18.3. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex items-center justify-between gap-2">
          {/* View switcher — active tab is a surface chip (§6.5) */}
          <div
            className="flex items-center gap-0.5"
            role="tablist"
            aria-label={t("views.layout")}
          >
            {VIEWS.map((v) => {
              const Icon = v.icon
              const active = effectiveView === v.id
              const unavailable = v.desktopOnly && !isDesktop
              return (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={active}
                  disabled={unavailable}
                  title={unavailable ? t("views.tableNeedsWidth") : undefined}
                  onClick={() => chooseView(v.id)}
                  className={cn(
                    // §18.7 — 44px for touch, the §6.5 32px tab at lg.
                    "inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium lg:h-8",
                    "transition-colors duration-120 outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    unavailable && "cursor-not-allowed text-text-placeholder",
                    !unavailable && active
                      ? "bg-surface text-text shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-border dark:bg-[rgba(255,255,255,0.08)] dark:shadow-none dark:ring-0"
                      : !unavailable &&
                          "text-text-secondary hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.045)]"
                  )}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  <span className="hidden sm:inline">{t(v.labelKey)}</span>
                </button>
              )
            })}
          </div>
          {/* Below `lg` the Filter button sits beside the switcher; at
              `lg` it moves onto the search row. One button either way —
              the popover is the same at every width, so no sheet. */}
          <FilterMenu filters={filters} className="lg:hidden" />
        </div>

        {/* Search stays on the bar at every width — it is the control people
            reach for first (§6.7). Below `lg` it owns its own full-width row. */}
        <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto">
          {/* Nothing here resets the page — `useListQuery` derives that from
              the filter set changing. */}
          <TextFilter
            icon={Search}
            value={query}
            onChange={setQuery}
            placeholder={t("blackList.searchPlaceholder")}
            label={t("blackList.searchLabel")}
            className="w-full lg:w-56"
          />

          <div className="hidden items-center gap-2 lg:flex">
            <FilterMenu filters={filters} />

            {/* View — column visibility + reordering (table only) */}
            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <AppliedFilters filters={filters} onClear={clearFilters} />

      {/* A failure only takes over the screen when there is nothing to show.
          Once rows are on screen — paging away from a page that loaded — an
          error becomes a strip above them, so the table and its pager stay put
          instead of vanishing and looking like the click did nothing. */}
      {entriesQuery.isError && hasRows && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-md border border-border bg-danger-bg px-4 py-2.5"
        >
          <AlertCircle className="size-4 shrink-0 text-danger" strokeWidth={1.5} />
          <p className="text-[13px] text-danger">
            {t("table.loadPageFailed", { page })}
          </p>
          <button
            type="button"
            onClick={() => entriesQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {entriesQuery.isPending ? (
        <LoadingRows />
      ) : entriesQuery.isError && !hasRows ? (
        /* A black list that fails to load must not read as an empty one: the
           difference between "nobody is blocked" and "we could not find out"
           is the difference between issuing a card and refusing it. */
        <LoadFailed
          title={t("blackList.loadFailed")}
          onRetry={() => entriesQuery.refetch()}
          retrying={entriesQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              onRowClick={shown.show}
              rowLabel={(entry) => entry.name}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
              footer={pagination}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
                onRemove={setRemoving}
                emptyTitle={emptyTitle}
                emptyHint={emptyHint}
              />

              {/* Cards have no container of their own, so the bar gets one —
                  minus the top border it would double up on. */}
              <div className="overflow-hidden rounded-xl border border-border">
                {pagination}
              </div>
            </>
          )}
        </>
      )}

      <TableRecordSheet
        table={table}
        row={shown.row}
        onOpenChange={shown.onOpenChange}
        title={shown.row?.name}
        subtitle={shown.row?.organization?.name}
        footer={
          shown.row && (
            <RemoveEntryButton
              entry={shown.row}
              onRemove={shown.closeThen(setRemoving)}
            />
          )
        }
      />

      {/* Mounted once, not once per row: thirty rows each holding a `Dialog` is
          thirty portals waiting to be opened. */}
      <RemoveEntryDialog
        entry={removingEntry}
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      />
    </div>
  )
}
