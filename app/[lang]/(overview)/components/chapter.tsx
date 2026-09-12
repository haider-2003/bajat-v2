"use client"

import { cn } from "@/lib/utils"

/**
 * A section mark — the page's editorial spine.
 *
 * ```
 * 01 ─ SCALE ───────────────────────────────  all time
 * ```
 *
 * The overview is four sections that argue in order: how much has been issued,
 * how it flows, where it comes from, and what is waiting right now. Without
 * something between them the page reads as a heap of cards; with a heading on
 * every card it reads as a form. A numbered rule is the cheapest thing that
 * says "a new argument starts here" while adding almost no ink — the numeral
 * is mono and muted, the label is a 12px overline, and the rest is a hairline
 * doing the work a whole heading would otherwise have to do.
 *
 * The trailing slot carries whatever qualifies the whole section — the period
 * its numbers cover, most importantly — so a qualifier never has to be
 * repeated on each card underneath.
 */
export function Chapter({
  index,
  label,
  aside,
  className,
}: {
  /** Rendered as `01`, `02`, … */
  index: number
  label: string
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="font-mono text-[11px] tracking-[0.08em] text-text-placeholder tabular-nums"
      >
        {String(index).padStart(2, "0")}
      </span>

      {/* `h2` rather than a styled div: these are the page's real sections, and
          a screen reader's heading list is how somebody skips between them. */}
      <h2 className="text-[11px] font-semibold tracking-[0.1em] text-text-secondary uppercase">
        {label}
      </h2>

      <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />

      {aside ? (
        <span className="shrink-0 text-[11px] text-text-placeholder">{aside}</span>
      ) : null}
    </div>
  )
}
