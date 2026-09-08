"use client"

import * as React from "react"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useTable,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table"
import { AlertCircle, Building2, LayoutGrid, Rows3, Search, User } from "lucide-react"

import {
  DateRangeFilter,
  describeRange,
  FilterChips,
  FilterSheet,
  SelectFilter,
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
import { useGetApiKeys } from "@/features/api-keys/api"
import type { ApiKey } from "@/features/api-keys/types"
import { useAuthStore } from "@/features/auth/store"
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

import { RenameApiKeyDialog } from "./api-key-dialog"
import { ApiKeyActions, createColumns } from "./columns"
import { DeleteApiKeyDialog } from "./delete-api-key-dialog"
import { CardView } from "./view-cards"

/**
 * API keys — view switcher + toolbar.
 *
 * The same architecture as the other list screens: server-driven rows, filters
 * as top-level query params, `useListQuery` owning the page, `keepPreviousData`
 * so paging doesn't blink. See docs/filtering-sorting-pagination.md.
 *
 * Rows come from `GET /access_key`, **paged and filtered by the server**
 * (docs/CRUD-MIGRATION-REFERENCE.md §1.2).
 *
 * ### Two views, not three
 *
 * There is no board. A board groups by a status, and a key has none — it
 * exists, or it has been deleted, which is also the only revocation.
 *
 * ### The secret is not searchable
 *
 * `/access_key` reads `search`, `name`, `organization`, `user` and the two date
 * windows — no filter over the key itself. That is the right contract and it
 * is left alone: pasting a leaked secret into a filter box would put it in the
 * URL, the browser history and every proxy log on the way.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/** One page of 100 is the whole list in practice, and it is cached app-wide. */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

/**
 * The page-header count. Deliberately the **unfiltered** total, and pinned to
 * the default query so it shares the table's first cache entry.
 */
const COUNT_QUERY = { page: 1, pageSize: DEFAULT_PAGE_SIZE } as const

export function ApiKeysCount() {
  const query = useGetApiKeys(COUNT_QUERY)
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

const STORAGE_KEY = "bajat-api-keys-view"

export function ApiKeysClient() {
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
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>(() =>
      // Hidden rather than dropped from the column list, so it stays in the
      // View menu: an org-scoped account sees one organization, and a column
      // repeating one name down the page is width spent on nothing.
      isAdmin ? ({} as ColumnVisibilityState) : { organization: false }
    )

  // Each pair is "what the field shows" and "what the server is asked for" —
  // the second trailing the first by a debounce.
  const [query, setQuery] = React.useState("")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [userQuery, setUserQuery] = React.useState("")
  const createdBy = useDebounce(userQuery.trim(), SEARCH_DEBOUNCE_MS)

  /** The organization's *name* — `/access_key` filters by name, not by id. */
  const [organization, setOrganization] = React.useState("")

  // The window the key was created in, held as two `yyyy-mm-dd` days — what
  // the calendar selects, with no timezone attached.
  const [createdFrom, setCreatedFrom] = React.useState("")
  const [createdTo, setCreatedTo] = React.useState("")

  /** The row queued for each dialog, held as a row rather than an id. */
  const [renaming, setRenaming] = React.useState<ApiKey | null>(null)

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<ApiKey>()

  const [deleting, setDeleting] = React.useState<ApiKey | null>(null)

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
        // `/access_key` reads `organization` as a **name**, not an id — see
        // §3.2's note that the modules disagree about this.
        value: o.name,
        label: o.name,
      })),
    [organizationsQuery.data]
  )

  /** Everything this screen filters on, keyed by the field name it is sent as. */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        // The endpoint's field is `user`, matched against the creator's name.
        user: createdBy,
        organization,
        createdAtRange: toInstantRange(createdFrom, createdTo),
      }),
    [search, createdBy, organization, createdFrom, createdTo]
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
  const keysQuery = useGetApiKeys(listQuery, { placeholderData: keepPreviousData })
  const data = React.useMemo(
    () => keysQuery.data?.data.data ?? [],
    [keysQuery.data]
  )

  /**
   * The row each dialog is showing, re-read from the current rows.
   *
   * The snapshot is the fallback, so the dialog survives its row disappearing
   * mid-edit — but a live row is preferred, so a rename made elsewhere is not
   * shown stale in the confirmation.
   */
  const renamingKey = React.useMemo(() => {
    if (!renaming) return null
    return data.find((row) => row.id === renaming.id) ?? renaming
  }, [data, renaming])

  const deletingKey = React.useMemo(() => {
    if (!deleting) return null
    return data.find((row) => row.id === deleting.id) ?? deleting
  }, [data, deleting])

  // A missing total means "unknown", never "zero".
  const pageInfo = React.useMemo(
    () => readPageInfo(keysQuery.data?.data),
    [keysQuery.data]
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

  // Keyed on `t` as well as the handlers: the headers and the View menu's
  // column names are translated, so the list is language-dependent.
  const columns = React.useMemo(
    () => createColumns(t, setRenaming, setDeleting),
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
      onPageSizeChange={setPageSize}
      busy={keysQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearSheetFilters = () => {
    setUserQuery("")
    setOrganization("")
    setCreatedFrom("")
    setCreatedTo("")
  }

  /** The badge on the collapsed trigger — the typed values, not the debounced. */
  const sheetFilterCount =
    (userQuery.trim() ? 1 : 0) +
    (organization ? 1 : 0) +
    // The window counts once, however many of its two ends are set.
    (createdFrom || createdTo ? 1 : 0)

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
      {/* Who made it. The question this answers is the one asked before a
          delete: whose integration is this, and are they still here. */}
      <TextFilter
        icon={User}
        value={userQuery}
        onChange={setUserQuery}
        placeholder={t("apiKeys.columns.createdBy")}
        label={t("apiKeys.columns.createdBy")}
        className={inSheet ? "w-full" : "w-40"}
      />

      {isAdmin && (
        <SelectFilter
          icon={Building2}
          label={t("filters.attributes.organization")}
          options={organizationOptions}
          value={organization}
          onChange={setOrganization}
          loading={organizationsQuery.isPending}
          className={inSheet ? "w-full" : undefined}
        />
      )}

      {/* Either end alone is a question somebody asks of this list: "issued
          since Monday" catches a key created during an incident; "issued
          before January" is what has been live long enough to be worth
          rotating. */}
      <DateRangeFilter
        label={t("filters.attributes.created")}
        from={createdFrom}
        to={createdTo}
        onFromChange={setCreatedFrom}
        onToChange={setCreatedTo}
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
    ...(createdBy
      ? [
          {
            key: "user",
            attribute: t("apiKeys.columns.createdBy"),
            value: createdBy,
            onRemove: () => setUserQuery(""),
          },
        ]
      : []),
    ...(organization
      ? [
          {
            key: "organization",
            attribute: t("filters.attributes.organization"),
            value: organization,
            onRemove: () => setOrganization(""),
          },
        ]
      : []),
    // One chip per window, not per end: the pair is a single filter.
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
   * No keys at all is the normal state for an organization that does not run
   * an integration, so "no rows" needs two readings here and the default "try
   * clearing a filter" is wrong for one of them.
   */
  const emptyTitle = filtered ? t("apiKeys.emptyFiltered") : t("apiKeys.emptyTitle")
  const emptyHint = filtered ? undefined : t("apiKeys.emptyHint")

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
            placeholder={t("apiKeys.searchPlaceholder")}
            label={t("apiKeys.searchLabel")}
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
          Once rows are on screen an error becomes a strip above them. */}
      {keysQuery.isError && hasRows && (
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
            onClick={() => keysQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {keysQuery.isPending ? (
        <LoadingRows />
      ) : keysQuery.isError && !hasRows ? (
        /* A credential list that fails to load must not read as an empty one:
           "no integration can reach us" and "we could not find out" are
           different answers, and this screen is opened to revoke something. */
        <LoadFailed
          title={t("apiKeys.loadFailed")}
          onRetry={() => keysQuery.refetch()}
          retrying={keysQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              onRowClick={shown.show}
              rowLabel={(apiKey) => apiKey.name}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
              footer={pagination}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
                onRename={setRenaming}
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

      <TableRecordSheet
        table={table}
        row={shown.row}
        onOpenChange={shown.onOpenChange}
        title={shown.row?.name}
        footer={
          shown.row && (
            <ApiKeyActions
              apiKey={shown.row}
              onRename={shown.closeThen(setRenaming)}
              onDelete={shown.closeThen(setDeleting)}
            />
          )
        }
      />

      {/* Mounted once, not once per row: thirty rows each holding a `Dialog` is
          thirty portals waiting to be opened. */}
      <RenameApiKeyDialog
        apiKey={renamingKey}
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
      />
      <DeleteApiKeyDialog
        apiKey={deletingKey}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
