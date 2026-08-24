import { AlertCircle, RefreshCw } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * The two states a list screen is in before it has rows — DESIGN.md §8.11.
 *
 * Shared for the same reason `TableView` is and `columns.tsx` is not: the
 * skeleton and the failure block are chrome. Every list in this product waits
 * the same way and fails the same way, and the only screen-specific thing in
 * either is the noun — which is why `title` is a required prop rather than a
 * default nobody would notice was wrong.
 */

/** The table's own shape, greyed out — never a spinner (§8.11). */
export function LoadingRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="h-10 border-b border-border bg-background-subtle" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex h-12 items-center gap-3 border-b border-border px-5 last:border-b-0"
        >
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="ml-auto h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      ))}
    </div>
  )
}

/**
 * The request failed and there is nothing on screen to fall back to.
 *
 * A screen that already has rows should *not* use this — it shows a strip
 * above them instead, so the table and its pager stay put rather than
 * vanishing and making the click look like it did nothing.
 */
export function LoadFailed({
  title,
  onRetry,
  retrying,
}: {
  /** e.g. "Couldn't load the print queue". */
  title: string
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-surface py-16 text-center">
      <AlertCircle
        className="mx-auto size-5 text-text-muted"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="mt-3 text-base font-semibold text-text">{title}</p>
      <p className="mx-auto mt-2 max-w-[320px] text-[13px] text-text-muted">
        The server didn&apos;t answer. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className={cn(
          "mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3",
          "text-[13px] font-medium text-text-secondary transition-colors",
          "hover:border-border-strong hover:text-text",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:text-text-placeholder"
        )}
      >
        <RefreshCw
          className={cn("size-3.5", retrying && "animate-spin")}
          strokeWidth={1.5}
        />
        Try again
      </button>
    </div>
  )
}
