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
  FileStack,
  LayoutGrid,
  LayoutTemplate,
  RefreshCw,
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
  TextEditor,
  TextFilter,
} from "@/components/filters"
import { EmptyState } from "@/components/table/empty-state"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import { TableRecordSheet, useRecordSheet } from "@/components/table/record-sheet"
import { TableView } from "@/components/table/table-view"
import { SoftBadge } from "@/components/ui/data-bits"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useGetOrganizations } from "@/features/organizations/api"
import { useGetTemplateExports } from "@/features/templates/api"
import { exportStatusMeta } from "@/features/templates/display"
import type { TemplateExport } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import { Link } from "@/i18n/navigation"
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
import { formatText } from "@/utils/format"

import { createColumns, fileNameOf } from "./columns"
import { ExportActions } from "./export-actions"
import { CardView } from "./view-cards"

/**
 * Export History — the queue of export jobs
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §4).
 *
 * The same architecture as the other list screens: server-driven rows,
 * filters as top-level query params, `useListQuery` owning the page.
 *
 * ### The consumer side of one button
 *
 * A row here is *produced* by the Export action on a template card
 * (`GET /template/export/{id}`), which queues a job and returns at once.
 * The job runs server-side and, when it finishes, its `file` fills in — a
 * ZIP of an Excel sheet plus every attached image. This screen is where
 * that file is picked up. Nothing here creates, retries, cancels or
 * deletes one (§4.5).
 *
 * ### Freshness
 *
 * Nothing polls. The list refetches on mount with stale data, on window
 * focus (the React Query default), and when a filter or page changes — and
 * now also when an export is triggered, since that mutation invalidates
 * `["templateExport"]` (spec §9.8 fixed). For the case where a job finishes
 * while the screen is open, there is a Refresh control on the toolbar.
 *
 * ### Filters
 *
 * `search`, `organization_id`, `template_title`, `created_at_range[]` — the
 * four `GET /export` reads (§4.1), and nothing else.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/** The page-header count — every export, sharing the table's first query. */
const COUNT_QUERY = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  filter: buildFilter({}),
} as const

export function ExportsCount() {
  const query = useGetTemplateExports(COUNT_QUERY)
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

const STORAGE_KEY = "bajat-exports-view"

/**
 * Filters, sort, page and page size, remembered for the tab — so opening a
 * row and coming back lands on the list you left. See hooks/use-sticky-state.ts.
 */
const LIST_KEY = "bajat-exports"

export function ExportsClient() {
  const t = useT()

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

  const [templateQuery, setTemplateQuery] = useStickyState(
    `${LIST_KEY}:templateQuery`,
    ""
  )
  const templateTitle = useDebounce(templateQuery.trim(), SEARCH_DEBOUNCE_MS)

  const [createdFrom, setCreatedFrom] = useStickyState(
    `${LIST_KEY}:createdFrom`,
    ""
  )
  const [createdTo, setCreatedTo] = useStickyState(`${LIST_KEY}:createdTo`, "")

  const shown = useRecordSheet<TemplateExport>()

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
        templateTitle,
        organizationId,
        createdAtRange: toInstantRange(createdFrom, createdTo),
      }),
    [search, templateTitle, organizationId, createdFrom, createdTo]
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

  const exportsQuery = useGetTemplateExports(listQuery, {
    placeholderData: keepPreviousData,
  })
  const data = React.useMemo(
    () => exportsQuery.data?.data.data ?? [],
    [exportsQuery.data]
  )

  const pageInfo = React.useMemo(
    () => readPageInfo(exportsQuery.data?.data),
    [exportsQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

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

  /** The opened row, re-read from the current page so a finished job updates in place. */
  const shownRow = shown.row
    ? (data.find((row) => row.id === shown.row?.id) ?? shown.row)
    : null

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
      busy={exportsQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearFilters = () => {
    setQuery("")
    setOrganizationId("")
    setTemplateQuery("")
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
    {
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
      key: "created",
      label: t("exports.columns.created"),
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
            placeholder={t("exports.searchPlaceholder")}
            label={t("exports.searchLabel")}
            className="w-full lg:w-56"
          />

          <div className="hidden items-center gap-2 lg:flex">
            <FilterMenu filters={filters} />

            {/* Nothing polls, so a job that finishes while this is open is
                one click away rather than one focus change away. */}
            <button
              type="button"
              onClick={() => exportsQuery.refetch()}
              disabled={exportsQuery.isFetching}
              aria-label={t("common.refresh")}
              title={t("common.refresh")}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-text-muted",
                "transition-colors outline-none hover:bg-[rgba(0,0,0,0.04)] hover:text-text",
                "dark:hover:bg-[rgba(255,255,255,0.06)]",
                "focus-visible:ring-2 focus-visible:ring-ring disabled:text-text-placeholder"
              )}
            >
              <RefreshCw
                className={cn("size-4", exportsQuery.isFetching && "animate-spin")}
                strokeWidth={1.5}
              />
            </button>

            {effectiveView === "table" && <ViewMenu table={table} />}
          </div>
        </div>
      </div>

      <AppliedFilters filters={filters} onClear={clearFilters} />

      {exportsQuery.isError && hasRows && (
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
            onClick={() => exportsQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {exportsQuery.isPending ? (
        <LoadingRows />
      ) : exportsQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("exports.loadFailed")}
          error={exportsQuery.error}
          onRetry={() => exportsQuery.refetch()}
          retrying={exportsQuery.isFetching}
        />
      ) : !hasRows && !filtered ? (
        // "Nothing here yet" points at where exports come from, which is
        // not a button on this screen.
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16">
          <FileStack
            className="mb-4 size-6 text-text-placeholder"
            strokeWidth={1.4}
            aria-hidden
          />
          <EmptyState title={t("exports.emptyTitle")} hint={t("exports.emptyHint")} />
          <Link
            href="/id-issuance/templates"
            className="mt-5 rounded-sm text-[13px] font-medium text-text-muted underline-offset-4 outline-none hover:text-text hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("exports.goToTemplates")}
          </Link>
        </div>
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              emptyTitle={t("exports.emptyFiltered")}
              footer={pagination}
              onRowClick={shown.show}
              rowLabel={(row) =>
                t("exports.openLabel", { template: formatText(row.template?.title) })
              }
            />
          )}

          {effectiveView === "cards" && (
            <>
              <CardView
                table={table}
                emptyTitle={t("exports.emptyFiltered")}
                onOpen={shown.show}
              />
              <div className="overflow-hidden rounded-xl border border-border">
                {pagination}
              </div>
            </>
          )}
        </>
      )}

      {/* The row, in full. The storage URL itself is deliberately *not*
          shown: it is a pre-signed link two hundred characters long that
          nobody reads, and Copy link in the footer is how it is handed on. */}
      <TableRecordSheet
        table={table}
        row={shownRow}
        onOpenChange={shown.onOpenChange}
        title={formatText(shownRow?.template?.title)}
        subtitle={
          shownRow?.file?.trim()
            ? fileNameOf(shownRow.file.trim())
            : t("exports.notReadyHint")
        }
        aside={
          shownRow && (
            <SoftBadge
              tone={exportStatusMeta(t, shownRow.status, !!shownRow.file?.trim()).tone}
            >
              {exportStatusMeta(t, shownRow.status, !!shownRow.file?.trim()).label}
            </SoftBadge>
          )
        }
        footer={shownRow && <ExportActions row={shownRow} />}
      />

      <p className="text-xs text-text-placeholder">{t("exports.readOnlyNote")}</p>
    </div>
  )
}
