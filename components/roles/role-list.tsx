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
  Rows3,
  Search,
} from "lucide-react"

import {
  AppliedFilters,
  DateRangeEditor,
  describeRange,
  type FilterDefinition,
  FilterMenu,
  TextFilter,
} from "@/components/filters"
import { DeleteRoleDialog } from "@/components/roles/delete-role-dialog"
import { EditRoleDialog } from "@/components/roles/role-dialog"
import { RoleCardView } from "@/components/roles/role-cards"
import { buildRoleColumns, RoleActions } from "@/components/roles/role-columns"
import { roleCopy } from "@/components/roles/role-copy"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import {
  TableRecordSheet,
  useRecordSheet,
} from "@/components/table/record-sheet"
import { TableView } from "@/components/table/table-view"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useGetRoles } from "@/features/roles/api"
import type { Role, RoleType } from "@/features/roles/types"
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

/**
 * The role list, shared by `/organizations/roles`, `/branches/roles` and
 * `/management/roles` — the three scoped views of one `/role` endpoint.
 *
 * Same architecture as the other list screens (docs/filtering-sorting-pagination.md):
 * server-driven rows, filters as query params, `useListQuery` owning the page,
 * `keepPreviousData` so paging doesn't blink.
 *
 * ### `type` is forced, not filtered
 *
 * Every request appends `{ field: "type", value: scope }` and it can never be
 * cleared — a branch-roles screen showing an admin role would offer an edit
 * that saves permissions the scope cannot hold. The editor forces the same
 * constant into its payload.
 *
 * ### Two views, not three
 *
 * There is no board: a role has no status to group by.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

export function RoleCount({ scope }: { scope: RoleType }) {
  const query = useGetRoles({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    filter: [{ field: "type", value: scope }],
  })
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

export function RoleList({ scope }: { scope: RoleType }) {
  const t = useT()
  const storageKey = `bajat-${scope}-roles-view`

  /**
   * Filters, sort, page and page size, remembered for the tab — so opening a
   * row and coming back lands on the list you left. See hooks/use-sticky-state.ts.
   */
  const listKey = `bajat-${scope}-roles`

  const [view, setView] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table"
    try {
      const saved = localStorage.getItem(storageKey) as ViewMode | null
      if (saved && VIEWS.some((v) => v.id === saved)) return saved
    } catch {
      // Ignore; the default view is fine.
    }
    return "table"
  })
  const [isDesktop, setIsDesktop] = React.useState(true)
  const [sorting, setSorting] = useStickyState<SortingState>(
    `${listKey}:sorting`,
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})

  const [query, setQuery] = useStickyState(`${listKey}:query`, "")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  const [createdFrom, setCreatedFrom] = useStickyState(
    `${listKey}:createdFrom`,
    ""
  )
  const [createdTo, setCreatedTo] = useStickyState(`${listKey}:createdTo`, "")

  const [editing, setEditing] = React.useState<Role | null>(null)

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<Role>()
  const [deleting, setDeleting] = React.useState<Role | null>(null)

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
      localStorage.setItem(storageKey, next)
    } catch {
      // Preference simply won't persist.
    }
  }

  /**
   * The list filter — search and a created-at window, plus the forced `type`.
   * `type` is a non-empty string so `buildFilter` always keeps it.
   */
  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        createdAtRange: toInstantRange(createdFrom, createdTo),
        type: scope,
      }),
    [search, createdFrom, createdTo, scope]
  )

  const {
    query: listQuery,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useListQuery(filter, {
    pageSize: DEFAULT_PAGE_SIZE,
    storageKey: listKey,
  })

  const rolesQuery = useGetRoles(listQuery, { placeholderData: keepPreviousData })
  const data = React.useMemo(
    () => rolesQuery.data?.data.data ?? [],
    [rolesQuery.data]
  )

  const editingRole = React.useMemo(() => {
    if (!editing) return null
    return data.find((role) => role.id === editing.id) ?? editing
  }, [data, editing])

  const deletingRole = React.useMemo(() => {
    if (!deleting) return null
    return data.find((role) => role.id === deleting.id) ?? deleting
  }, [data, deleting])

  const pageInfo = React.useMemo(
    () => readPageInfo(rolesQuery.data?.data),
    [rolesQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  const columns = React.useMemo(
    () => buildRoleColumns(t, setEditing, setDeleting),
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
      busy={rolesQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearFilters = () => {
    setQuery("")
    setCreatedFrom("")
    setCreatedTo("")
  }

  const filtered = Boolean(search || createdFrom || createdTo)

  /**
   * Every filter this screen offers, described once: the Filter menu lists
   * them, the chip row shows the set ones, and both open the same editor
   * (components/filters/filter-builder.tsx). Chip text is the *typed* value —
   * the chip is the editor's own label, so it moves with the keystroke.
   */
  const filters: FilterDefinition[] = [
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

  const emptyTitle = filtered
    ? t("roles.emptyFiltered")
    : t("roles.emptyTitle")
  const emptyHint = filtered ? undefined : t(roleCopy[scope].emptyHint)

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
            placeholder={t("roles.searchPlaceholder")}
            label={t("roles.searchLabel")}
            className="w-full lg:w-56"
          />

          <div className="hidden items-center gap-2 lg:flex">
            <FilterMenu filters={filters} />
            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <AppliedFilters filters={filters} onClear={clearFilters} />

      {rolesQuery.isError && hasRows && (
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
            onClick={() => rolesQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {rolesQuery.isPending ? (
        <LoadingRows />
      ) : rolesQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("roles.loadFailed")}
          error={rolesQuery.error}
          onRetry={() => rolesQuery.refetch()}
          retrying={rolesQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              onRowClick={shown.show}
              rowLabel={(role) => role.name}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
              footer={pagination}
            />
          )}

          {effectiveView === "cards" && (
            <>
              <RoleCardView
                table={table}
                onEdit={setEditing}
                onDelete={setDeleting}
                emptyTitle={emptyTitle}
                emptyHint={emptyHint}
              />
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
            <RoleActions
              role={shown.row}
              onEdit={shown.closeThen(setEditing)}
              onDelete={shown.closeThen(setDeleting)}
            />
          )
        }
      />

      <EditRoleDialog
        scope={scope}
        role={editingRole}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteRoleDialog
        role={deletingRole}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
