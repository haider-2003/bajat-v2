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
  CalendarDays,
  History,
  LayoutGrid,
  LayoutTemplate,
  Phone,
  Rows3,
  Search,
  Tag,
  User,
} from "lucide-react"

import {
  AppliedFilters,
  ChoiceEditor,
  DateRangeEditor,
  describeFacet,
  describeRange,
  FacetEditor,
  FilterMenu,
  RangeEditor,
  TextEditor,
  TextFilter,
  toggleKey,
  type FilterDefinition,
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
import { useStickyState } from "@/hooks/use-sticky-state"
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
 * ### Ten filters, one button
 *
 * This screen filters on more than a toolbar can carry inline — the two
 * date windows alone were four chips — so it uses the add-a-filter kit
 * (components/filters/filter-builder.tsx, DESIGN.md §12.8 / §14.5) rather
 * than a control per filter: one **Filter** button lists the attributes,
 * and what is set shows as chips that reopen their editor. The same kit
 * serves every width, so there is no separate mobile sheet here.
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

/**
 * Filters, sort, page and page size, remembered for the tab — so opening a
 * row and coming back lands on the list you left. See hooks/use-sticky-state.ts.
 */
const LIST_KEY = "bajat-requests-ledger"

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
  const [sorting, setSorting] = useStickyState<SortingState>(
    `${LIST_KEY}:sorting`,
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})

  // Server-driven: each of these goes out as a query param, so a change
  // refetches rather than re-filtering what is already on screen.
  const [statusFilter, setStatusFilter] = useStickyState<string[]>(
    `${LIST_KEY}:statusFilter`,
    []
  )
  /** One id, or `""` for every organization. */
  const [organizationId, setOrganizationId] = useStickyState(
    `${LIST_KEY}:organizationId`,
    "",
    // An explicit `?organizationId=` is a fresh instruction from whoever made
    // the link, so it outranks whatever this tab was filtered by before.
    // `|| undefined` because an absent parameter reads as `""`, and "no
    // parameter" must not be mistaken for "filter by no organization".
    { seed: searchParams.get(ORGANIZATION_PARAM)?.trim() || undefined }
  )

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce.
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

  /**
   * The two date windows, each as a pair of `yyyy-mm-dd` values — `""` for an
   * open end. Neither is debounced: a date arrives in one click.
   */
  const [createdFrom, setCreatedFrom] = useStickyState(
    `${LIST_KEY}:createdFrom`,
    ""
  )
  const [createdTo, setCreatedTo] = useStickyState(`${LIST_KEY}:createdTo`, "")
  const [updatedFrom, setUpdatedFrom] = useStickyState(
    `${LIST_KEY}:updatedFrom`,
    ""
  )
  const [updatedTo, setUpdatedTo] = useStickyState(`${LIST_KEY}:updatedTo`, "")

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
  } = useListQuery(filter, {
    pageSize: DEFAULT_PAGE_SIZE,
    storageKey: LIST_KEY,
  })

  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY)
  /** `{ value, label }` is the shape `ChoiceEditor` reads a label out of. */
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

  const clearFilters = () => {
    setQuery("")
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

  /**
   * Every filter this screen offers, described once: the menu lists them,
   * the chip row shows the set ones, and both open the same editor.
   *
   * Chip text comes from the *typed* values, not the debounced ones — the
   * chip is the editor's own label, so it has to move with the keystroke.
   * The 300ms the server trails by is covered by `keepPreviousData`.
   */
  const typedPrice = priceRange(priceMin, priceMax)
  const filters: FilterDefinition[] = [
    {
      key: "status",
      label: t("common.status"),
      icon: Tag,
      value: describeFacet(t, statusOptions, statusFilter),
      editor: (
        <FacetEditor
          options={statusOptions}
          selected={statusFilter}
          onToggle={(key) =>
            setStatusFilter((current) => toggleKey(current, key))
          }
        />
      ),
      onClear: () => setStatusFilter([]),
    },
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
    {
      key: "updated",
      label: t("filters.attributes.updated"),
      icon: History,
      value: describeRange(t, updatedFrom, updatedTo) || undefined,
      editor: (
        <DateRangeEditor
          from={updatedFrom}
          to={updatedTo}
          onFromChange={setUpdatedFrom}
          onToChange={setUpdatedTo}
        />
      ),
      onClear: () => {
        setUpdatedFrom("")
        setUpdatedTo("")
      },
    },
  ]

  /** Whether the empty state should blame the filters rather than the data. */
  const filtered = filters.some((f) => f.value !== undefined) || search !== ""

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

          {/* Below `lg` the Filter button sits beside the switcher; at `lg`
              it moves onto the search row. One button either way — the
              popover is the same at every width, so no sheet. */}
          <FilterMenu filters={filters} className="lg:hidden" />
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

          <div className="hidden items-center gap-2 lg:flex">
            <FilterMenu filters={filters} />

            {/* View — column visibility + reordering (table only) */}
            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <AppliedFilters filters={filters} onClear={clearFilters} />

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
              emptyTitle={filtered ? t("ids.emptyFiltered") : t("ids.emptyTitle")}
              emptyHint={filtered ? undefined : t("ids.emptyHint")}
              footer={pagination}
              onRowClick={openCard}
              rowLabel={(card) => t("ids.openCard", { id: card.id })}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
                emptyTitle={filtered ? t("ids.emptyFiltered") : t("ids.emptyTitle")}
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
