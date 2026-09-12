"use client"

import * as React from "react"
import { ChevronLeft, ListFilter, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The add-a-filter pattern — DESIGN.md §12.8 and §14.5.
 *
 * ### Why a second kit
 *
 * The toolbar controls in this folder (`FacetFilter`, `SelectFilter`,
 * `TextFilter`, `DateRangeFilter`) each take a permanent slot on the bar
 * whether or not anything is set. That is fine for a screen with three
 * filters and unworkable for one with ten: the Requests ledger was carrying
 * twelve chips plus search and View on a 32px row, the two date windows
 * alone costing four of them.
 *
 * §12.8 describes the alternative: one **Filter** button opening "a plain
 * 32px-item list" of attributes, where "choosing an item opens the next
 * step" — the editor for that attribute. What has been set then renders
 * *outside* the menu as §14.5's removable chips, and the chip row "ends with
 * a ghost `+ Add filter` and a ghost `Clear`". An untouched attribute costs
 * nothing; a set one costs one chip, and clicking the chip reopens its
 * editor.
 *
 * ### The screen still owns the state
 *
 * Nothing here holds a filter value. A screen describes each filter once as
 * a `FilterDefinition` — its label, the text its chip should show (or
 * `undefined` when unset), the editor that changes it, and how to clear it —
 * and the same array feeds both `FilterMenu` (the trigger) and
 * `AppliedFilters` (the chip row). One definition, two surfaces, so a filter
 * cannot exist in the menu and go missing from the row.
 *
 * ### Editors are ordinary components
 *
 * `editor` is whatever the screen passes; the ready-made ones live in
 * `filter-editors.tsx`. They are rendered inside a `Popover`, not a `Menu`,
 * so text and number inputs work in them (see popover.tsx). An editor that
 * wants to dismiss the popup after a pick — a single-select, a text field on
 * Enter — reads `useFilterEditor().close`.
 *
 * ### One popover at a time, two anchors
 *
 * The menu's popover does two steps (list → editor) anchored to the toolbar
 * button; a chip's popover does the editor alone, anchored to the chip. They
 * are separate `Popover` roots that render the same `editor` node, which is
 * simpler than one floating editor that has to be re-anchored.
 */

export type FilterDefinition = {
  /** React key, and the field this filter stands for. */
  key: string
  /** The attribute name — "Status", "Issued". Muted on the chip. */
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /**
   * The chip's full-contrast half — "Approved", "1 May – 12 May". `undefined`
   * means unset: no chip, and the attribute reads plain in the menu.
   */
  value?: string
  /** The popover body that edits the value. */
  editor: React.ReactNode
  onClear: () => void
}

/** What an editor may ask of the popover it is rendered in. */
const FilterEditorContext = React.createContext<{ close: () => void } | null>(
  null
)

export function useFilterEditor() {
  const ctx = React.useContext(FilterEditorContext)
  if (!ctx) {
    throw new Error("useFilterEditor must be used inside a filter editor popover")
  }
  return ctx
}

/**
 * The popover panel width. Wide enough for a month grid to open from the
 * date editor's fields without the inner popover overhanging the outer one.
 */
const PANEL = "w-64"

/** §12.8's 32px list row — 44px below `lg` for touch (§18.7). */
const ROW = cn(
  "flex h-11 w-full items-center gap-2 rounded-md px-2 text-sm lg:h-8",
  "text-text outline-none transition-colors duration-120",
  "hover:bg-[rgba(0,0,0,0.04)] focus-visible:bg-[rgba(0,0,0,0.04)]",
  "dark:hover:bg-[rgba(255,255,255,0.045)] dark:focus-visible:bg-[rgba(255,255,255,0.045)]"
)

/**
 * The trigger — the toolbar's **Filter** button, or the chip row's ghost
 * **+ Add filter** — and the two-step popover behind it.
 */
export function FilterMenu({
  filters,
  appearance = "toolbar",
  className,
}: {
  filters: FilterDefinition[]
  /**
   * `toolbar` is the §6.6 outline button with a count; `inline` is §14.5's
   * ghost `+ Add filter` at the end of the chip row.
   */
  appearance?: "toolbar" | "inline"
  className?: string
}) {
  const t = useT()
  const [open, setOpen] = React.useState(false)
  /** The attribute whose editor is showing; `null` is the list step. */
  const [active, setActive] = React.useState<string | null>(null)
  const editorRef = React.useRef<HTMLDivElement>(null)

  const applied = filters.filter((f) => f.value !== undefined).length
  const current = filters.find((f) => f.key === active) ?? null

  const handleOpenChange = (next: boolean) => {
    // Reset on *open*, not close: clearing during close would swap the
    // editor for the list mid-animation.
    if (next) setActive(null)
    setOpen(next)
  }

  // Moving from the list to an editor is not a re-open, so the popover does
  // not move focus for us; land it on the editor's first control.
  React.useLayoutEffect(() => {
    if (!active) return
    const first = editorRef.current?.querySelector<HTMLElement>(
      "input, [role='option'], button:not([data-back])"
    )
    first?.focus()
  }, [active])

  const close = React.useCallback(() => setOpen(false), [])
  const editorApi = React.useMemo(() => ({ close }), [close])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          appearance === "toolbar" ? (
            <Button variant="outline" size="default" className={className}>
              <ListFilter className="size-4" strokeWidth={1.5} />
              <span>{t("filters.title")}</span>
              {/* §6.6's two-tone: the count is the value beside the
                  attribute. Read out as a sentence rather than a bare
                  number. */}
              {applied > 0 && (
                <>
                  <span aria-hidden className="tabular-nums">
                    {applied}
                  </span>
                  <span className="sr-only">
                    {t("filters.appliedCount", { count: applied })}
                  </span>
                </>
              )}
            </Button>
          ) : (
            <button
              type="button"
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-sm px-2 text-[13px] font-medium",
                "text-text-secondary transition-colors hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                className
              )}
            >
              <Plus className="size-3.5" strokeWidth={2} />
              {t("filters.add")}
            </button>
          )
        }
      />

      {/* The toolbar button hangs its panel off its end edge like the other
          toolbar menus; the inline one opens under its own start. */}
      <PopoverContent
        align={appearance === "toolbar" ? "end" : "start"}
        className={cn(PANEL, "p-1")}
      >
        {current === null ? (
          <div aria-label={t("filters.title")} className="flex flex-col">
            {filters.map((filter) => {
              const Icon = filter.icon
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActive(filter.key)}
                  className={ROW}
                >
                  <Icon className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
                  <span className="truncate">{filter.label}</span>
                  {/* Already set: show what to, so the list doubles as a
                      summary and picking it reads as "edit", not "add". */}
                  {filter.value !== undefined && (
                    <span className="ms-auto max-w-24 truncate text-xs text-text-muted">
                      {filter.value}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div ref={editorRef} className="flex flex-col">
            <div className="flex items-center gap-1 border-b border-border pb-1">
              <button
                type="button"
                data-back
                onClick={() => setActive(null)}
                aria-label={t("common.back")}
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
                  "text-text-secondary transition-colors hover:text-text",
                  "hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.045)]",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <ChevronLeft data-flip-rtl className="size-4" strokeWidth={1.5} />
              </button>
              <span className="truncate text-[13px] font-medium text-text">
                {current.label}
              </span>
            </div>
            <FilterEditorContext.Provider value={editorApi}>
              <div className="pt-1">{current.editor}</div>
            </FilterEditorContext.Provider>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The applied-filter row (§14.5) — one chip per set filter, each opening its
 * editor, then `+ Add filter` and `Clear`.
 *
 * Renders nothing when nothing is set, so a screen drops it in unguarded.
 *
 * ### A chip survives its own editing
 *
 * Presence is keyed on `value`, except for the chip whose editor is open:
 * that one stays until the popover closes. Otherwise backspacing a text
 * filter to empty would unmount the chip — and the popover anchored to it —
 * under the caret.
 */
export function AppliedFilters({
  filters,
  onClear,
}: {
  filters: FilterDefinition[]
  onClear: () => void
}) {
  const t = useT()
  const [editing, setEditing] = React.useState<string | null>(null)
  const close = React.useCallback(() => setEditing(null), [])
  const editorApi = React.useMemo(() => ({ close }), [close])

  const applied = filters.filter(
    (f) => f.value !== undefined || f.key === editing
  )

  if (applied.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {applied.map((filter) => (
        <Popover
          key={filter.key}
          open={editing === filter.key}
          onOpenChange={(next) => setEditing(next ? filter.key : null)}
        >
          <span className="inline-flex h-7 items-center rounded-sm border border-border bg-surface-sunken text-xs">
            <PopoverTrigger
              aria-label={t("filters.editFilter", { attribute: filter.label })}
              className={cn(
                "inline-flex h-full items-center gap-1.5 rounded-s-sm ps-2.5 pe-1.5",
                "outline-none transition-colors",
                "hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.045)]",
                "focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <span className="text-text-muted">{filter.label}:</span>
              <span className="max-w-48 truncate font-medium text-text">
                {filter.value ?? "…"}
              </span>
            </PopoverTrigger>
            <button
              type="button"
              onClick={filter.onClear}
              aria-label={t("filters.removeFilter", { attribute: filter.label })}
              className={cn(
                "inline-flex h-full items-center justify-center rounded-e-sm pe-1.5 ps-0.5",
                "text-text-placeholder transition-colors hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <X className="size-3" strokeWidth={2} />
            </button>
          </span>

          <PopoverContent align="start" className={cn(PANEL, "p-1")}>
            <div className="border-b border-border px-2 pb-1.5 pt-0.5 text-[13px] font-medium text-text">
              {filter.label}
            </div>
            <FilterEditorContext.Provider value={editorApi}>
              <div className="pt-1">{filter.editor}</div>
            </FilterEditorContext.Provider>
          </PopoverContent>
        </Popover>
      ))}

      <FilterMenu filters={filters} appearance="inline" />

      <button
        type="button"
        onClick={onClear}
        className="h-7 rounded-sm px-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("common.clear")}
      </button>
    </div>
  )
}
