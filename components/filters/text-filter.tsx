"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A text filter — sunken fill with a leading glyph (DESIGN.md §6.7).
 *
 * Fully controlled and **not** debounced: it holds no state of its own, so the
 * value it shows is always the value it was given. Debouncing belongs to the
 * screen, where the raw input and the value sent to the server are two separate
 * things:
 *
 * ```ts
 * const [input, setInput] = React.useState("")
 * const search = useDebounce(input.trim(), 300)   // this one goes in the query
 * ```
 *
 * Keeping it out of here is what lets the field stay responsive while the
 * request lags behind — a component that debounced internally would have to
 * fight its own `value` prop on every keystroke.
 */
export function TextFilter({
  icon: Icon,
  value,
  onChange,
  placeholder,
  label,
  type = "text",
  inputMode,
  className,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** The accessible name — the field has no visible label. */
  label: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  /**
   * Width belongs to the caller; everything else is fixed.
   *
   * Applied to the **wrapper**, not the input. The input is `w-full` inside
   * it, so sizing the input instead left the wrapper measuring itself against
   * a percentage of its own content — which is why a `w-full` search field
   * came out at whatever width a bare `<input>` defaults to.
   */
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Icon
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-placeholder"
        strokeWidth={1.5}
      />
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          // §18.7 — 44px for touch, the §6.7 32px field at lg. 16px text below
          // that: iOS zooms the page when a smaller field takes focus, and on
          // a filter bar that throws the whole toolbar off-screen.
          "h-11 w-full rounded-md bg-surface-sunken pl-8 pr-3 text-base",
          "lg:h-8 lg:text-sm",
          "text-text placeholder:text-text-placeholder",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      />
    </div>
  )
}
