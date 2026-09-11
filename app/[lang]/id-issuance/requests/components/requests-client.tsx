"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useTable,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table"
import {
  AlertCircle,
  Banknote,
  Building2,
  LayoutGrid,
  LayoutTemplate,
  Phone,
  Rows3,
  Search,
  Tag,
  User,
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
import { DeleteIdentityDialog } from "@/components/id-card/delete-identity-dialog"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import { TableView } from "@/components/table/table-view"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useAuthStore } from "@/features/auth/store"
import { useGetIds } from "@/features/ids/api"
import { STATUS_OPTION_KEYS } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { useGetOrganizations } from "@/features/organizations/api"
import { useT } from "@/i18n/context"
import { useLocaleRouter } from "@/i18n/navigation"
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

import { createColumns } from "./columns"
import { requestHref, type RequestActionHandlers } from "./request-actions"
import { CardView } from "./view-cards"

/**
 * Requests — the ledger of every identity ever issued
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §2).
 *
 * The same architecture as the other list screens: server-driven rows, filters
 * as top-level query params, `useListQuery` owning the page, `keepPreviousData`
 * so paging doesn't blink. See docs/filtering-sorting-pagination.md.
 *
 * ### This is the ledger, not a queue
 *
 * `GET /identity` with nothing pinned onto it. The printer screen is the same
 * endpoint with `statuses[]=4,5,6` welded on; this is the unfiltered version,
 * where the status facet is a real facet — nothing ticked means every card,
 * and all ten statuses are offered rather than the four the reference client
 * showed (spec §9.18). A card in delivery is still a card that was issued.
 *
 * ### One axis of two
 *
 * Every card has *two* progress indicators (spec §0): `status`, the global
 * ladder this screen is driven by, and `node`, the per-template approval
 * stage the ID Flow screen is driven by. They are two views of the same rows
 * — a delete here removes the card from there — and this one never touches
 * `node`.
 *
 * ### The organization can arrive in the URL
 *
 * `/id-issuance/requests?organizationId=3` seeds the organization filter, so
 * an organization's own page can link to its cards. Read once, at mount, the
 * way the reference client did: after that the filter is the select's, and
 * changing it does not write back to the address bar.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * The page-header count — every card, not what survived the filters.
 *
 * Built to be *identical* to the query the table runs on arrival with nothing
 * in the URL, so React Query hashes it to the same key and the header shares
 * the table's first response instead of firing a second request.
 */
const COUNT_QUERY = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  filter: buildFilter({}),
} as const

export function RequestsCount() {
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
 * other screens use, so they share one cached response.
 */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

const STORAGE_KEY = "bajat-requests-ledger-view"

/** The `?organizationId=` deep link. */
const ORGANIZATION_PARAM = "organizationId"

/**
 * The `price[]` pair — `[min, max]`, positional like the date ranges
 * (utils/date.ts): element 0 is the floor, element 1 the ceiling, so an open
 * floor is spelled `"0"` rather than omitted. Both empty gives `undefined`,
 * which `buildFilter` drops.
 */
function priceRange(min: string, max: string): string[] | undefined {
  const lo = min.trim()
  const hi = max.trim()
  if (!lo && !hi) return undefined
  if (lo && !hi) return [lo]
  return [lo || "0", hi]
}

export function RequestsClient() {
  const t = useT()
  const router = useLocaleRouter()
  const searchParams = useSearchParams()
  const canOpen = useAuthStore((s) => s.can("show-identity"))

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

  // Server-driven: each of these goes out as a query param, so a change
  // refetches rather than re-filtering what is already on screen.
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])
  /** One id, or `""` for every organization — seeded from the URL once. */
  const [organizationId, setOrganizationId] = React.useState(
    () => searchParams.get(ORGANIZATION_PARAM)?.trim() ?? ""
  )

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce.
  const [query, setQuery] = React.useState("")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [nameQuery, setNameQuery] = React.useState("")
  const memberName = useDebounce(nameQuery.trim(), SEARCH_DEBOUNCE_MS)

  const [phoneQuery, setPhoneQuery] = React.useState("")
  const memberPhone = useDebounce(phoneDigits(phoneQuery), SEARCH_DEBOUNCE_MS)

  const [templateQuery, setTemplateQuery] = React.useState("")
  const templateTitle = useDebounce(templateQuery.trim(), SEARCH_DEBOUNCE_MS)

  const [priceMin, setPriceMin] = React.useState("")
  const [priceMax, setPriceMax] = React.useState("")
  const price = useDebounce(priceRange(priceMin, priceMax), SEARCH_DEBOUNCE_MS)

  /**
   * The two date windows, each as a pair of `yyyy-mm-dd` values — `""` for an
   * open end. Neither is debounced: a date arrives in one click.
   */
  const [createdFrom, setCreatedFrom] = React.useState("")
  const [createdTo, setCreatedTo] = React.useState("")
  const [updatedFrom, setUpdatedFrom] = React.useState("")
  const [updatedTo, setUpdatedTo] = React.useState("")

  /** The card the delete confirmation is about. `null` closes it. */
  const [deleting, setDeleting] = React.useState<IDCard | null>(null)

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
   * Everything this screen filters on, keyed by the field name it is sent as
   * (spec §2.1 — every name here is one `GET /identity` reads).
   */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        memberName,
        memberPhone,
        templateTitle,
        organizationId,
        statuses: statusFilter,
        price,
        createdAtRange: toInstantRange(createdFrom, createdTo),
        updatedAtRange: toInstantRange(updatedFrom, updatedTo),
      }),
    [
      search,
      memberName,
      memberPhone,
      templateTitle,
      organizationId,
      statusFilter,
      price,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
    ]
  )

  // Page state lives with the filters: `useListQuery` derives page 1 whenever
  // the filter set or the page size changes.
  const {
    query: listQuery,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE })

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
   * render, so a moment when the total reads low cannot fight the click.
   */
  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  const handlers: RequestActionHandlers = React.useMemo(
    () => ({ onDelete: setDeleting }),
    []
  )

  // Keyed on `t`: the headers and the View menu's column names are translated.
  // Memoized because a fresh column array every render remounts every cell.
  const columns = React.useMemo(() => createColumns(t, handlers), [t, handlers])

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

  // The row is the "open" control (§8), and here open means the card's page.
  // Without `show-identity` the row stays inert and the action segment says
  // why — a click that silently does nothing is the worst of the options.
  const openCard = canOpen
    ? (card: IDCard) => router.push(requestHref(card.id))
    : undefined

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
   * search, which stays on the toolbar at every width (§6.7).
   */
  const clearSheetFilters = () => {
    setStatusFilter([])
    setOrganizationId("")
    setNameQuery("")
    setPhoneQuery("")
    setTemplateQuery("")
    setPriceMin("")
    setPriceMax("")
    setCreatedFrom("")
    setCreatedTo("")
    setUpdatedFrom("")
    setUpdatedTo("")
  }

  /** The badge on the collapsed trigger — the typed values, not the debounced. */
  const sheetFilterCount =
    statusFilter.length +
    (organizationId ? 1 : 0) +
    (nameQuery.trim() ? 1 : 0) +
    (phoneQuery.trim() ? 1 : 0) +
    (templateQuery.trim() ? 1 : 0) +
    // Each range counts once, however many of its two ends are set.
    (priceMin.trim() || priceMax.trim() ? 1 : 0) +
    (createdFrom || createdTo ? 1 : 0) +
    (updatedFrom || updatedTo ? 1 : 0)

  const clearFilters = () => {
    clearSheetFilters()
    setQuery("")
  }

  /**
   * The controls that collapse into the sheet below `lg`. One definition
   * rendered into two layouts rather than two copies.
   */
  const collapsibleFilters = (inSheet: boolean) => (
    <>
      <FacetFilter
        label={t("common.status")}
        icon={Tag}
        options={statusOptions}
        selected={statusFilter}
        onToggle={(key) => setStatusFilter((current) => toggleKey(current, key))}
        className={inSheet ? SHEET_CONTROL : undefined}
      />

      {/* Singular — `/identity` reads one `organization_id`. */}
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

      <TextFilter
        icon={User}
        value={nameQuery}
        onChange={setNameQuery}
        placeholder={t("ids.columns.cardholder")}
        label={t("ids.nameFilterLabel")}
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

      {/* Free text because that is what the endpoint takes — `template_title`,
          not an id. */}
      <TextFilter
        icon={LayoutTemplate}
        value={templateQuery}
        onChange={setTemplateQuery}
        placeholder={t("templates.singular")}
        label={t("printer.templateFilterLabel")}
        className={inSheet ? "w-full" : "w-40"}
      />

      {/* `price[]` — a floor and a ceiling. Two boxes rather than a range
          slider: the amounts are dinars in the thousands, and a slider over
          that range cannot land on the number somebody has in mind. */}
      <div className={cn("flex items-center gap-2", inSheet && "w-full")}>
        <TextFilter
          icon={Banknote}
          inputMode="decimal"
          value={priceMin}
          onChange={setPriceMin}
          placeholder={t("ids.priceFrom")}
          label={t("ids.priceFrom")}
          className={inSheet ? "flex-1" : "w-32"}
        />
        <TextFilter
          icon={Banknote}
          inputMode="decimal"
          value={priceMax}
          onChange={setPriceMax}
          placeholder={t("ids.priceTo")}
          label={t("ids.priceTo")}
          className={inSheet ? "flex-1" : "w-32"}
        />
      </div>

      <DateRangeFilter
        label={t("ids.columns.issued")}
        from={createdFrom}
        to={createdTo}
        onFromChange={setCreatedFrom}
        onToChange={setCreatedTo}
        inSheet={inSheet}
      />

      <DateRangeFilter
        label={t("filters.attributes.updated")}
        from={updatedFrom}
        to={updatedTo}
        onFromChange={setUpdatedFrom}
        onToChange={setUpdatedTo}
        inSheet={inSheet}
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
      key: "status-" + key,
      attribute: t("common.status"),
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
    ...(memberName
      ? [
          {
            key: "name",
            attribute: t("ids.columns.cardholder"),
            value: memberName,
            onRemove: () => setNameQuery(""),
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
    ...(price
      ? [
          {
            key: "price",
            attribute: t("filters.attributes.amount"),
            value:
              price.length === 1
                ? t("filters.rangeFromOnly", { from: price[0] })
                : t("filters.rangeBoth", { from: price[0], to: price[1] }),
            onRemove: () => {
              setPriceMin("")
              setPriceMax("")
            },
          },
        ]
      : []),
    // One chip per window, not per end: the pair is a single filter.
    ...(createdFrom || createdTo
      ? [
          {
            key: "created",
            attribute: t("ids.columns.issued"),
            value: describeRange(t, createdFrom, createdTo),
            onRemove: () => {
              setCreatedFrom("")
              setCreatedTo("")
            },
          },
        ]
      : []),
    ...(updatedFrom || updatedTo
      ? [
          {
            key: "updated",
            attribute: t("filters.attributes.updated"),
            value: describeRange(t, updatedFrom, updatedTo),
            onRemove: () => {
              setUpdatedFrom("")
              setUpdatedTo("")
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
            placeholder={t("ids.searchPlaceholder")}
            label={t("ids.searchLabel")}
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
          Once rows are on screen an error becomes a strip above them, so the
          table and its pager stay put. */}
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
          title={t("ids.loadFailed")}
          onRetry={() => idsQuery.refetch()}
          retrying={idsQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              emptyTitle={
                activeFilters.length > 0 ? t("ids.emptyFiltered") : t("ids.emptyTitle")
              }
              emptyHint={activeFilters.length > 0 ? undefined : t("ids.emptyHint")}
              footer={pagination}
              onRowClick={openCard}
              rowLabel={(card) => t("ids.openCard", { id: card.id })}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
                emptyTitle={
                  activeFilters.length > 0
                    ? t("ids.emptyFiltered")
                    : t("ids.emptyTitle")
                }
                handlers={handlers}
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

      {/* Mounted once, not once per row. */}
      <DeleteIdentityDialog
        card={deleting}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
