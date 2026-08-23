"use client"

import * as React from "react"
import type { Table as TanTable, RowData } from "@tanstack/react-table"

import type { Features } from "@/lib/table-features"
import { Check, Eye, GripVertical, RotateCcw, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * "View" menu — column visibility + reordering.
 *
 * Follows DESIGN.md §12: 12px-radius popover, 6px padding, 32px items with an
 * 8px radius, popover shadow. Per §12.3 a checked item shows a **bare accent
 * check glyph with no background fill** — the check alone carries the state,
 * rather than a boxed checkbox.
 *
 * Reordering uses native HTML5 drag-and-drop so no extra dependency is needed.
 * The up/down arrow buttons that used to sit on each row were removed by
 * request, so reordering is now pointer-only.
 *
 * Typed against the app's concrete `Features` set: in v9 a generic
 * `TableFeatures` constraint cannot prove that column visibility and ordering
 * are registered, so the methods this menu needs would not resolve. Tables
 * built from a different feature set should widen this type rather than cast.
 */

type ViewMenuProps<TData extends RowData> = {
  table: TanTable<Features, TData>
  /** Columns that may never be hidden or moved (e.g. the select checkbox). */
  pinned?: string[]
  align?: "start" | "end"
}

export function ViewMenu<TData extends RowData>({
  table,
  pinned = [],
  align = "end",
}: ViewMenuProps<TData>) {
  const [open, setOpen] = React.useState(false)
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [overId, setOverId] = React.useState<string | null>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const movable = table
    .getAllLeafColumns()
    .filter((c) => !pinned.includes(c.id))

  // Current order, filtered to the movable set.
  const order = movable.map((c) => c.id)

  const hiddenCount = movable.filter((c) => !c.getIsVisible()).length

  const move = (from: string, to: string) => {
    if (from === to) return
    const next = [...order]
    const fromIdx = next.indexOf(from)
    const toIdx = next.indexOf(to)
    if (fromIdx < 0 || toIdx < 0) return
    next.splice(toIdx, 0, ...next.splice(fromIdx, 1))
    // Pinned columns keep their leading position.
    table.setColumnOrder([...pinned, ...next])
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="default"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className="size-4" strokeWidth={1.5} />
        <span className="hidden sm:inline">View</span>
        {hiddenCount > 0 && (
          <span className="text-text-muted">({movable.length - hiddenCount})</span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Column view options"
          className={cn(
            "absolute z-50 mt-1.5 w-60 rounded-lg border border-border bg-surface-elevated p-1.5",
            "shadow-[0_12px_32px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06)]",
            "dark:shadow-[0_12px_32px_rgba(0,0,0,0.50)]",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {/* Group label — 11px/600 uppercase muted (§12.4) */}
          <div className="flex h-7 items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
              Columns
            </span>
            <button
              type="button"
              onClick={() => {
                table.resetColumnOrder()
                table.resetColumnVisibility()
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-xs px-1 text-[11px] font-medium",
                "text-text-muted transition-colors hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <RotateCcw className="size-3" strokeWidth={1.5} />
              Reset
            </button>
          </div>

          <div className="my-1 h-px bg-border" />

          <ul className="max-h-[320px] overflow-y-auto scrollbar-quiet">
            {movable.map((col) => {
              const visible = col.getIsVisible()
              const label = col.columnDef.meta?.label ?? col.id
              const isDragging = dragId === col.id
              const isOver = overId === col.id && dragId !== col.id

              return (
                <li
                  key={col.id}
                  draggable
                  onDragStart={(e) => {
                    setDragId(col.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setOverId(col.id)
                  }}
                  onDragLeave={() => setOverId((v) => (v === col.id ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragId) move(dragId, col.id)
                    setDragId(null)
                    setOverId(null)
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverId(null)
                  }}
                  className={cn(
                    "group/col flex h-8 items-center gap-1 rounded-md pl-1 pr-2.5",
                    "transition-colors duration-120",
                    "hover:bg-[rgba(0,0,0,0.045)] dark:hover:bg-[rgba(255,255,255,0.07)]",
                    isDragging && "opacity-40",
                    isOver && "bg-accent-soft"
                  )}
                >
                  {/* Drag handle */}
                  <span
                    aria-hidden
                    className="flex size-5 shrink-0 cursor-grab items-center justify-center text-text-placeholder active:cursor-grabbing group-hover/col:text-text-muted"
                  >
                    <GripVertical className="size-3.5" strokeWidth={1.5} />
                  </span>

                  {/* Toggle — the whole row is the hit target */}
                  <button
                    type="button"
                    onClick={() => col.toggleVisibility(!visible)}
                    aria-pressed={visible}
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xs text-left",
                      "text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      visible ? "text-text" : "text-text-placeholder"
                    )}
                  >
                    <span className="truncate">{label}</span>
                    {/* Bare accent check, no box (§12.3) */}
                    {visible && (
                      <Check
                        className="size-3.5 shrink-0 text-accent-violet"
                        strokeWidth={2}
                      />
                    )}
                  </button>

                </li>
              )
            })}
          </ul>

          <div className="my-1 h-px bg-border" />

          {/* Footer row (§12.6) */}
          <div className="flex items-center justify-between px-2.5 py-1">
            <span className="text-[11px] text-text-muted">
              {movable.length - hiddenCount} of {movable.length} shown
            </span>
            <button
              type="button"
              onClick={() =>
                movable.forEach((c) => c.toggleVisibility(hiddenCount > 0))
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-xs px-1 text-[11px] font-medium",
                "text-text-secondary transition-colors hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Eye className="size-3" strokeWidth={1.5} />
              {hiddenCount > 0 ? "Show all" : "Hide all"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
