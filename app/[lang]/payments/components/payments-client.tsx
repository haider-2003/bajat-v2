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
  Banknote,
  LayoutGrid,
  LayoutTemplate,
  Rows3,
  Search,
  User,
} from "lucide-react"

import {
  DateRangeFilter,
  describeRange,
  FilterChips,
  FilterSheet,
  TextFilter,
  type ActiveFilter,
} from "@/components/filters"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import {
  TableRecordSheet,
  useRecordSheet,
} from "@/components/table/record-sheet"
import { TableView } from "@/components/table/table-view"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useGetPayments } from "@/features/payments/api"
import type { Payment } from "@/features/payments/types"
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

import { createColumns } from "./columns"
import { CardView } from "./view-cards"

/**
 * Payments — view switcher + toolbar.
 *
 * The same architecture as the other list screens: server-driven rows, filters
 * as top-level query params, `useListQuery` owning the page, `keepPreviousData`
 * so paging doesn't blink. See docs/filtering-sorting-pagination.md.
 *
 * Rows come from `GET /payment`, **paged and filtered by the server**
 * (docs/CRUD-MIGRATION-REFERENCE.md §1.13).
 *
 * ### Read-only, and it says so
 *
 * There is no primary action on this screen and no row actions in the table.
 * Money is moved by the payment provider; this is the record of what it did.
 * A refund or a retry would be a call this API does not expose, so offering
 * one would be a button that cannot work.
 *
 * ### The date window filters on `updated_at`, not `created_at`
 *
 * That is the endpoint's contract, not a choice — `/payment` reads
 * `updated_at_range[]` and does not read `created_at_range[]`
 * (docs/CRUD-MIGRATION-REFERENCE.md §3.2). For a payment the two differ in a
 * way that matters: a charge is *created* when the request is raised and
 * *updated* when the provider settles it, so this window answers "what moved
 * this week", which is the question a reconciliation asks. The label says
 * Updated rather than Created so the chip does not claim otherwise.
 *
 * ### No status facet
 *
 * `Payment.status` is the provider's free-form vocabulary and `/payment` reads
 * no `statuses[]` parameter. A facet built from the statuses on the current
 * page would filter to values the server cannot be asked for — §6's silent
 * failure, where a real query parameter is simply ignored and the table
 * quietly shows everything.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * The page-header count. Deliberately the **unfiltered** total, and pinned to
 * the default query so it shares the table's first cache entry instead of
 * firing a second request.
 */
const COUNT_QUERY = { page: 1, pageSize: DEFAULT_PAGE_SIZE } as const

export function PaymentsCount() {
  const query = useGetPayments(COUNT_QUERY)
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

const STORAGE_KEY = "bajat-payments-view"

export function PaymentsClient() {
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
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce.
  const [query, setQuery] = React.useState("")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [amountQuery, setAmountQuery] = React.useState("")
  const amount = useDebounce(amountQuery.trim(), SEARCH_DEBOUNCE_MS)

  const [memberQuery, setMemberQuery] = React.useState("")
  const memberName = useDebounce(memberQuery.trim(), SEARCH_DEBOUNCE_MS)

  const [templateQuery, setTemplateQuery] = React.useState("")
  const templateTitle = useDebounce(templateQuery.trim(), SEARCH_DEBOUNCE_MS)

  // The window the charge last moved in, held as two `yyyy-mm-dd` days — what
  // the calendar selects, with no timezone attached. They become instants only
  // on the way out.
  const [updatedFrom, setUpdatedFrom] = React.useState("")
  const [updatedTo, setUpdatedTo] = React.useState("")

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
   * `memberName` and `templateTitle` decamelize to `member_name` and
   * `template_title`, which is what the endpoint reads — the relation is
   * filtered by *name*, not by id, on this module (§3.2).
   */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        amount,
        memberName,
        templateTitle,
        updatedAtRange: toInstantRange(updatedFrom, updatedTo),
      }),
    [search, amount, memberName, templateTitle, updatedFrom, updatedTo]
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

  // `useGetList` hands back the whole Axios response, so rows sit two `data`
  // levels down. `keepPreviousData` is what makes paging work at all.
  const paymentsQuery = useGetPayments(listQuery, {
    placeholderData: keepPreviousData,
  })
  const data = React.useMemo(
    () => paymentsQuery.data?.data.data ?? [],
    [paymentsQuery.data]
  )

  // A missing total means "unknown", never "zero": zero would disable Next
  // forever and print an empty state over a table that plainly has rows.
  const pageInfo = React.useMemo(
    () => readPageInfo(paymentsQuery.data?.data),
    [paymentsQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  /** The only way `page` changes — clamped in the handler, not during render. */
  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  // Keyed on `t`: the headers and the View menu's column names are translated.
  const columns = React.useMemo(() => createColumns(t), [t])

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<Payment>()

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
      busy={paymentsQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearSheetFilters = () => {
    setAmountQuery("")
    setMemberQuery("")
    setTemplateQuery("")
    setUpdatedFrom("")
    setUpdatedTo("")
  }

  /** The badge on the collapsed trigger — the typed values, not the debounced. */
  const sheetFilterCount =
    (amountQuery.trim() ? 1 : 0) +
    (memberQuery.trim() ? 1 : 0) +
    (templateQuery.trim() ? 1 : 0) +
    // The window counts once, however many of its two ends are set.
    (updatedFrom || updatedTo ? 1 : 0)

  const clearFilters = () => {
    clearSheetFilters()
    setQuery("")
  }

  /** Whether the server was asked for anything narrower than "everything". */
  const filtered = filter.length > 0

  /**
   * The controls that collapse into the sheet below `lg`.
   *
   * One definition rendered into two layouts rather than two copies: the only
   * difference between them is how wide each trigger is.
   */
  const collapsibleFilters = (inSheet: boolean) => (
    <>
      {/* An exact figure rather than a range: the question this answers is
          "find the charge for 25,000", which is how a disputed amount is
          located when the reference is not to hand. */}
      <TextFilter
        icon={Banknote}
        inputMode="decimal"
        value={amountQuery}
        onChange={setAmountQuery}
        placeholder={t("payments.amountPlaceholder")}
        label={t("payments.amountFilterLabel")}
        className={inSheet ? "w-full" : "w-32"}
      />

      <TextFilter
        icon={User}
        value={memberQuery}
        onChange={setMemberQuery}
        placeholder={t("payments.memberPlaceholder")}
        label={t("payments.memberFilterLabel")}
        className={inSheet ? "w-full" : "w-40"}
      />

      <TextFilter
        icon={LayoutTemplate}
        value={templateQuery}
        onChange={setTemplateQuery}
        placeholder={t("payments.templatePlaceholder")}
        label={t("payments.templateFilterLabel")}
        className={inSheet ? "w-full" : "w-40"}
      />

      {/* Labelled Updated, because that is the field the endpoint filters —
          see the note at the top of this file. */}
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
    ...(amount
      ? [
          {
            key: "amount",
            attribute: t("filters.attributes.amount"),
            value: amount,
            onRemove: () => setAmountQuery(""),
          },
        ]
      : []),
    ...(memberName
      ? [
          {
            key: "member",
            attribute: t("filters.attributes.member"),
            value: memberName,
            onRemove: () => setMemberQuery(""),
          },
        ]
      : []),
    ...(templateTitle
      ? [
          {
            key: "template",
            attribute: t("filters.attributes.template"),
            value: templateTitle,
            onRemove: () => setTemplateQuery(""),
          },
        ]
      : []),
    // One chip per window, not per end: the pair is a single filter.
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

  /**
   * An organization whose templates are all free never sees a payment, so "no
   * rows" needs two readings here and the default "try clearing a filter" is
   * wrong for one of them.
   */
  const emptyTitle = filtered
    ? t("payments.emptyFiltered")
    : t("payments.emptyTitle")
  const emptyHint = filtered ? undefined : t("payments.emptyHint")

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

          {/* The collapsed toolbar. Holds the same control components the
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
            placeholder={t("payments.searchPlaceholder")}
            label={t("payments.searchLabel")}
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
          table and its pager stay put instead of vanishing. */}
      {paymentsQuery.isError && hasRows && (
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
            onClick={() => paymentsQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {paymentsQuery.isPending ? (
        <LoadingRows />
      ) : paymentsQuery.isError && !hasRows ? (
        /* A ledger that fails to load must not read as one with no charges:
           "nothing was billed" and "we could not find out" are different
           answers, and only one of them is safe to reconcile against. */
        <LoadFailed
          title={t("payments.loadFailed")}
          onRetry={() => paymentsQuery.refetch()}
          retrying={paymentsQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              onRowClick={shown.show}
              rowLabel={(payment) => payment.requestId}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
              footer={pagination}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
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

      {/* Mounted once, not once per row: thirty rows each holding a `Dialog`
          is thirty portals waiting to be opened. */}
      <TableRecordSheet
        table={table}
        row={shown.row}
        onOpenChange={shown.onOpenChange}
        title={shown.row?.requestId}
        subtitle={shown.row?.member?.name}
      />
    </div>
  )
}
