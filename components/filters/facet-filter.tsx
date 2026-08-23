"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type FacetOption = {
  /** The value sent to the server. */
  key: string
  label: string
}

/**
 * A multi-select facet — the trigger shows how many are ticked, and the value
 * is the array of ticked keys (`?statuses[]=a&statuses[]=b`).
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
}: {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  options: FacetOption[]
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
