"use client"

import * as React from "react"

import { useControlSurface } from "@/components/ui/control-style"
import { cn } from "@/lib/utils"

/**
 * The trigger every filter facet shares — glyph, two-tone label, and the app's
 * solid-control surface.
 *
 * The face comes from `useControlSurface`, the same source the sidebar's active
 * nav chip reads, so a toolbar button and the current nav item are made of the
 * same material and change together.
 *
 * Two-tone label (DESIGN.md §6.6): the attribute is muted, the chosen value is
 * full contrast. `muted` comes from the surface rather than being hardcoded,
 * because the ink face needs a light muted tone and the pale faces need a dark
 * one — the same class on both would be unreadable on one of them.
 *
 * Written as a plain `<button>` rather than a `Button` variant so the surface
 * classes are the only thing painting it; a variant's own background and border
 * would have to be unset before these could apply.
 */
export function FilterButton({
  icon: Icon,
  label,
  value,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** The muted half — what is being filtered. */
  label: string
  /** The full-contrast half — what it is filtered to. Omit when unset. */
  value?: string
}) {
  const surface = useControlSurface()

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5",
        "text-sm font-medium whitespace-nowrap",
        "transition-[box-shadow,background-color,color] duration-120",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:translate-y-px",
        surface.face,
        className
      )}
      {...props}
    >
      <Icon className={cn("size-4 shrink-0", surface.muted)} strokeWidth={1.5} />
      <span className="hidden sm:inline-flex sm:items-baseline sm:gap-1">
        <span className={surface.muted}>{label}</span>
        {value && <span className="max-w-[140px] truncate">{value}</span>}
      </span>
    </button>
  )
}
