"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { FilterButton } from "./filter-button"

export type SelectOption = {
  /** The value sent to the server. */
  value: string
  label: string
}

/**
 * A single-select facet, for a filter that takes one value —
 * `?organization_id=3`.
 *
 * The empty string is "no choice", and drops the clause rather than sending an
 * empty parameter. `allLabel` is what that option reads as.
 *
 * Options usually come from a list endpoint, so `loading` is separate from an
 * empty list: a popup that says nothing at all cannot tell you which of the two
 * it is.
 *
 * Note the label sits *inside* the radio group — as `Menu.GroupLabel` it throws
 * without a group's context. See `FacetFilter` for the same trap.
 */
export function SelectFilter({
  label,
  icon: Icon,
  options,
  value,
  onChange,
  allLabel = "All",
  emptyLabel = "Nothing to choose from",
  loading = false,
  className,
}: {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  options: SelectOption[]
  /** The selected value, or `""` for none. */
  value: string
  onChange: (value: string) => void
  allLabel?: string
  emptyLabel?: string
  loading?: boolean
  /** Passed to the trigger — the filter sheet uses it to go full-width. */
  className?: string
}) {
  const selected = options.find((option) => option.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <FilterButton
            icon={Icon}
            label={label}
            value={selected?.label}
            className={className}
          />
        }
      />
      <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(String(next))}
        >
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="">{allLabel}</DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {options.length === 0 && (
          <p className="px-1.5 py-1.5 text-[13px] text-text-muted">
            {loading ? "Loading…" : emptyLabel}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
