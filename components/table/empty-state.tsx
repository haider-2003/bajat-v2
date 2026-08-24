import { cn } from "@/lib/utils"

/**
 * "Nothing matched" — DESIGN.md §8.10.
 *
 * The same block appears inside a table's body, under a card grid, and under a
 * board; only the noun changes. Passing the noun is the whole API, so a screen
 * cannot accidentally ship a different hint or a different type scale for what
 * is the same state.
 */
export function EmptyState({
  title,
  hint = "Try clearing a filter or widening the search.",
  className,
}: {
  title: string
  hint?: string
  className?: string
}) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-base font-semibold text-text">{title}</p>
      <p className="mx-auto mt-2 max-w-[320px] text-[13px] text-text-muted">
        {hint}
      </p>
    </div>
  )
}
