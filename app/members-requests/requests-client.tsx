"use client"

import * as React from "react"
import {
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table"
import {
  KanbanSquare,
  LayoutGrid,
  ListFilter,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewMenu } from "@/components/ui/view-menu"
import { cn } from "@/lib/utils"

import { columns } from "./columns"
import { features } from "@/lib/table-features"
import { PRIORITY_META, STATUS_META, requests } from "./shared"
import { BoardView } from "./view-board"
import { CardView } from "./view-cards"
import { TableView } from "./view-table"

/**
 * Members Requests — view switcher + toolbar.
 *
 * Layout choice is the user's (table / board / cards) and persists per
 * browser. Below `lg` the table is unavailable and the choice falls back to
 * cards, per DESIGN.md §8.12.
 */

type ViewMode = "table" | "board" | "cards"

const VIEWS: {
  id: ViewMode
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** Table needs width; below lg it is replaced by cards. */
  desktopOnly?: boolean
}[] = [
  { id: "table", label: "Table", icon: Rows3, desktopOnly: true },
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "cards", label: "Cards", icon: LayoutGrid },
]

const STORAGE_KEY = "bajat-requests-view"

export function RequestsClient() {
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
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(
    {}
  )
  const [rowSelection, setRowSelection] = React.useState({})
  const [query, setQuery] = React.useState("")

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

  const table = useTable({
    features,
    data: requests,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: query,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setQuery,
    globalFilterFn: (row, _id, value: string) => {
      const q = value.toLowerCase()
      const r = row.original
      return (
        r.memberName.toLowerCase().includes(q) ||
        r.memberEmail.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.template.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q)
      )
    },
    getRowId: (r) => r.id,
  })

  const effectiveView: ViewMode =
    view === "table" && !isDesktop ? "cards" : view

  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string[]) ?? []
  const priorityFilter =
    (table.getColumn("priority")?.getFilterValue() as string[]) ?? []
  const activeFilters = statusFilter.length + priorityFilter.length
  const selectedCount = Object.keys(rowSelection).length

  const toggleFacet = (col: "status" | "priority", key: string) => {
    const column = table.getColumn(col)
    if (!column) return
    const current = (column.getFilterValue() as string[]) ?? []
    const next = current.includes(key)
      ? current.filter((v) => v !== key)
      : [...current, key]
    column.setFilterValue(next.length ? next : undefined)
  }

  const clearFilters = () => {
    table.resetColumnFilters()
    setQuery("")
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar — left group is the view switcher, right group the controls
          (§6.1). They are pushed apart with a gutter between. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View switcher — active tab is a surface chip (§6.5) */}
        <div className="flex items-center gap-0.5" role="tablist" aria-label="Layout">
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
                title={unavailable ? "Table needs a wider screen" : undefined}
                onClick={() => chooseView(v.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium",
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
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            )
          })}
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {/* Search — sunken fill, leading glyph (§6.7) */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-placeholder"
              strokeWidth={1.5}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search requests"
              aria-label="Search requests"
              className={cn(
                "h-8 w-full rounded-md bg-surface-sunken pl-8 pr-3 text-sm sm:w-56",
                "text-text placeholder:text-text-placeholder",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            />
          </div>

          <FacetMenu
            label="Status"
            icon={ListFilter}
            options={Object.entries(STATUS_META).map(([k, m]) => ({
              key: k,
              label: m.label,
            }))}
            selected={statusFilter}
            onToggle={(k) => toggleFacet("status", k)}
          />

          <FacetMenu
            label="Priority"
            icon={SlidersHorizontal}
            options={Object.entries(PRIORITY_META).map(([k, m]) => ({
              key: k,
              label: m.label,
            }))}
            selected={priorityFilter}
            onToggle={(k) => toggleFacet("priority", k)}
          />

          {/* View — column visibility + reordering (table only) */}
          {effectiveView === "table" && (
            <ViewMenu table={table} pinned={["select"]} />
          )}
        </div>
      </div>

      {/* Applied filter chips (§14.5) */}
      {(activeFilters > 0 || query) && (
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter.map((k) => (
            <FilterChip
              key={`s-${k}`}
              attribute="Status"
              value={STATUS_META[k as keyof typeof STATUS_META].label}
              onRemove={() => toggleFacet("status", k)}
            />
          ))}
          {priorityFilter.map((k) => (
            <FilterChip
              key={`p-${k}`}
              attribute="Priority"
              value={PRIORITY_META[k as keyof typeof PRIORITY_META].label}
              onRemove={() => toggleFacet("priority", k)}
            />
          ))}
          {query && (
            <FilterChip
              attribute="Search"
              value={query}
              onRemove={() => setQuery("")}
            />
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="h-7 rounded-sm px-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        </div>
      )}

      {/* Selection summary */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-background-subtle px-4 py-2.5">
          <span className="text-[13px] text-text">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() => setRowSelection({})}
            className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear selection
          </button>
        </div>
      )}

      {effectiveView === "table" && <TableView table={table} />}
      {effectiveView === "board" && <BoardView table={table} />}
      {effectiveView === "cards" && <CardView table={table} />}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Toolbar sub-parts
 * ------------------------------------------------------------------ */

function FacetMenu({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
}: {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  options: { key: string; label: string }[]
  selected: string[]
  onToggle: (key: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="default">
            <Icon className="size-4" strokeWidth={1.5} />
            {/* Two-tone label: muted attribute, full-contrast value (§6.6) */}
            <span className="hidden sm:inline">
              <span className="text-text-secondary">{label}</span>
              {selected.length > 0 && (
                <span className="ml-1 text-text">({selected.length})</span>
              )}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.key}
            checked={selected.includes(o.key)}
            onCheckedChange={() => onToggle(o.key)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Removable filter chip with a two-tone label (§14.5). */
function FilterChip({
  attribute,
  value,
  onRemove,
}: {
  attribute: string
  value: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-surface-sunken pl-2.5 pr-1.5 text-xs">
      <span className="text-text-muted">{attribute}:</span>
      <span className="font-medium text-text">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attribute} filter`}
        className="inline-flex size-4 items-center justify-center rounded-xs text-text-placeholder transition-colors hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3" strokeWidth={2} />
      </button>
    </span>
  )
}
