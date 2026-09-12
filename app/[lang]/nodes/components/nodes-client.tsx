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
  Building2,
  CalendarDays,
  LayoutGrid,
  Palette,
  Rows3,
  Search,
} from "lucide-react"

import {
  AppliedFilters,
  ChoiceEditor,
  DateRangeEditor,
  describeRange,
  type FilterDefinition,
  FilterMenu,
  TextEditor,
  TextFilter,
} from "@/components/filters"
import { EditNodeDialog } from "@/components/nodes/node-dialog"
import { NodeSwatch } from "@/components/nodes/node-swatch"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import {
  TableRecordSheet,
  useRecordSheet,
} from "@/components/table/record-sheet"
import { TableView } from "@/components/table/table-view"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useAuthStore } from "@/features/auth/store"
import { useGetNodes } from "@/features/nodes/api"
import type { Node } from "@/features/nodes/types"
import { useGetOrganizations } from "@/features/organizations/api"
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

import { createColumns, NodeActions } from "./columns"
import { DeleteNodeDialog } from "./delete-node-dialog"
import { CardView } from "./view-cards"

/**
 * Nodes — view switcher + toolbar.
 *
 * The same architecture as the other list screens: server-driven rows, filters
 * as top-level query params, `useListQuery` owning the page, `keepPreviousData`
 * so paging doesn't blink. See docs/filtering-sorting-pagination.md.
 *
 * Rows come from `GET /node`, **paged and filtered by the server**
 * (docs/CRUD-MIGRATION-REFERENCE.md §1.3).
 *
 * ### Two views, not three
 *
 * There is no board. A board groups by a status, and a node *is* the thing
 * other screens' boards group by — grouping nodes by node is one column per
 * row.
 *
 * ### What this screen deliberately does not filter on
 *
 * `/node` reads `search`, `name`, `color`, `organization`, `created_at_range[]`
 * and `updated_at_range[]`. Two are left out on purpose:
 *
 *  - **`name`** is what `search` already covers. A second box that searches one
 *    column of two is a control whose only observable effect is being narrower
 *    than the one beside it.
 *  - **`updated_at_range`** answers a question nobody asks of this list. A node
 *    is renamed or recoloured rarely, and "which steps were edited last week"
 *    is an audit question, not a workflow one — where "which steps exist, and
 *    since when" is the reason this screen is opened.
 *
 * ### The organization filter is admin-only, and so is the column
 *
 * An org-scoped token sees one organization, so both the control and the
 * column would repeat the same name down the page (§3.3).
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/** One page of 100 is the whole list in practice, and it is cached app-wide. */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

/**
 * The page-header count. Deliberately the **unfiltered** total, and pinned to
 * the default query so it shares the table's first cache entry instead of
 * firing a second request: a page title should say how much exists, not how
 * much survived the current filter — the pagination bar covers that.
 */
const COUNT_QUERY = { page: 1, pageSize: DEFAULT_PAGE_SIZE } as const

export function NodesCount() {
  const query = useGetNodes(COUNT_QUERY)
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

const STORAGE_KEY = "bajat-nodes-view"

/**
 * Filters, sort, page and page size, remembered for the tab — so opening a
 * row and coming back lands on the list you left. See hooks/use-sticky-state.ts.
 */
const LIST_KEY = "bajat-nodes"

export function NodesClient() {
  const t = useT()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.type === "admin"

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
    React.useState<ColumnVisibilityState>(() =>
      // Hidden rather than dropped from the column list, so it stays in the
      // View menu: an org-scoped account that later gains a second tenant can
      // bring the column back without a code change.
      isAdmin ? ({} as ColumnVisibilityState) : { organization: false }
    )

  // Server-driven: every one of these goes out as a query param, so changing
  // any of them refetches rather than re-filtering what is already on screen.

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce.
  const [query, setQuery] = useStickyState(`${LIST_KEY}:query`, "")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [colorQuery, setColorQuery] = useStickyState(
    `${LIST_KEY}:colorQuery`,
    ""
  )
  const color = useDebounce(colorQuery.trim(), SEARCH_DEBOUNCE_MS)

  /** The organization's *name* — `/node` filters by name here, not by id. */
  const [organization, setOrganization] = useStickyState(
    `${LIST_KEY}:organization`,
    ""
  )

  // The window the node was created in, held as two `yyyy-mm-dd` days — what
  // the calendar selects, with no timezone attached. They become instants only
  // on the way out.
  const [createdFrom, setCreatedFrom] = useStickyState(
    `${LIST_KEY}:createdFrom`,
    ""
  )
  const [createdTo, setCreatedTo] = useStickyState(`${LIST_KEY}:createdTo`, "")

  /** The row queued for each dialog, held as a row rather than an id. */
  const [editing, setEditing] = React.useState<Node | null>(null)
  const [deleting, setDeleting] = React.useState<Node | null>(null)

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<Node>()

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

  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY, {
    enabled: isAdmin,
  })
  const organizationOptions = React.useMemo(
    () =>
      (organizationsQuery.data?.data.data ?? []).map((o) => ({
        // `/node` reads `organization` as a **name**, not an id — see §3.2's
        // note that the modules disagree about this. Sending an id here is a
        // real query parameter that matches nothing, silently.
        value: o.name,
        label: o.name,
      })),
    [organizationsQuery.data]
  )

  /**
   * Everything this screen filters on, keyed by the field name it is sent as.
   *
   * `createdAtRange` carries the `[start, end]` pair `toInstantRange` builds,
   * where **position is the contract**: the backend reads element 0 as the
   * start and element 1 as the end.
   */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        color,
        organization,
        createdAtRange: toInstantRange(createdFrom, createdTo),
      }),
    [search, color, organization, createdFrom, createdTo]
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
  const nodesQuery = useGetNodes(listQuery, { placeholderData: keepPreviousData })
  const data = React.useMemo(
    () => nodesQuery.data?.data.data ?? [],
    [nodesQuery.data]
  )

  /**
   * The row each dialog is showing, re-read from the current rows.
   *
   * Held as a snapshot *and* refreshed from the list. Deriving it purely from
   * the rows would slam the dialog shut the moment a background refetch moved
   * that row off the page; keeping only the snapshot would show stale details
   * for a row that has since changed. The snapshot is the fallback, so the
   * dialog survives its row disappearing mid-edit.
   */
  const editingNode = React.useMemo(() => {
    if (!editing) return null
    return data.find((node) => node.id === editing.id) ?? editing
  }, [data, editing])

  const deletingNode = React.useMemo(() => {
    if (!deleting) return null
    return data.find((node) => node.id === deleting.id) ?? deleting
  }, [data, deleting])

  // `meta.total` is the documented contract, but not every endpoint sends a
  // `meta` block — `readPageInfo` also looks at the body root, where a bare
  // Laravel paginator puts `total` / `last_page` / `per_page`. A missing total
  // means "unknown", never "zero": zero would disable Next forever and print
  // an empty state over a table that plainly has rows.
  const pageInfo = React.useMemo(
    () => readPageInfo(nodesQuery.data?.data),
    [nodesQuery.data]
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

  // Keyed on `t` as well as the handlers: the headers and the View menu's
  // column names are translated, so the list is language-dependent.
  const columns = React.useMemo(
    () => createColumns(t, setEditing, setDeleting),
    [t]
  )

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
      busy={nodesQuery.isFetching}
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
    setColorQuery("")
    setOrganization("")
    setCreatedFrom("")
    setCreatedTo("")
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
      // Its own field rather than part of search, because it is looked up
      // exactly: the question is "is #2F9E44 already taken", and a hex
      // matched loosely against names would answer something else.
      key: "color",
      label: t("nodes.columns.color"),
      icon: Palette,
      value: colorQuery.trim() || undefined,
      editor: (
        <TextEditor
          value={colorQuery}
          onChange={setColorQuery}
          placeholder="#2F9E44"
          label={t("nodes.columns.color")}
        />
      ),
      onClear: () => setColorQuery(""),
    },
    ...(isAdmin
      ? [
          {
            key: "organization",
            label: t("filters.attributes.organization"),
            icon: Building2,
            value: organization || undefined,
            editor: (
              <ChoiceEditor
                options={organizationOptions}
                value={organization}
                onChange={setOrganization}
                loading={organizationsQuery.isPending}
              />
            ),
            onClear: () => setOrganization(""),
          },
        ]
      : []),
    // Either end alone is a question somebody asks of this list: "added
    // since Monday" is the recent steps, "added before January" is what has
    // been in the workflow long enough to be worth reviewing.
    {
      key: "created",
      label: t("filters.attributes.created"),
      icon: CalendarDays,
      value: describeRange(t, createdFrom, createdTo) || undefined,
      editor: (
        <DateRangeEditor
          from={createdFrom}
          to={createdTo}
          onFromChange={setCreatedFrom}
          onToChange={setCreatedTo}
        />
      ),
      onClear: () => {
        setCreatedFrom("")
        setCreatedTo("")
      },
    },
  ]

  /**
   * An organization with no nodes yet is the normal state of a new tenant, so
   * "no rows" needs two readings here and the default "try clearing a filter"
   * is wrong for one of them.
   */
  const emptyTitle = filtered ? t("nodes.emptyFiltered") : t("nodes.emptyTitle")
  const emptyHint = filtered ? undefined : t("nodes.emptyHint")

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
            placeholder={t("nodes.searchPlaceholder")}
            label={t("nodes.searchLabel")}
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
      {nodesQuery.isError && hasRows && (
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
            onClick={() => nodesQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {nodesQuery.isPending ? (
        <LoadingRows />
      ) : nodesQuery.isError && !hasRows ? (
        /* A workflow that fails to load must not read as one with no steps:
           "this organization has no review stages" and "we could not find out"
           are different answers, and only one of them means the board is
           correctly empty. */
        <LoadFailed
          title={t("nodes.loadFailed")}
          onRetry={() => nodesQuery.refetch()}
          retrying={nodesQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
              footer={pagination}
              onRowClick={shown.show}
              rowLabel={(node) => node.name}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
                onEdit={setEditing}
                onDelete={setDeleting}
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

      {/* Mounted once, not once per row: thirty rows each holding a `Dialog` is
          thirty portals waiting to be opened. */}
      <TableRecordSheet
        table={table}
        row={shown.row}
        onOpenChange={shown.onOpenChange}
        title={shown.row?.name}
        subtitle={shown.row?.organization?.name}
        media={<NodeSwatch color={shown.row?.color} className="size-3" />}
        footer={
          shown.row && (
            <NodeActions
              node={shown.row}
              onEdit={shown.closeThen(setEditing)}
              onDelete={shown.closeThen(setDeleting)}
            />
          )
        }
      />

      <EditNodeDialog
        node={editingNode}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteNodeDialog
        node={deletingNode}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
