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
  KanbanSquare,
  LayoutGrid,
  ListFilter,
  Phone,
  Rows3,
  Search,
} from "lucide-react"

import {
  FacetFilter,
  FilterChips,
  FilterSheet,
  SHEET_CONTROL,
  TextFilter,
  toggleKey,
  type ActiveFilter,
} from "@/components/filters"
import { DatePicker, formatDateValue } from "@/components/ui/date-picker"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useGetMembersRequests } from "@/features/members-requests/api"
import { STATUS_META } from "@/features/members-requests/status"
import type { MemberRequest } from "@/features/members-requests/types"
import { useGetOrganizations } from "@/features/organizations/api"
import { useLocale, useT } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/translate"
import { useDebounce } from "@/hooks/use-debounce"
import { useListQuery } from "@/hooks/use-list-query"
import { buildFilter } from "@/utils/api/filters"
import { readPageInfo } from "@/utils/api/pagination"
import { toInstant } from "@/utils/date"
import { formatText, phoneDigits } from "@/utils/format"
import { DEFAULT_PAGE_SIZE } from "@/utils/constants"
import { cn } from "@/lib/utils"

import { buildColumns } from "./columns"
import { features } from "@/lib/table-features"
import { BoardView } from "./view-board"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import {
  TableRecordSheet,
  useRecordSheet,
} from "@/components/table/record-sheet"
import { TableView } from "@/components/table/table-view"
import { CardView } from "./view-cards"

/**
 * Members Requests — view switcher + toolbar.
 *
 * Layout choice is the user's (table / board / cards) and persists per
 * browser. Below `lg` the table is unavailable and the choice falls back to
 * cards, per DESIGN.md §8.12.
 *
 * Rows come from `GET /member_request`, **paged and filtered by the server**.
 * Search and the status facet travel as query params (`?search=`, `?status=`),
 * per the `filter` contract every list endpoint shares — see
 * docs/api-types.md § standard query parameters. Doing it client-side would
 * only ever filter the page in front of you, which is the wrong answer.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * The page-header count. Deliberately the **unfiltered** total, and pinned to
 * the default query so it shares the table's first cache entry instead of
 * firing a second request: a page title should say how much work exists, not
 * how much survived the current filter — the pagination bar covers that.
 */
const COUNT_QUERY = { page: 1, pageSize: DEFAULT_PAGE_SIZE } as const

/**
 * The organization facet's source list. Module-level and frozen so it is one
 * stable cache key rather than a new object every render.
 */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const


export function RequestsCount() {
  const query = useGetMembersRequests(COUNT_QUERY)
  const total = readPageInfo(query.data?.data).total

  if (query.isPending) return <span className="text-text-placeholder">—</span>
  return <>{total ?? query.data?.data.data?.length ?? 0}</>
}

type ViewMode = "table" | "board" | "cards"

const VIEWS: {
  id: ViewMode
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** Table needs width; below lg it is replaced by cards. */
  desktopOnly?: boolean
}[] = [
  { id: "table", labelKey: "views.table", icon: Rows3, desktopOnly: true },
  { id: "board", labelKey: "views.board", icon: KanbanSquare },
  { id: "cards", labelKey: "views.cards", icon: LayoutGrid },
]

const STORAGE_KEY = "bajat-requests-view"

export function RequestsClient() {
  const t = useT()
  const locale = useLocale()

  /**
   * The status facet's options, in the order §8.4 groups them.
   *
   * Built here rather than at module scope: the labels are translated, and a
   * module constant is evaluated once per process — it would pin the facet to
   * whichever language rendered first.
   */
  const STATUS_OPTIONS = React.useMemo(
    () =>
      Object.entries(STATUS_META).map(([key, meta]) => ({
        key,
        label: t(meta.labelKey),
      })),
    [t]
  )

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
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(
    {}
  )

  // Server-driven: every one of these goes out as a query param, so changing
  // any of them refetches rather than re-filtering what is already on screen.
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])
  /**
   * Organization ids, as strings. Empty means every organization.
   *
   * Plural because the endpoint is: it reads `organization_ids[]`, so this
   * filters to several at once and a single id under the singular name is a
   * parameter the backend ignores.
   */
  const [organizationIds, setOrganizationIds] = React.useState<string[]>([])
  // The created-at day, held as `yyyy-mm-dd` — what the calendar selects, with
  // no timezone attached. It becomes an instant only on the way out.
  const [createdAt, setCreatedAt] = React.useState("")

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce, so typing doesn't fire a
  // request per keystroke.
  const [query, setQuery] = React.useState("")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [phoneQuery, setPhoneQuery] = React.useState("")
  const phone = useDebounce(phoneDigits(phoneQuery), SEARCH_DEBOUNCE_MS)

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

  // Organizations for the facet below. One page of 100 is the whole list in
  // practice, and it is cached across every screen that needs it.
  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY)
  const organizations = React.useMemo(
    () => organizationsQuery.data?.data.data ?? [],
    [organizationsQuery.data]
  )

  /**
   * Everything this screen filters on, keyed by the field name it is sent as.
   *
   * `buildFilter` drops the empty ones and sorts the rest, so the clause array
   * — and therefore the React Query key — depends only on *which* filters are
   * set, not on the order they were written or applied.
   *
   * Each key is spread as one top-level param, decamelized by the request
   * interceptor. The wire names are the backend's, and they are not always the
   * field they filter: the status facet sends **`statuses`** as an array even
   * for a single tick, the organization facet sends **`organization_ids[]`**
   * the same way, and the date sends **`created_at_range[]`** carrying one ISO
   * instant. See docs/filtering-sorting-pagination.md §6.
   */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        phone,
        statuses: statusFilter,
        organizationIds,
        createdAtRange: createdAt ? [toInstant(createdAt)] : undefined,
      }),
    [search, phone, statusFilter, organizationIds, createdAt]
  )

  // Page state lives with the filters: `useListQuery` derives page 1 whenever
  // the filter set or the page size changes, so no control here has to
  // remember to reset it.
  const { query: listQuery, page, pageSize, setPage, setPageSize } =
    useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE })

  // `useGetList` hands back the whole Axios response, so rows sit two `data`
  // levels down. Falls back to an empty list while loading or after an error.
  //
  // `keepPreviousData` is what makes paging work at all: every page is a new
  // query key, so without it `data` would be undefined for the whole trip and
  // the row count, the total and the page range would all blink to zero
  // between pages. It also keeps the skeleton from flashing on every click.
  const requestsQuery = useGetMembersRequests(listQuery, {
    placeholderData: keepPreviousData,
  })
  const data = React.useMemo(
    () => requestsQuery.data?.data.data ?? [],
    [requestsQuery.data]
  )

  // `meta.total` is the documented contract, but this endpoint does not always
  // send a `meta` block — `readPageInfo` also looks at the body root, where a
  // bare Laravel paginator puts `total` / `last_page` / `per_page`. That gap is
  // what killed Next: rows arrived, the total didn't, and with no total the bar
  // fell back to "is this page exactly `pageSize` rows?" — which is false the
  // moment the server pages by a size of its own.
  //
  // A still-missing total means "unknown", never "zero": zero would disable
  // Next forever and print "No requests" over a table that plainly has some.
  const pageInfo = React.useMemo(
    () => readPageInfo(requestsQuery.data?.data),
    [requestsQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  /**
   * The only way `page` changes.
   *
   * This used to be a `setPage` in the render body, clamping against the total.
   * Setting state during render re-runs the component immediately, so any
   * moment the total read low — a not-yet-loaded page, a placeholder, a failed
   * fetch — the clamp fought the click and snapped straight back to page 1.
   * Clamping in the handler cannot do that: it runs once, on a real click.
   *
   * Nothing else needs the old behaviour, because every control that can
   * shrink the result set already resets to page 1 explicitly.
   */
  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  // Rebuilt only when the language changes — see the note in ./columns.tsx.
  const columns = React.useMemo(() => buildColumns(t), [t])

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<MemberRequest>()

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (r) => String(r.id),
  })

  const hasRows = data.length > 0

  const effectiveView: ViewMode =
    view === "table" && !isDesktop ? "cards" : view

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
      // on screen the controls stay meaningful, and disabling them mid-click
      // is what made Next feel dead.
      busy={requestsQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  /** `{ key, label }` is the shape `FacetFilter` ticks through. */
  const organizationOptions = React.useMemo(
    () => organizations.map((o) => ({ key: String(o.id), label: o.name })),
    [organizations]
  )

  /**
   * The filters that live behind the sheet below `lg` — everything except
   * search, which stays on the toolbar at every width because it is the one
   * people reach for first (§6.7).
   */
  const clearSheetFilters = () => {
    setStatusFilter([])
    setOrganizationIds([])
    setCreatedAt("")
    setPhoneQuery("")
  }

  /**
   * The badge on the collapsed trigger.
   *
   * Counts the *typed* phone rather than the debounced one: this is feedback
   * on the control you are holding, not a claim about what the server has been
   * asked for — that is the chip row's job.
   */
  const sheetFilterCount =
    statusFilter.length +
    organizationIds.length +
    (createdAt ? 1 : 0) +
    (phoneQuery.trim() ? 1 : 0)

  const clearFilters = () => {
    clearSheetFilters()
    setQuery("")
  }

  /**
   * The four controls that collapse into the sheet below `lg`.
   *
   * One definition rendered into two layouts rather than two copies: the only
   * difference between them is how wide each trigger is, so that is the only
   * thing the argument decides. Inside the sheet they become a single
   * full-width stack — which is also why `FilterButton` no longer hides its
   * label on narrow screens, since here the label is all there is to read.
   */
  const collapsibleFilters = (inSheet: boolean) => (
    <>
      {/* Phone is its own field rather than part of search: it matches one
          column, and the input is punctuation-tolerant because the stored
          number is bare digits. */}
      <TextFilter
        icon={Phone}
        type="tel"
        inputMode="tel"
        value={phoneQuery}
        onChange={setPhoneQuery}
        placeholder={t("members.phonePlaceholder")}
        label={t("members.phoneFilterLabel")}
        className={inSheet ? "w-full" : "w-44"}
      />

      <FacetFilter
        label={t("common.status")}
        icon={ListFilter}
        options={STATUS_OPTIONS}
        selected={statusFilter}
        onToggle={(key) => setStatusFilter((current) => toggleKey(current, key))}
        className={inSheet ? SHEET_CONTROL : undefined}
      />

      <FacetFilter
        label={t("filters.attributes.organization")}
        icon={Building2}
        options={organizationOptions}
        selected={organizationIds}
        onToggle={(key) =>
          setOrganizationIds((current) => toggleKey(current, key))
        }
        emptyLabel={t("members.noOrganizations")}
        loading={organizationsQuery.isPending}
        className={inSheet ? SHEET_CONTROL : undefined}
      />

      <DatePicker
        label={t("filters.attributes.created")}
        value={createdAt}
        onChange={setCreatedAt}
        className={inSheet ? SHEET_CONTROL : undefined}
      />
    </>
  )

  /**
   * The applied-filter row. One entry per *applied* filter — the debounced
   * values, not the raw inputs, so a chip never claims a filter the server has
   * not been asked for yet.
   */
  const activeFilters: ActiveFilter[] = [
    ...statusFilter.map((key) => ({
      key: `status-${key}`,
      attribute: t("common.status"),
      value: t(STATUS_META[key as keyof typeof STATUS_META].labelKey),
      onRemove: () => setStatusFilter((current) => toggleKey(current, key)),
    })),
    // One chip per ticked organization, so each can be removed on its own —
    // a single "Organization (2)" chip can only ever clear both.
    ...organizationIds.map((id) => ({
      key: `organization-${id}`,
      attribute: t("filters.attributes.organization"),
      value: organizationOptions.find((o) => o.key === id)?.label ?? id,
      onRemove: () => setOrganizationIds((current) => toggleKey(current, id)),
    })),
    ...(createdAt
      ? [
          {
            key: "created",
            attribute: t("filters.attributes.created"),
            value: formatDateValue(createdAt, locale),
            onRemove: () => setCreatedAt(""),
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: "search",
            attribute: t("filters.attributes.search"),
            value: search,
            onRemove: () => setQuery(""),
          },
        ]
      : []),
    ...(phone
      ? [
          {
            key: "phone",
            attribute: t("filters.attributes.phone"),
            value: phone,
            onRemove: () => setPhoneQuery(""),
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar — left group is the view switcher, right group the controls
          (§6.1). They are pushed apart with a gutter between.

          Below `lg` that single row becomes two: the switcher and one Filters
          button, then search across the full width. §18.3 collapses the
          toolbar's controls into a sheet at that width rather than letting
          five controls of five different widths wrap into a ragged stack. */}
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

          {/* The collapsed toolbar. Holds the same control components the
              desktop cluster does — passed in, not duplicated — so a filter
              can never exist in one layout and be missing from the other. */}
          <FilterSheet
            className="lg:hidden"
            count={sheetFilterCount}
            onClear={clearSheetFilters}
          >
            {collapsibleFilters(true)}
          </FilterSheet>
        </div>

        {/* Search stays on the bar at every width — it is the control people
            reach for first (§6.7). Below `lg` it owns its own full-width row,
            which is the only way it is legible at 375px. */}
        <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto">
          {/* Nothing here resets the page — `useListQuery` derives that from
              the filter set changing. */}
          <TextFilter
            icon={Search}
            value={query}
            onChange={setQuery}
            placeholder={t("requests.searchPlaceholder")}
            label={t("requests.searchPlaceholder")}
            className="w-full lg:w-56"
          />

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {collapsibleFilters(false)}

            {/* View — column visibility + reordering (table only) */}
            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <FilterChips filters={activeFilters} onClear={clearFilters} />

      {/* A failure only takes over the screen when there is nothing to show.
          Once rows are on screen — paging away from a page that loaded — an
          error becomes a strip above them, so the table and its pager stay put
          instead of vanishing and looking like the click did nothing. */}
      {requestsQuery.isError && hasRows && (
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
            onClick={() => requestsQuery.refetch()}
            className="ms-auto text-[13px] font-medium text-danger underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {requestsQuery.isPending ? (
        <LoadingRows />
      ) : requestsQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("requests.loadFailed")}
          onRetry={() => requestsQuery.refetch()}
          retrying={requestsQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              onRowClick={shown.show}
              rowLabel={(request) => formatText(request.name)}
              emptyTitle={t("requests.emptyTitle")}
              footer={pagination}
            />
          )}

          {effectiveView !== "table" && (
            <>
              {effectiveView === "board" && <BoardView table={table} />}
              {effectiveView === "cards" && <CardView table={table} />}

              {/* Board and cards have no container of their own, so the bar
                  gets one — minus the top border it would double up on. */}
              <div className="overflow-hidden rounded-xl border border-border">
                {pagination}
              </div>
            </>
          )}
        </>
      )}

      {/* Mounted once, not once per row: thirty rows each holding a `Dialog`
          is thirty portals waiting to be opened. */}
      <TableRecordSheet
        table={table}
        row={shown.row}
        onOpenChange={shown.onOpenChange}
        title={formatText(shown.row?.name)}
        subtitle={formatText(shown.row?.phone)}
      />
    </div>
  )
}
