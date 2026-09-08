"use client"

import * as React from "react"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useTable,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table"
import { AlertCircle, LayoutGrid, Phone, Rows3, Search } from "lucide-react"

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
import { ResetMfaDialog } from "@/components/users/reset-mfa-dialog"
import { useAuthStore } from "@/features/auth/store"
import {
  useGetBranchUsers,
  useResetBranchUserMfa,
} from "@/features/branch-users/api"
import type { BranchUser } from "@/features/branch-users/types"
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

import { buildColumns, UserActions } from "./columns"
import { DeleteUserDialog } from "./delete-user-dialog"
import { EditBranchUserDialog } from "./user-dialog"
import { CardView } from "./view-cards"

/**
 * Branch Users — view switcher + toolbar.
 *
 * Same architecture as the other list screens. `/branch_user` reads
 * `search`, `name`, `phone` and the two date ranges — the organization and
 * branch columns render values but expose no filter input
 * (docs/ORG-BRANCH-MANAGEMENT-PAGES.md §6.1), so the toolbar keeps search, a
 * phone field and the created-at window.
 */

const SEARCH_DEBOUNCE_MS = 300
const COUNT_QUERY = { page: 1, pageSize: DEFAULT_PAGE_SIZE } as const

export function BranchUsersCount() {
  const query = useGetBranchUsers(COUNT_QUERY)
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

const STORAGE_KEY = "bajat-branch-users-view"

export function BranchUsersClient() {
  const t = useT()
  const authUser = useAuthStore((state) => state.user)
  const isAdmin = authUser?.type === "admin"

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

  const [phoneQuery, setPhoneQuery] = React.useState("")
  const phone = useDebounce(phoneDigits(phoneQuery), SEARCH_DEBOUNCE_MS)

  const [createdFrom, setCreatedFrom] = React.useState("")
  const [createdTo, setCreatedTo] = React.useState("")

  const [editing, setEditing] = React.useState<BranchUser | null>(null)

  /** The row open for *reading* — what clicking a row does (§8). */
  const shown = useRecordSheet<BranchUser>()

  const [resetting, setResetting] = React.useState<BranchUser | null>(null)
  const [deleting, setDeleting] = React.useState<BranchUser | null>(null)

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

  const filter = React.useMemo(
    () =>
      buildFilter({
        search,
        phone,
        createdAtRange: toInstantRange(createdFrom, createdTo),
      }),
    [search, phone, createdFrom, createdTo]
  )

  const {
    query: listQuery,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE })

  const usersQuery = useGetBranchUsers(listQuery, {
    placeholderData: keepPreviousData,
  })
  const data = React.useMemo(
    () => usersQuery.data?.data.data ?? [],
    [usersQuery.data]
  )

  const editingUser = React.useMemo(
    () => (editing ? (data.find((u) => u.id === editing.id) ?? editing) : null),
    [data, editing]
  )
  const resettingUser = React.useMemo(
    () => (resetting ? (data.find((u) => u.id === resetting.id) ?? resetting) : null),
    [data, resetting]
  )
  const deletingUser = React.useMemo(
    () => (deleting ? (data.find((u) => u.id === deleting.id) ?? deleting) : null),
    [data, deleting]
  )

  const pageInfo = React.useMemo(
    () => readPageInfo(usersQuery.data?.data),
    [usersQuery.data]
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
    () => buildColumns(t, setEditing, setResetting, setDeleting),
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

  const resetMfa = useResetBranchUserMfa({
    onSuccess: () => setResetting(null),
  })

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
      busy={usersQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearSheetFilters = () => {
    setPhoneQuery("")
    setCreatedFrom("")
    setCreatedTo("")
  }
  const sheetFilterCount =
    (phoneQuery.trim() ? 1 : 0) + (createdFrom || createdTo ? 1 : 0)

  const clearFilters = () => {
    clearSheetFilters()
    setQuery("")
  }

  const filtered = filter.length > 0

  const collapsibleFilters = (inSheet: boolean) => (
    <>
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

  const activeFilters: ActiveFilter[] = [
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

  const emptyTitle = filtered
    ? t("branchUsers.emptyFiltered")
    : t("branchUsers.emptyTitle")
  const emptyHint = filtered ? undefined : t("branchUsers.emptyHint")

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

          <FilterSheet
            className="lg:hidden"
            count={sheetFilterCount}
            onClear={clearSheetFilters}
          >
            {collapsibleFilters(true)}
          </FilterSheet>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto">
          <TextFilter
            icon={Search}
            value={query}
            onChange={setQuery}
            placeholder={t("branchUsers.searchPlaceholder")}
            label={t("branchUsers.searchLabel")}
            className="w-full lg:w-56"
          />

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {collapsibleFilters(false)}
            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <FilterChips filters={activeFilters} onClear={clearFilters} />

      {usersQuery.isError && hasRows && (
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
            onClick={() => usersQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {usersQuery.isPending ? (
        <LoadingRows />
      ) : usersQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("branchUsers.loadFailed")}
          onRetry={() => usersQuery.refetch()}
          retrying={usersQuery.isFetching}
        />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              onRowClick={shown.show}
              rowLabel={(user) => user.name}
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
                onResetMfa={setResetting}
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
        subtitle={shown.row?.branch?.name}
        footer={
          shown.row && (
            <UserActions
              user={shown.row}
              onEdit={shown.closeThen(setEditing)}
              onResetMfa={shown.closeThen(setResetting)}
              onDelete={shown.closeThen(setDeleting)}
            />
          )
        }
      />

      <EditBranchUserDialog
        user={editingUser}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ResetMfaDialog
        open={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
        subjectName={resettingUser?.name ?? ""}
        onConfirm={() => resettingUser && resetMfa.mutate(resettingUser.id)}
        pending={resetMfa.isPending}
        error={resetMfa.isError ? resetMfa.error : undefined}
        reset={resetMfa.reset}
        copy={{
          title: t("branchUsers.resetMfaTitle"),
          description: t("branchUsers.resetMfaDescription"),
          note: t("branchUsers.resetMfaNote"),
          action: t("branchUsers.resetMfaAction"),
          pending: t("branchUsers.resetMfaPending"),
          failed: t("branchUsers.resetMfaFailed"),
        }}
      />
      <DeleteUserDialog
        user={deletingUser}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
