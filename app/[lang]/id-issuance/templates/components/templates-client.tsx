"use client"

import * as React from "react"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useTable,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table"
import { Link } from "@/i18n/navigation"
import {
  AlertCircle,
  Building2,
  LayoutGrid,
  LayoutTemplate,
  Plus,
  Rows3,
  Search,
} from "lucide-react"

import {
  FilterChips,
  FilterSheet,
  SelectFilter,
  SHEET_CONTROL,
  TextFilter,
  type ActiveFilter,
} from "@/components/filters"
import { EmptyState } from "@/components/table/empty-state"
import { LoadFailed, LoadingRows } from "@/components/table/load-states"
import { TableView } from "@/components/table/table-view"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/ui/pagination"
import { ViewMenu } from "@/components/ui/view-menu"
import { useGetOrganizations } from "@/features/organizations/api"
import { useGetTemplates } from "@/features/templates/api"
import type { Template } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/translate"
import { useDebounce } from "@/hooks/use-debounce"
import { useListQuery } from "@/hooks/use-list-query"
import { features } from "@/lib/table-features"
import { cn } from "@/lib/utils"
import type { BaseQuery } from "@/types/api"
import { buildFilter } from "@/utils/api/filters"
import { readPageInfo } from "@/utils/api/pagination"
import { DEFAULT_PAGE_SIZE } from "@/utils/constants"

import { createColumns } from "./columns"
import { IssueIdSheet } from "./issue-id-sheet"
import {
  CloneTemplateDialog,
  DeleteTemplateDialog,
  ResetSequencesDialog,
  TemplatePreviewDialog,
} from "./template-dialogs"
import type { TemplateActionHandlers } from "./template-actions"
import { GalleryView, LoadingGallery } from "./view-gallery"

/**
 * Templates — the card designs an identity is issued from.
 *
 * The same architecture as the other list screens: server-driven rows, filters
 * as top-level query params, `useListQuery` owning the page, `keepPreviousData`
 * so paging doesn't blink. See docs/filtering-sorting-pagination.md.
 *
 * ### The gallery is the default, and that is the point of the screen
 *
 * Every other list here opens as a table. This one opens as a grid of card
 * faces, because the thing being listed *is* an image — see the note on
 * `GalleryView`. The table is the second view, for when the question is "which
 * of these is disabled" rather than "which of these is the blue one".
 *
 * ### Two filters, because the endpoint has two
 *
 * `GET /template` accepts `page`, `per_page`, `search` and `organization_id`,
 * verified against docs/identities-api.postman_collection.json. **There is no
 * status filter**, and adding an `is_enabled` control would be the silent
 * failure docs/filtering-sorting-pagination.md §6 describes: the parameter goes
 * out, nothing rejects it, and the list comes back unfiltered while the chip
 * above it claims otherwise. Filtering the current page in the browser instead
 * is worse — the pager would still count the rows the server sent, so "10 of
 * 120" would sit under six cards.
 *
 * `organizationId` is **singular** here, like the printer screen and unlike
 * `/member`: the endpoint reads one id, so this is a single-select.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * The page-header count. Deliberately the **unfiltered** total, and pinned to
 * the default query so it shares the list's first cache entry instead of firing
 * a second request: a page title should say how much exists, not how much
 * survived the current filter — the pagination bar covers that.
 */
const COUNT_QUERY: BaseQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  // `filter: []` is not decoration. `useListQuery` always puts a `filter` key
  // on its query, and React Query hashes the whole object — so a count query
  // without one is a *different* key and a second request, not a shared entry.
  filter: [],
}

/**
 * The organization facet's source list. Module-level and frozen so it is one
 * stable cache key rather than a new object every render — and the same key the
 * other list screens use, so they share one cached response.
 */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

export function TemplatesCount() {
  const query = useGetTemplates(COUNT_QUERY)
  const total = readPageInfo(query.data?.data).total

  if (query.isPending) return <span className="text-text-placeholder">—</span>
  return <>{total ?? query.data?.data.data?.length ?? 0}</>
}

type ViewMode = "gallery" | "table"

const VIEWS: {
  id: ViewMode
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** Table needs width; below lg it is replaced by the gallery. */
  desktopOnly?: boolean
}[] = [
  { id: "gallery", labelKey: "views.gallery", icon: LayoutGrid },
  { id: "table", labelKey: "views.table", icon: Rows3, desktopOnly: true },
]

const STORAGE_KEY = "bajat-templates-view"

/**
 * The screen before it has ever had a template on it.
 *
 * A CTA rather than a shrug: the only thing anyone can do here is open the
 * editor, so the panel says what a template *is* and points at it.
 */
function FirstRun() {
  const t = useT()

  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16">
      <LayoutTemplate
        className="mb-4 size-6 text-text-placeholder"
        strokeWidth={1.4}
        aria-hidden
      />
      <EmptyState
        title={t("templates.noneYet")}
        hint={t("templates.noneYetHint")}
      />
      <Button
        variant="outline"
        className="mt-5"
        nativeButton={false}
        render={<Link href="/id-issuance/templates/new" />}
      >
        <Plus data-icon="inline-start" strokeWidth={1.75} />
        {t("templates.new")}
      </Button>
    </div>
  )
}

export function TemplatesClient() {
  const t = useT()
  // Lazy initialiser rather than an effect: the saved view is read once, and
  // reading it during the first render avoids a flash of the default layout.
  // Guarded for SSR, where `localStorage` does not exist.
  const [view, setView] = React.useState<ViewMode>(() => {
    if (typeof window === "undefined") return "gallery"
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
      if (saved && VIEWS.some((v) => v.id === saved)) return saved
    } catch {
      // Ignore; the default view is fine.
    }
    return "gallery"
  })
  const [isDesktop, setIsDesktop] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})

  /** One organization id, as a string. `""` means every organization. */
  const [organizationId, setOrganizationId] = React.useState("")

  // "What the field shows" and "what the server is asked for" — the second
  // trailing the first by a debounce.
  const [query, setQuery] = React.useState("")
  const search = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)

  /** Which template each dialog is about. `null` closes it. */
  const [previewed, setPreviewed] = React.useState<Template | null>(null)
  const [issuing, setIssuing] = React.useState<Template | null>(null)
  const [cloning, setCloning] = React.useState<Template | null>(null)
  const [resetting, setResetting] = React.useState<Template | null>(null)
  const [deleting, setDeleting] = React.useState<Template | null>(null)

  // Track the lg breakpoint so the table can fall back to the gallery (§8.12).
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

  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY)
  const organizations = React.useMemo(
    () => organizationsQuery.data?.data.data ?? [],
    [organizationsQuery.data]
  )

  /** `{ value, label }` is the shape `SelectFilter` reads a label out of. */
  const organizationOptions = React.useMemo(
    () => organizations.map((o) => ({ value: String(o.id), label: o.name })),
    [organizations]
  )

  const filter = React.useMemo(
    () => buildFilter({ search, organizationId }),
    [search, organizationId]
  )

  const effectiveView: ViewMode = view === "table" && !isDesktop ? "gallery" : view

  // Page state lives with the filters: `useListQuery` derives page 1 whenever
  // the filter set or the page size changes, so no control here has to remember
  // to reset it.
  //
  // The size is the app-wide default in both views rather than one figure for
  // the grid and another for the table. Two reasons: "page 3" has to mean the
  // same rows whichever view you are in (utils/constants.ts), and the pager's
  // size picker only offers `PAGE_SIZE_OPTIONS` — a size outside that list
  // leaves the `<select>` displaying a number it is not actually using.
  const {
    query: listQuery,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useListQuery(filter, { pageSize: DEFAULT_PAGE_SIZE })

  // `useGetList` hands back the whole Axios response, so rows sit two `data`
  // levels down. `keepPreviousData` is what makes paging work at all: every
  // page is a new query key, so without it `data` would be undefined for the
  // whole trip and the count, the total and the page range would all blink to
  // zero between pages.
  const templatesQuery = useGetTemplates(listQuery, {
    placeholderData: keepPreviousData,
  })
  const data = React.useMemo(
    () => templatesQuery.data?.data.data ?? [],
    [templatesQuery.data]
  )

  /**
   * The template a dialog is open on, re-read from the current rows.
   *
   * Held as a row rather than an id so the dialog still has something to render
   * during a refetch — but read back through the fresh list, because that is
   * what mints new artwork URLs. Falls back to the captured copy when the row
   * has left the page (a filter changed under it, or it was just deleted).
   */
  const liveRow = React.useCallback(
    (held: Template | null) =>
      held ? (data.find((t) => t.id === held.id) ?? held) : null,
    [data]
  )

  const pageInfo = React.useMemo(
    () => readPageInfo(templatesQuery.data?.data),
    [templatesQuery.data]
  )
  const { total, perPage } = pageInfo

  const lastPage =
    pageInfo.lastPage ??
    (total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize)))

  /**
   * The only way `page` changes. Clamping in the handler rather than during
   * render: setting state while rendering re-runs the component immediately, so
   * any moment the total read low — a not-yet-loaded page, a placeholder, a
   * failed fetch — the clamp would fight the click and snap back to page 1.
   */
  const goToPage = (next: number) => {
    const highest = lastPage ?? next
    setPage(Math.min(Math.max(1, next), Math.max(1, highest)))
  }

  const handlers: TemplateActionHandlers = React.useMemo(
    () => ({
      onPreview: setPreviewed,
      onIssue: setIssuing,
      onDuplicate: setCloning,
      onResetSequences: setResetting,
      onDelete: setDeleting,
    }),
    []
  )

  // Keyed on `t` too: the headers and the View menu's column names are
  // translated, so the list is language-dependent.
  const columns = React.useMemo(
    () => createColumns(t, handlers),
    [t, handlers]
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

  const pagination = (
    <Pagination
      page={page}
      pageSize={pageSize}
      rowCount={data.length}
      total={total}
      lastPage={lastPage}
      perPage={perPage}
      onPageChange={goToPage}
      // No `setPage(1)` alongside it: row 30 of 12-per-page is not row 30 of
      // 100-per-page, and `useListQuery` already treats the size as part of
      // what the page number is valid for.
      onPageSizeChange={setPageSize}
      // Deliberately not disabled while fetching: with the previous page still
      // on screen the controls stay meaningful.
      busy={templatesQuery.isFetching}
      className={effectiveView === "table" ? undefined : "border-t-0"}
    />
  )

  const clearSheetFilters = () => setOrganizationId("")
  const sheetFilterCount = organizationId ? 1 : 0

  const clearFilters = () => {
    clearSheetFilters()
    setQuery("")
  }

  /**
   * The controls that collapse into the sheet below `lg`. One definition
   * rendered into two layouts rather than two copies — the only difference
   * between them is how wide the trigger is.
   */
  const collapsibleFilters = (inSheet: boolean) => (
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
  )

  /**
   * The applied-filter row. Built from the *debounced* values, not the raw
   * inputs, so a chip never claims a filter the server has not been asked for.
   */
  const activeFilters: ActiveFilter[] = [
    ...(organizationId
      ? [
          {
            key: "organization",
            attribute: t("filters.attributes.organization"),
            value:
              organizationOptions.find((o) => o.value === organizationId)
                ?.label ?? organizationId,
            onRemove: () => setOrganizationId(""),
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
          {/* Nothing here resets the page — `useListQuery` derives that from
              the filter set changing. */}
          <TextFilter
            icon={Search}
            value={query}
            onChange={setQuery}
            placeholder={t("templates.searchPlaceholder")}
            label={t("templates.searchPlaceholder")}
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
          error becomes a strip above them, so the list and its pager stay put
          instead of vanishing and looking like the click did nothing. */}
      {templatesQuery.isError && hasRows && (
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
            onClick={() => templatesQuery.refetch()}
            className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {templatesQuery.isPending ? (
        // The skeleton is the shape of what is coming, so it has to follow the
        // view — a grid of card frames where a grid is loading, rows where
        // rows are (§8.11).
        effectiveView === "gallery" ? (
          <LoadingGallery />
        ) : (
          <LoadingRows />
        )
      ) : templatesQuery.isError && !hasRows ? (
        <LoadFailed
          title={t("templates.loadFailed")}
          onRetry={() => templatesQuery.refetch()}
          retrying={templatesQuery.isFetching}
        />
      ) : !hasRows && activeFilters.length === 0 ? (
        // "Nothing here yet" and "nothing matched" are different states and
        // want different words. §8.10's empty state assumes a filter to clear;
        // an organization with no templates has nothing to clear and needs the
        // way in instead.
        <FirstRun />
      ) : (
        <>
          {effectiveView === "table" && (
            <TableView
              table={table}
              emptyTitle={t("templates.emptyTitle")}
              footer={pagination}
              onRowClick={setPreviewed}
              rowLabel={(template) =>
                t("templates.previewLabel", { title: template.title })
              }
            />
          )}

          {effectiveView === "gallery" && (
            <>
              <GalleryView table={table} handlers={handlers} />

              {/* The grid has no container of its own, so the bar gets one —
                  minus the top border it would double up on. */}
              <div className="overflow-hidden rounded-xl border border-border">
                {pagination}
              </div>
            </>
          )}
        </>
      )}

      {/* Mounted once, not once per row: thirty rows each holding a `Dialog` is
          thirty portals waiting to be opened. */}
      <TemplatePreviewDialog
        template={liveRow(previewed)}
        open={previewed !== null}
        onOpenChange={(open) => !open && setPreviewed(null)}
        onRefresh={() => templatesQuery.refetch()}
        refreshing={templatesQuery.isFetching}
      />
      {/* The one sheet on this screen, and the reason it is a sheet: issuing
          happens several times in a sitting, and the gallery stays behind it
          rather than being navigated away from. */}
      <IssueIdSheet
        template={liveRow(issuing)}
        open={issuing !== null}
        onOpenChange={(open) => !open && setIssuing(null)}
      />
      <CloneTemplateDialog
        template={liveRow(cloning)}
        open={cloning !== null}
        onOpenChange={(open) => !open && setCloning(null)}
      />
      <ResetSequencesDialog
        template={liveRow(resetting)}
        open={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
      />
      <DeleteTemplateDialog
        template={liveRow(deleting)}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}
