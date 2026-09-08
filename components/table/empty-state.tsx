"use client"

import { useT } from "@/i18n/context"
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
  hint,
  className,
}: {
  title: string
  /**
   * Defaults to "try clearing a filter", which is the right advice for a
   * filtered-to-nothing table and the wrong advice for a list that is
   * legitimately empty. Resolved in the body rather than as a parameter
   * default, because a default cannot call a hook.
   */
  hint?: string
  className?: string
}) {
  const t = useT()

  return (
    <div className={cn("text-center", className)}>
      <p className="text-base font-semibold text-text">{title}</p>
      <p className="mx-auto mt-2 max-w-[320px] text-[13px] text-text-muted">
        {hint ?? t("table.emptyHint")}
      </p>
    </div>
  )
}
