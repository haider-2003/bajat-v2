"use client"

import * as React from "react"
import { X } from "lucide-react"

export type ActiveFilter = {
  /** React key, and the field this chip stands for. */
  key: string
  /** The muted half — what is being filtered. */
  attribute: string
  /** The full-contrast half — what it is filtered to. */
  value: string
  onRemove: () => void
}

/**
 * The applied-filter row (DESIGN.md §14.5) — one removable chip per active
 * filter, plus a Clear.
 *
 * Renders nothing when there is nothing applied, so a screen can drop it in
 * unconditionally instead of guarding it at the call site.
 */
export function FilterChips({
  filters,
  onClear,
}: {
  filters: ActiveFilter[]
  onClear: () => void
}) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <FilterChip
          key={filter.key}
          attribute={filter.attribute}
          value={filter.value}
          onRemove={filter.onRemove}
        />
      ))}
      <button
        type="button"
        onClick={onClear}
        className="h-7 rounded-sm px-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Clear
      </button>
    </div>
  )
}

/** One chip. Exported for the rare screen that lays the row out itself. */
export function FilterChip({
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
