"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { useT } from "@/i18n/context"
import { PAGE_SIZE_OPTIONS } from "@/utils/constants"
import { cn } from "@/lib/utils"

/**
 * Pagination bar — DESIGN.md §8.9.
 *
 * The reference tables use continuous scroll, so the doc's inferred spec is
 * followed to the letter: a 52px bar under the table, `Showing 1–10 of 120` at
 * 13px muted on the left, and on the right a compact page-size select plus a
 * pair of 28px ghost icon buttons.
 *
 * **No numbered page pills** — §8.9 rules them out as out of character.
 *
 * Every number here is optional on purpose. The total is documented
 * (docs/filtering-sorting-pagination.md §4) but a response that omits it must
 * not strand the user on page 1 forever: with the total unknown the bar shows
 * the range without a denominator and lets you advance as long as the current
 * page came back full, which is the only honest signal that more rows exist.
 *
 * `perPage` is the size the *server* paged by. It is usually the size that was
 * asked for, but a backend that ignores `per_page` returns its own — and the
 * range and the "is this page full?" test have to follow the server, or Next
 * goes dead on a table that plainly has more rows.
 */

export function Pagination({
  page,
  pageSize,
  rowCount,
  total,
  lastPage: lastPageProp,
  perPage,
  onPageChange,
  onPageSizeChange,
  busy = false,
  className,
}: {
  page: number
  pageSize: number
  /** Rows actually returned for the current page. */
  rowCount: number
  /** The row total, or undefined when the response didn't include one. */
  total?: number
  /** The final page, when the response said so outright. */
  lastPage?: number
  /** Rows per page the server actually used; falls back to `pageSize`. */
  perPage?: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** A page is in flight — shown, but never blocking. */
  busy?: boolean
  className?: string
}) {
  const t = useT()
  const knowsTotal = typeof total === "number"

  // What the server actually pages by. Offsets and the full-page test both
  // key off this, never off the selected size.
  const stride = perPage && perPage > 0 ? perPage : pageSize

  const lastPage =
    lastPageProp ?? (knowsTotal ? Math.max(1, Math.ceil(total / stride)) : undefined)

  const first = rowCount === 0 ? 0 : (page - 1) * stride + 1
  const last = (page - 1) * stride + rowCount

  const canPrev = page > 1
  // Without a total, a page filled to the brim is the only hint there is more.
  // `>=` rather than `===` so an over-full page still counts as full.
  const canNext = lastPage !== undefined ? page < lastPage : rowCount >= stride

  return (
    <div
      className={cn(
        "flex h-[52px] items-center justify-between gap-4 border-t border-border bg-background-subtle px-5",
        className
      )}
    >
      <p
        className={cn(
          // `tabular-nums` moved from the individual numerals to the whole
          // line: the counts now sit inside a translated sentence, and Arabic
          // does not put them where English does - so the string cannot be
          // assembled from spans around fixed positions.
          "text-[13px] tabular-nums text-text-muted transition-opacity",
          busy && "opacity-60"
        )}
      >
        {rowCount === 0
          ? // Deliberately not a noun this component cannot know. It sits
            // under members, requests, print jobs and a template gallery, and
            // "No requests" was wrong under three of the four.
            t("table.noResults")
          : knowsTotal
            ? t("table.showingOf", { first, last, total: total as number })
            : t("table.showing", { first, last })}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-text-muted">
          <span className="hidden sm:inline">{t("table.rows")}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={cn(
              "h-7 rounded-md border border-border bg-surface ps-2 pe-6 text-[13px] text-text",
              "outline-none transition-colors hover:border-border-strong",
              "focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-0.5">
          <PageButton
            label={t("table.previousPage")}
            icon={ChevronLeft}
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
          />
          <span className="px-1 text-[13px] tabular-nums text-text-secondary">
            {lastPage !== undefined
              ? t("table.pageOf", { page, lastPage })
              : t("table.page", { page })}
          </span>
          <PageButton
            label={t("table.nextPage")}
            icon={ChevronRight}
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
          />
        </div>
      </div>
    </div>
  )
}

/** 28px ghost icon button (§8.9, §7.2 ghost). */
function PageButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-text-secondary",
        "transition-colors duration-120",
        "hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.045)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:text-text-placeholder"
      )}
    >
      {/* Back and forward point along the reading direction, so unlike most
          glyphs these two have to turn around under RTL. */}
      <Icon data-flip-rtl className="size-4" strokeWidth={1.5} />
    </button>
  )
}
