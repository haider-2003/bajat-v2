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
  Building2,
  CalendarDays,
  LayoutGrid,
  LayoutTemplate,
  Phone,
  Rows3,
  Search,
  User,
  Workflow,
} from "lucide-react"

import {
  AppliedFilters,
  ChoiceEditor,
  DateRangeEditor,
  describeRange,
  type FilterDefinition,
  FilterMenu,
  RangeEditor,
  TextEditor,
  TextFilter,
} from "@/components/filters"
import { DeleteIdentityDialog } from "@/components/id-card/delete-identity-dialog"
import { EmptyState } from "@/components/table/empty-state"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import { TableView } from "@/components/table/table-view"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useAuthStore } from "@/features/auth/store"
import { useGetIdsNode } from "@/features/ids/api"
import type { IDCard } from "@/features/ids/types"
import { useGetOrganizations } from "@/features/organizations/api"
import { useT } from "@/i18n/context"
import { useLocaleRouter } from "@/i18n/navigation"
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
import { flowHref, type FlowActionHandlers } from "./flow-actions"
import { CardView } from "./view-cards"

/**
 * ID Flow — the approval inbox (docs/IDS-FLOW-EXPORTS-ROUTES.md §3).
 *
 * > "List the identities whose current node is one I am assigned to."
 *
 * That is the whole screen. `GET /identity/node` is scoped by the **token**:
 * the server reads the caller's `node_ids` and returns what is parked at any
 * of them, across every template whose flow contains those nodes. There is
 * no `node_id` parameter, and there is nothing to send — a user with no
 * nodes sees an empty inbox whatever they filter on, and a template with no
 * flow produces cards that never appear here for anyone.
 *
 * ### An inbox, not a second copy of the ledger
 *
 * Same rows as the Requests screen — a delete here removes the card there —
 * but a different question. The ledger asks where every card is on the
 * global status ladder; this asks what is waiting for *me*. So the progress
 * column is the per-template stage (`node.name`), the status column is
 * absent, and "approve" on the review page means *advance to the next node*,
 * not flip `status`. Once a reviewer approves, the card leaves their queue
 * and appears in the next node-holder's.
 *
 * ### Filters
 *
 * The ledger's, minus `statuses` (meaningless here) and `updated_at_range`
 * (the endpoint does not read it). No `?organizationId=` deep link either.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * The page-header count — the whole inbox, not what survived the filters.
 * Identical to the table's first query so the two share one response.
 */
const COUNT_QUERY = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  filter: buildFilter({}),
} as const

export function FlowCount() {
  const query = useGetIdsNode(COUNT_QUERY)
  const total = readPageInfo(query.data?.data).total

  if (query.isPending) return <span className="text-text-placeholder">—</span>
  return <>{total ?? query.data?.data.data?.length ?? 0}</>
}

type ViewMode = "table" | "cards"

const VIEWS: {
  id: ViewMode
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  desktopOnly?: boolean
}[] = [
  { id: "table", labelKey: "views.table", icon: Rows3, desktopOnly: true },
  { id: "cards", labelKey: "views.cards", icon: LayoutGrid },
]

const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

const STORAGE_KEY = "bajat-flow-inbox-view"

/**
 * Filters, sort, page and page size, remembered for the tab — so opening a
 * row and coming back lands on the list you left. See hooks/use-sticky-state.ts.
 */
const LIST_KEY = "bajat-flow-inbox"

/** `price[]` — see the note in the ledger's client. */
function priceRange(min: string, max: string): string[] | undefined {
  const lo = min.trim()
  const hi = max.trim()
  if (!lo && !hi) return undefined
  if (lo && !hi) return [lo]
  return [lo || "0", hi]
}

export function FlowClient() {
  const t = useT()
  const router = useLocaleRouter()
  const canReview = useAuthStore((s) => s.can("update-identity"))

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

  const [organizationId, setOrganizationId] = useStickyState(
    `${LIST_KEY}:organizationId`,
    ""
  )

  const [query, setQuery] = useStickyState(`${LIST_KEY}:query`, "")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [nameQuery, setNameQuery] = useStickyState(`${LIST_KEY}:nameQuery`, "")
  const memberName = useDebounce(nameQuery.trim(), SEARCH_DEBOUNCE_MS)

  const [phoneQuery, setPhoneQuery] = useStickyState(
    `${LIST_KEY}:phoneQuery`,
    ""
  )
  const memberPhone = useDebounce(phoneDigits(phoneQuery), SEARCH_DEBOUNCE_MS)

  const [templateQuery, setTemplateQuery] = useStickyState(
    `${LIST_KEY}:templateQuery`,
    ""
  )
  const templateTitle = useDebounce(templateQuery.trim(), SEARCH_DEBOUNCE_MS)

  const [priceMin, setPriceMin] = useStickyState(`${LIST_KEY}:priceMin`, "")
  const [priceMax, setPriceMax] = useStickyState(`${LIST_KEY}:priceMax`, "")
  // Memoized, not called inline: `priceRange` builds a fresh array every
  // render, and `useDebounce` keys its timer on the value's *identity*. Passed
  // inline, each render restarts the timer and each timer sets a
  // reference-different array, which re-renders and restarts it again — a
  // 300ms loop that never settles. Every other filter here is a string, which
  // is why only this one needs it.
  const priceInput = React.useMemo(
    () => priceRange(priceMin, priceMax),
    [priceMin, priceMax]
  )
  const price = useDebounce(priceInput, SEARCH_DEBOUNCE_MS)

  const [createdFrom, setCreatedFrom] = useStickyState(
    `${LIST_KEY}:createdFrom`,
    ""
  )
  const [createdTo, setCreatedTo] = useStickyState(`${LIST_KEY}:createdTo`, "")

  const [deleting, setDeleting] = React.useState<IDCard | null>(null)

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

  /** Every field name here is one `GET /identity/node` reads (spec §3.2). */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        memberName,
        memberPhone,
        templateTitle,
        organizationId,
        price,
        createdAtRange: toInstantRange(createdFrom, createdTo),
      }),
    [
      search,
      memberName,
      memberPhone,
      templateTitle,
      organizationId,
      price,
      createdFrom,
      createdTo,
    ]
  )

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

  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY)
  const organizationOptions = React.useMemo(
    () =>
      (organizationsQuery.data?.data.data ?? []).map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
    [organizationsQuery.data]
  )

  const inboxQuery = useGetIdsNode(listQuery, { placeholderData: keepPreviousData })
  const data = React.useMemo(
    () => inboxQuery.data?.data.data ?? [],
    [inboxQuery.data]
  )

  const pageInfo = React.useMemo(
    () => readPageInfo(inboxQuery.data?.data),
    [inboxQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  const handlers: FlowActionHandlers = React.useMemo(
    () => ({ onDelete: setDeleting }),
    []
  )

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

  // The row goes where the Review segment goes, for the pointer.
  const reviewCard = canReview
    ? (card: IDCard) => router.push(flowHref(card.id))
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
      busy={inboxQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearFilters = () => {
    setQuery("")
    setOrganizationId("")
    setNameQuery("")
    setPhoneQuery("")
    setTemplateQuery("")
    setPriceMin("")
    setPriceMax("")
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
  const typedPrice = priceRange(priceMin, priceMax)
  const filters: FilterDefinition[] = [
    {
      // Singular — `/identity` reads one `organization_id`.
      key: "organization",
      label: t("filters.attributes.organization"),
      icon: Building2,
      value: organizationId
        ? (organizationOptions.find((option) => option.value === organizationId)
            ?.label ?? organizationId)
        : undefined,
      editor: (
        <ChoiceEditor
          options={organizationOptions}
          value={organizationId}
          onChange={setOrganizationId}
          emptyLabel={t("members.noOrganizations")}
          loading={organizationsQuery.isPending}
        />
      ),
      onClear: () => setOrganizationId(""),
    },
    {
      key: "name",
      label: t("ids.columns.cardholder"),
      icon: User,
      value: nameQuery.trim() || undefined,
      editor: (
        <TextEditor
          value={nameQuery}
          onChange={setNameQuery}
          label={t("ids.nameFilterLabel")}
        />
      ),
      onClear: () => setNameQuery(""),
    },
    {
      // Punctuation-tolerant, because the stored number is bare digits.
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
      // Free text because that is what the endpoint takes — `template_title`,
      // not an id.
      key: "template",
      label: t("templates.singular"),
      icon: LayoutTemplate,
      value: templateQuery.trim() || undefined,
      editor: (
        <TextEditor
          value={templateQuery}
          onChange={setTemplateQuery}
          label={t("printer.templateFilterLabel")}
        />
      ),
      onClear: () => setTemplateQuery(""),
    },
    {
      // `price[]` — a floor and a ceiling.
      key: "price",
      label: t("filters.attributes.amount"),
      icon: Banknote,
      value: typedPrice
        ? typedPrice.length === 1
          ? t("filters.rangeFromOnly", { from: typedPrice[0] })
          : t("filters.rangeBoth", { from: typedPrice[0], to: typedPrice[1] })
        : undefined,
      editor: (
        <RangeEditor
          min={priceMin}
          max={priceMax}
          onMinChange={setPriceMin}
          onMaxChange={setPriceMax}
        />
      ),
      onClear: () => {
        setPriceMin("")
        setPriceMax("")
      },
    },
    {
      key: "created",
      label: t("ids.columns.issued"),
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex items-center justify-between gap-2">
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

        <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto">
          <TextFilter
            icon={Search}
            value={query}
            onChange={setQuery}
            placeholder={t("idsFlow.searchPlaceholder")}
            label={t("idsFlow.searchLabel")}
            className="w-full lg:w-56"
          />

          <div className="hidden items-center gap-2 lg:flex">
            <FilterMenu filters={filters} />
            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <AppliedFilters filters={filters} onClear={clearFilters} />

      {inboxQuery.isError && hasRows && (
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
            onClick={() => inboxQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {inboxQuery.isPending ? (
        <LoadingRows />
      ) : inboxQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("idsFlow.loadFailed")}
          onRetry={() => inboxQuery.refetch()}
          retrying={inboxQuery.isFetching}
        />
      ) : !hasRows && !filtered ? (
        // An empty inbox is a state worth a sentence: either nothing is
        // waiting on this reviewer, or they hold no nodes — and the page
        // cannot tell which, so it says both.
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16">
          <Workflow
            className="mb-4 size-6 text-text-placeholder"
            strokeWidth={1.4}
            aria-hidden
          />
          <EmptyState title={t("idsFlow.emptyTitle")} hint={t("idsFlow.emptyHint")} />
        </div>
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              emptyTitle={t("idsFlow.emptyFiltered")}
              footer={pagination}
              onRowClick={reviewCard}
              rowLabel={(card) => t("idsFlow.reviewCard", { id: card.id })}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
                emptyTitle={t("idsFlow.emptyFiltered")}
                handlers={handlers}
              />
              <div className="overflow-hidden rounded-xl border border-border">
                {pagination}
              </div>
            </>
          )}
        </>
      )}

      <DeleteIdentityDialog
        card={deleting}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
