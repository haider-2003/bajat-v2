"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Segmented control — DESIGN.md §10.4.
 *
 * Sunken track, 3px inner padding, 28px segments at 13/500. The active segment
 * is a white chip with a hairline rim and a 1px contact shadow in light mode;
 * in dark mode it becomes a flat `#262626` fill with no shadow, because a
 * shadow on a near-black ground is invisible (§17.4).
 *
 * Built on Base UI's `RadioGroup`, so it is a real `role="radiogroup"` with
 * roving arrow-key focus rather than a row of buttons. The rim is drawn with
 * an inset box-shadow instead of a border so switching segments never shifts a
 * label by a pixel.
 */

export type SegmentedItem<T extends string> = {
  value: T
  label: string
  icon?: LucideIcon
  /** Announced to screen readers when the label alone is too terse. */
  hint?: string
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  items,
  label,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  items: readonly SegmentedItem<T>[]
  /** Accessible name for the group — there is no visible <label>. */
  label: string
  className?: string
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-sunken p-[3px]",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Radio.Root
            key={item.value}
            value={item.value}
            title={item.hint}
            className={cn(
              "inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-3",
              "text-[13px] font-medium text-text-secondary select-none",
              "transition-[background-color,box-shadow,color] duration-120",
              "hover:text-text",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-sunken",
              "data-checked:bg-surface data-checked:text-text",
              "data-checked:shadow-[inset_0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.06)]",
              "dark:data-checked:bg-[#262626] dark:data-checked:shadow-none"
            )}
          >
            {Icon && (
              <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.5} />
            )}
            <span className="truncate">{item.label}</span>
          </Radio.Root>
        )
      })}
    </RadioGroup>
  )
}
