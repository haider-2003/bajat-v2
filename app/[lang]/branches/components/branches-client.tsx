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
import { useAuthStore } from "@/features/auth/store"
import { useGetBranches } from "@/features/branches/api"
import type { Branch } from "@/features/branches/types"
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

import { BranchActions, buildColumns } from "./columns"
import { DeleteBranchDialog } from "./delete-branch-dialog"
import { EditBranchDialog } from "./branch-dialog"
import { CardView } from "./view-cards"

/**
 * Branches — view switcher + toolbar.
 *
 * Same architecture as the other list screens. `/branch` reads the org filter
 * as a **name** (`organization`), the same way `/node` does — so the toolbar's
 * organization control is a name-valued select, admin-only, and the matching
 * column is hidden for org-scoped accounts that would only see one name repeated
 * down the page.
 */

const SEARCH_DEBOUNCE_MS = 300
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const
const COUNT_QUERY = { page: 1, pageSize: DEFAULT_PAGE_SIZE } as const

export function BranchesCount() {
  const query = useGetBranches(COUNT_QUERY)
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

const STORAGE_KEY = "bajat-branches-view"

export function BranchesClient() {
  const t = useT()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.type === "admin"

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
      isAdmin ? ({} as ColumnVisibilityState) : { organization: false }
    )

  const [query, setQuery] = React.useState("")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  /** The organization's *name* — `/branch` filters by name here, not by id. */
  const [organization, setOrganization] = React.useState("")

  const [createdFrom, setCreatedFrom] = React.useState("")
  const [createdTo, setCreatedTo] = React.useState("")

  const [editing, setEditing] = React.useState<Branch | null>(null)

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<Branch>()

  const [deleting, setDeleting] = React.useState<Branch | null>(null)

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
        value: o.name,
        label: o.name,
      })),
    [organizationsQuery.data]
  )

  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        organization,
        createdAtRange: toInstantRange(createdFrom, createdTo),
      }),
    [search, organization, createdFrom, createdTo]
  )

  const {
    query: listQuery,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE })

  const branchesQuery = useGetBranches(listQuery, {
    placeholderData: keepPreviousData,
  })
  const data = React.useMemo(
    () => branchesQuery.data?.data.data ?? [],
    [branchesQuery.data]
  )

  const editingBranch = React.useMemo(() => {
    if (!editing) return null
    return data.find((branch) => branch.id === editing.id) ?? editing
  }, [data, editing])

  const deletingBranch = React.useMemo(() => {
    if (!deleting) return null
    return data.find((branch) => branch.id === deleting.id) ?? deleting
  }, [data, deleting])

  const pageInfo = React.useMemo(
    () => readPageInfo(branchesQuery.data?.data),
    [branchesQuery.data]
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
    () => buildColumns(t, setEditing, setDeleting),
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
      busy={branchesQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearFilters = () => {
    setQuery("")
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
    ? t("branches.emptyFiltered")
    : t("branches.emptyTitle")
  const emptyHint = filtered ? undefined : t("branches.emptyHint")

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
            placeholder={t("branches.searchPlaceholder")}
            label={t("branches.searchLabel")}
            className="w-full lg:w-56"
          />

          <div className="hidden items-center gap-2 lg:flex">
            <FilterMenu filters={filters} />
            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <AppliedFilters filters={filters} onClear={clearFilters} />

      {branchesQuery.isError && hasRows && (
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
            onClick={() => branchesQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {branchesQuery.isPending ? (
        <LoadingRows />
      ) : branchesQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("branches.loadFailed")}
          onRetry={() => branchesQuery.refetch()}
          retrying={branchesQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              onRowClick={shown.show}
              rowLabel={(branch) => branch.name}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
              footer={pagination}
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
            <BranchActions
              branch={shown.row}
              onEdit={shown.closeThen(setEditing)}
              onDelete={shown.closeThen(setDeleting)}
            />
          )
        }
      />

      <EditBranchDialog
        branch={editingBranch}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DeleteBranchDialog
        branch={deletingBranch}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
