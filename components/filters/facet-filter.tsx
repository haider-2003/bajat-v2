"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { FilterButton } from "./filter-button"

export type FacetOption = {
  /** The value sent to the server. */
  key: string
  label: string
}

/**
 * A multi-select facet — the value is the array of ticked keys, sent as one
 * repeated parameter (`?statuses[]=a&statuses[]=b`).
 *
 * Use this wherever the backend takes a **plural** field. Reaching for
 * `SelectFilter` because "you usually pick one" is how a screen ends up
 * sending `organization_id=23` to an endpoint that reads `organization_ids[]`
 * — a real query parameter, ignored, with no error anywhere and a table that
 * quietly shows everything (docs/filtering-sorting-pagination.md §6).
 *
 * **The label must stay inside a group.** `DropdownMenuLabel` is Base UI's
 * `Menu.GroupLabel`, which *throws* — "MenuGroupContext is missing" — unless a
 * `Menu.Group` or `Menu.RadioGroup` provides its context. Rendered bare it takes
 * the whole popup down with it, and the facet reads as an inert button.
 */
export function FacetFilter({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  emptyLabel = "Nothing to choose from",
  loading = false,
  className,
}: {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  options: FacetOption[]
  selected: string[]
  onToggle: (key: string) => void
  /** Shown when there is nothing to tick and nothing is loading. */
  emptyLabel?: string
  /** Options usually come from a list endpoint; this is not the same as empty. */
  loading?: boolean
  /** Passed to the trigger — the filter sheet uses it to go full-width. */
  className?: string
}) {
  /**
   * The full-contrast half of the trigger (§6.6).
   *
   * One tick shows the thing itself; more than one shows a count, because
   * "Baghdad, Basra, Erbil…" in a 32px chip is a truncated string that names
   * neither how many nor which. Zero shows nothing at all, so an untouched
   * facet reads as the attribute alone.
   */
  const value = React.useMemo(() => {
    if (selected.length === 0) return undefined
    if (selected.length === 1) {
      return options.find((option) => option.key === selected[0])?.label
    }
    return `(${selected.length})`
  }, [options, selected])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <FilterButton
            icon={Icon}
            label={label}
            value={value}
            className={className}
          />
        }
      />
      <DropdownMenuContent
        align="end"
        className="max-h-72 w-56 overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.key}
              checked={selected.includes(option.key)}
              onCheckedChange={() => onToggle(option.key)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {options.length === 0 && (
          <p className="px-1.5 py-1.5 text-[13px] text-text-muted">
            {loading ? "Loading…" : emptyLabel}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Adds or removes one key — the update every `onToggle` wants. */
export function toggleKey(selected: string[], key: string): string[] {
  return selected.includes(key)
    ? selected.filter((value) => value !== key)
    : [...selected, key]
}
