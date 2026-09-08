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
  LayoutGrid,
  LayoutTemplate,
  Phone,
  Printer,
  Rows3,
  Search,
} from "lucide-react"

import {
  DateRangeFilter,
  describeRange,
  FacetFilter,
  FilterChips,
  FilterSheet,
  SelectFilter,
  SHEET_CONTROL,
  TextFilter,
  toggleKey,
  type ActiveFilter,
} from "@/components/filters"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import { TableView } from "@/components/table/table-view"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useGetIds } from "@/features/ids/api"
import {
  PRINT_QUEUE_IDS,
  PRINT_QUEUE_STATUSES,
  STATUS_META,
} from "@/features/ids/status"
import { statusId, type IDCard, type StatusName } from "@/features/ids/types"
import { useGetOrganizations } from "@/features/organizations/api"
import { useT } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/translate"
import { useDebounce } from "@/hooks/use-debounce"
import { useListQuery } from "@/hooks/use-list-query"
import { features } from "@/lib/table-features"
import { cn } from "@/lib/utils"
import { buildFilter } from "@/utils/api/filters"
import { readPageInfo } from "@/utils/api/pagination"
import { DEFAULT_PAGE_SIZE } from "@/utils/constants"
import { toInstantRange } from "@/utils/date"
import { phoneDigits } from "@/utils/format"

import { CardPreviewDialog } from "./card-preview-dialog"
import { createColumns } from "./columns"
import { CardView } from "./view-cards"

/**
 * Printer — the print queue.
 *
 * The same architecture as the other list screens: server-driven rows, filters
 * as top-level query params, `useListQuery` owning the page, `keepPreviousData`
 * so paging doesn't blink. See docs/filtering-sorting-pagination.md.
 *
 * ### The screen *is* a filter
 *
 * `GET /identity` returns every card in the system, at every stage. What makes
 * this the printer screen rather than the issuance screen is `statuses[]=4,5,6`
 * — waiting, printing, printed — pinned onto every request it makes. The status
 * facet narrows *within* those three; unticking everything falls back to all
 * three rather than to no filter at all, because a print queue showing rejected
 * applications is not an emptier queue, it is a different screen.
 *
 * Statuses travel as **numbers**: the API returns `"WAITING_TO_PRINT"` and
 * filters on `4` (docs/api-types.md § ids, trap 1). `statusId` is the only
 * place that mapping happens.
 *
 * ### Organization is singular here
 *
 * `/identity` filters on `organization_id` — **one** value — where `/member`
 * takes `organization_ids[]`. So this screen uses `SelectFilter` and the App
 * Users screen uses `FacetFilter`, and swapping either for the other produces a
 * real query parameter that the backend ignores without erroring
 * (docs/filtering-sorting-pagination.md §6). Every field name here is the one
 * the endpoint documents in docs/identities-api.postman_collection.json.
 *
 * ### Two views, and the gallery is not just the narrow fallback
 *
 * A queue is worked through by looking at the artwork, so the card view leads
 * with the rendered front face. It doubles as the sub-`lg` layout the way it
 * does everywhere else (§8.12).
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/** The three statuses as the facet's keys — the numbers the server filters on. */
const QUEUE_KEYS = PRINT_QUEUE_IDS.map(String)

/**
 * `{ key, labelKey }` — the facet's options, still keyed by the numeric id the
 * server filters on. The label is resolved inside the component; a module
 * constant is evaluated once per process and could only hold one language.
 */
const STATUS_OPTION_KEYS = PRINT_QUEUE_STATUSES.map((status: StatusName) => ({
  key: String(statusId(status)),
  labelKey: STATUS_META[status].labelKey,
}))

/**
 * The page-header count — the whole queue, not what survived the filters.
 *
 * Deliberately built to be *identical* to the query the table runs on arrival,
 * so React Query hashes it to the same key and the header shares the table's
 * first response instead of firing a second request.
 */
const COUNT_QUERY = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  filter: buildFilter({ statuses: QUEUE_KEYS }),
} as const

export function PrintQueueCount() {
  const query = useGetIds(COUNT_QUERY)
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

/**
 * The organization filter's source list. Module-level and frozen so it is one
 * stable cache key rather than a new object every render — and the same key the
 * other screens use, so all three share one cached response.
 */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

const STORAGE_KEY = "bajat-printer-view"

export function PrinterClient() {
  const t = useT()

  /** The facet's ticked options, labelled in the active language. */
  const statusOptions = React.useMemo(
    () =>
      STATUS_OPTION_KEYS.map((option) => ({
        key: option.key,
        label: t(option.labelKey),
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
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})

  // Server-driven: this goes out as a query param, so ticking a status
  // refetches rather than re-filtering what is already on screen.
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])
  /** One id, or `""` for every organization — the endpoint takes a single one. */
  const [organizationId, setOrganizationId] = React.useState("")

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce.
  const [query, setQuery] = React.useState("")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [phoneQuery, setPhoneQuery] = React.useState("")
  const memberPhone = useDebounce(phoneDigits(phoneQuery), SEARCH_DEBOUNCE_MS)

  const [templateQuery, setTemplateQuery] = React.useState("")
  const templateTitle = useDebounce(templateQuery.trim(), SEARCH_DEBOUNCE_MS)

  /**
   * The two date windows, each as a pair of `yyyy-mm-dd` values — `""` for an
   * open end. Neither is debounced: a date arrives in one click, not one
   * keystroke at a time.
   *
   * They are separate filters, not two modes of one. `GET /identity` takes
   * `created_at_range[]` and `updated_at_range[]` *both at once*, and the
   * combination is the one an operator reaches for on a stalled job: issued
   * last month, untouched since.
   */
  const [createdFrom, setCreatedFrom] = React.useState("")
  const [createdTo, setCreatedTo] = React.useState("")

  const [movedFrom, setMovedFrom] = React.useState("")
  const [movedTo, setMovedTo] = React.useState("")

  /** The card open in the preview, held as a row rather than an id — see below. */
  const [previewed, setPreviewed] = React.useState<IDCard | null>(null)

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
   * `statuses` is never absent: an empty facet means "the whole queue", which
   * is these three ids, not every identity in the system.
   */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        memberPhone,
        templateTitle,
        organizationId,
        statuses: statusFilter.length > 0 ? statusFilter : QUEUE_KEYS,
        // Both windows, each matching a column the table shows: when the card
        // was issued, and when it last changed hands.
        createdAtRange: toInstantRange(createdFrom, createdTo),
        updatedAtRange: toInstantRange(movedFrom, movedTo),
      }),
    [
      search,
      memberPhone,
      templateTitle,
      organizationId,
      statusFilter,
      createdFrom,
      createdTo,
      movedFrom,
      movedTo,
    ]
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
  } = useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE })

  // `keepPreviousData` is what makes paging work at all: every page is a new
  // query key, so without it `data` would be undefined for the whole trip and
  // the row count, the total and the page range would all blink to zero.
  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY)
  /** `{ value, label }` is the shape `SelectFilter` reads a label out of. */
  const organizationOptions = React.useMemo(
    () =>
      (organizationsQuery.data?.data.data ?? []).map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
    [organizationsQuery.data]
  )

  const idsQuery = useGetIds(listQuery, { placeholderData: keepPreviousData })
  const data = React.useMemo(
    () => idsQuery.data?.data.data ?? [],
    [idsQuery.data]
  )

  /**
   * The previewed card, re-read from the current rows.
   *
   * Held as a snapshot *and* refreshed from the list, because the two failure
   * modes pull in opposite directions. Keeping only the snapshot would leave
   * the dialog showing "Waiting to print" after the operator marked it
   * printing, and its image links would go stale. Deriving it purely from the
   * rows would slam the dialog shut the moment that same click moved the card
   * out of the filtered page — mid-print, with the Print button one tap away.
   */
  const previewedCard = React.useMemo(() => {
    if (!previewed) return null
    return data.find((card) => card.id === previewed.id) ?? previewed
  }, [data, previewed])

  const pageInfo = React.useMemo(
    () => readPageInfo(idsQuery.data?.data),
    [idsQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  /**
   * The only way `page` changes. Clamping in the handler rather than during
   * render: setting state while rendering re-runs the component immediately,
   * so any moment the total read low the clamp would fight the click and snap
   * back to page 1.
   */
  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  // Opening a card is the row's job now (§8), and the card grid's thumbnail —
  // clicking the picture of the thing is what everyone tries first.
  const openPreview = React.useCallback((card: IDCard) => setPreviewed(card), [])
  // Keyed on `t`: the headers and the View menu's column names are translated,
  // so the list is language-dependent. Memoized because a fresh column array
  // every render remounts every cell, including ones with a status change in
  // flight.
  const columns = React.useMemo(() => createColumns(t), [t])

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
      onPageSizeChange={setPageSize}
      // Deliberately not disabled while fetching: with the previous page still
      // on screen the controls stay meaningful.
      busy={idsQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  /**
   * The filters that live behind the sheet below `lg` — everything except
   * search, which stays on the toolbar at every width because it is the one
   * people reach for first (§6.7).
   */
  const clearSheetFilters = () => {
    setStatusFilter([])
    setOrganizationId("")
    setPhoneQuery("")
    setTemplateQuery("")
    setCreatedFrom("")
    setCreatedTo("")
    setMovedFrom("")
    setMovedTo("")
  }

  /** The badge on the collapsed trigger — the typed values, not the debounced. */
  const sheetFilterCount =
    statusFilter.length +
    (organizationId ? 1 : 0) +
    (phoneQuery.trim() ? 1 : 0) +
    (templateQuery.trim() ? 1 : 0) +
    // Each window counts once, however many of its two ends are set.
    (createdFrom || createdTo ? 1 : 0) +
    (movedFrom || movedTo ? 1 : 0)

  const clearFilters = () => {
    clearSheetFilters()
    setQuery("")
  }

  /**
   * The controls that collapse into the sheet below `lg`.
   *
   * One definition rendered into two layouts rather than two copies: the only
   * difference between them is how wide each trigger is.
   */
  const collapsibleFilters = (inSheet: boolean) => (
    <>
      <FacetFilter
        label={t("printer.stage")}
        icon={Printer}
        options={statusOptions}
        selected={statusFilter}
        onToggle={(key) => setStatusFilter((current) => toggleKey(current, key))}
        className={inSheet ? SHEET_CONTROL : undefined}
      />

      {/* Singular — see the note at the top of this file. */}
      <SelectFilter
        label={t("filters.attributes.organization")}
        icon={Building2}
        options={organizationOptions}
        value={organizationId}
        onChange={setOrganizationId}
        allLabel={t("printer.allOrganizations")}
        emptyLabel={t("members.noOrganizations")}
        loading={organizationsQuery.isPending}
        className={inSheet ? SHEET_CONTROL : undefined}
      />

      {/* The batch a printer operator actually works in: one template is one
          load of stock, so this is how a run gets grouped. Free text because
          that is what the endpoint takes — `template_title`, not an id. */}
      <TextFilter
        icon={LayoutTemplate}
        value={templateQuery}
        onChange={setTemplateQuery}
        placeholder={t("templates.singular")}
        label={t("printer.templateFilterLabel")}
        className={inSheet ? "w-full" : "w-40"}
      />

      {/* Punctuation-tolerant, because the stored number is bare digits. */}
      <TextFilter
        icon={Phone}
        type="tel"
        inputMode="tel"
        value={phoneQuery}
        onChange={setPhoneQuery}
        placeholder={t("members.phonePlaceholder")}
        label={t("members.phoneFilterLabel")}
        className={inSheet ? "w-full" : "w-40"}
      />

      {/* When the card was issued. Useful on its own — "everything from the
          intake day that is still sitting here". */}
      <DateRangeFilter
        label={t("filters.attributes.created")}
        from={createdFrom}
        to={createdTo}
        onFromChange={setCreatedFrom}
        onToChange={setCreatedTo}
        inSheet={inSheet}
      />

      {/* When it last changed hands. Either end alone is a question an
          operator asks: "moved since Monday" is the current run, "moved before
          Monday" is what has stalled. */}
      <DateRangeFilter
        label={t("printer.columns.lastMoved")}
        from={movedFrom}
        to={movedTo}
        onFromChange={setMovedFrom}
        onToChange={setMovedTo}
        inSheet={inSheet}
      />
    </>
  )

  /**
   * The applied-filter row. One entry per *applied* filter — the debounced
   * search, not the raw input, so a chip never claims a filter the server has
   * not been asked for yet.
   */
  const activeFilters: ActiveFilter[] = [
    ...statusFilter.map((key) => ({
      key: "status-" + key,
      attribute: t("printer.stage"),
      value: statusOptions.find((option) => option.key === key)?.label ?? key,
      onRemove: () => setStatusFilter((current) => toggleKey(current, key)),
    })),
    ...(organizationId
      ? [
          {
            key: "organization",
            attribute: t("filters.attributes.organization"),
            value:
              organizationOptions.find(
                (option) => option.value === organizationId
              )?.label ?? organizationId,
            onRemove: () => setOrganizationId(""),
          },
        ]
      : []),
    ...(templateTitle
      ? [
          {
            key: "template",
            attribute: t("templates.singular"),
            value: templateTitle,
            onRemove: () => setTemplateQuery(""),
          },
        ]
      : []),
    ...(memberPhone
      ? [
          {
            key: "phone",
            attribute: t("filters.attributes.phone"),
            value: memberPhone,
            onRemove: () => setPhoneQuery(""),
          },
        ]
      : []),
    // One chip per window, not per end: the pair is a single filter, so it
    // clears as one.
    ...(createdFrom || createdTo
      ? [
          {
            key: "created",
            attribute: t("filters.attributes.created"),
            value: describeRange(t, createdFrom, createdTo),
            onRemove: () => {
              setCreatedFrom("")
              setCreatedTo("")
            },
          },
        ]
      : []),
    ...(movedFrom || movedTo
      ? [
          {
            key: "moved",
            attribute: t("printer.columns.lastMoved"),
            value: describeRange(t, movedFrom, movedTo),
            onRemove: () => {
              setMovedFrom("")
              setMovedTo("")
            },
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
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar — left group is the view switcher, right group the controls
          (§6.1). Below `lg` that single row becomes two: the switcher and one
          Filters button, then search across the full width, per §18.3. */}
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

          {/* The collapsed toolbar. Holds the same control component the
              desktop cluster does — passed in, not duplicated. */}
          <FilterSheet
            className="lg:hidden"
            count={sheetFilterCount}
            onClear={clearSheetFilters}
          >
            {collapsibleFilters(true)}
          </FilterSheet>
        </div>

        {/* Search stays on the bar at every width — it is the control people
            reach for first (§6.7). Below `lg` it owns its own full-width row. */}
        <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto">
          <TextFilter
            icon={Search}
            value={query}
            onChange={setQuery}
            placeholder={t("printer.searchPlaceholder")}
            label={t("printer.searchLabel")}
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
      {idsQuery.isError && hasRows && (
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
            onClick={() => idsQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {idsQuery.isPending ? (
        <LoadingRows />
      ) : idsQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("printer.loadFailed")}
          onRetry={() => idsQuery.refetch()}
          retrying={idsQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              emptyTitle={t("printer.emptyTitle")}
              footer={pagination}
              onRowClick={openPreview}
              rowLabel={(card) => t("printer.previewCard", { id: card.id })}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView table={table} onPreview={openPreview} />

              {/* Cards have no container of their own, so the bar gets one —
                  minus the top border it would double up on. */}
              <div className="overflow-hidden rounded-xl border border-border">
                {pagination}
              </div>
            </>
          )}
        </>
      )}

      <CardPreviewDialog
        card={previewedCard}
        open={previewedCard !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewed(null)
        }}
        // Refetching is what mints fresh image URLs — the ones on the row
        // expire five minutes after the request that produced them.
        onRefresh={() => idsQuery.refetch()}
        refreshing={idsQuery.isFetching}
      />
    </div>
  )
}
