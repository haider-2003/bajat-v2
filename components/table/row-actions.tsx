"use client"

import * as React from "react"
import { Loader2, MoreHorizontal, Pencil } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/i18n/context"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/**
 * The row action control every list in this app shares — DESIGN.md §7.2 for
 * the control, §12 for the menu.
 *
 * ### Why this one is shared when `columns.tsx` never is
 *
 * A column list maps one entity's fields onto one table and is deliberately
 * copied per screen (see components/table/cells.tsx). This is the opposite
 * case: the *verbs* are the same everywhere — one on the surface, then a menu
 * of the rest ending in a red delete — and a copy of a split control per
 * screen is a copy per screen of its seam, radius and focus ring, which is how
 * eleven screens ended up with four different action controls.
 *
 * What stays per-screen is which verbs exist, which is passed in as `items`.
 *
 * ### Reading a record is not one of these verbs
 *
 * There is no eye button here, and there is not meant to be. Opening a record
 * is what the *row* is for (`components/table/table-view.tsx`), so this
 * control is left holding only the verbs that change something. That is what
 * makes one 28px control enough on every screen: the loudest thing a row can
 * do no longer has to fit inside it.
 *
 * ### One primary, and it is whatever the screen's main verb is
 *
 * Usually Edit, so `onEdit` / `editHref` are the shorthand for it. A screen
 * whose main verb is something else — the printer moves a card one step along,
 * the black list removes an entry — passes `primary` instead and gets the same
 * geometry. The point is that the *shell* never varies: same height, same
 * seam, same radius, same menu, on every screen in the product.
 *
 * ### The screen owns the dialogs
 *
 * Handlers are passed in rather than owned here: confirmations are mounted
 * once by the client, not once per row. Thirty rows each holding a mounted
 * `Dialog` is thirty portals waiting to be opened.
 */

export type RowActionItem = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  onSelect: () => void
  /** Renders red, and is pushed below a separator. One per menu at most. */
  destructive?: boolean
  disabled?: boolean
}

export type RowActionPrimary = {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** A navigation rather than a handler — renders a real `Link`. */
  href?: string
  onSelect?: () => void
  disabled?: boolean
  /** Swaps the glyph for a spinner and blocks the click. */
  pending?: boolean
  /**
   * `danger` turns the segment red **on hover only**. §7.2's destructive fill
   * is a tinted red box, and thirty rows each carrying one is a wall of red
   * where nothing reads as urgent; the solid red belongs in the confirmation,
   * where there is one of it and it is the click that does the thing.
   */
  tone?: "default" | "danger"
}

/**
 * A segment of the split control.
 *
 * The end radius is `7px`, not `--radius-md`: the container is 8px with a 1px
 * border, so its *inner* curve is 7px, and a segment drawn at 8px pushes a
 * square corner of hover fill out through it. Rounding each end rather than
 * clipping the container with `overflow-hidden` also keeps the focus ring
 * outside the box, where it can be seen.
 */
const SEGMENT = [
  "inline-flex h-7 shrink-0 items-center justify-center gap-1.5",
  "text-[13px] font-medium whitespace-nowrap",
  "transition-colors duration-120 outline-none",
  "hover:bg-[rgba(0,0,0,0.04)] hover:text-text",
  "aria-expanded:bg-[rgba(0,0,0,0.055)] aria-expanded:text-text",
  "dark:hover:bg-[rgba(255,255,255,0.06)] dark:aria-expanded:bg-[rgba(255,255,255,0.08)]",
  "focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:pointer-events-none disabled:opacity-50",
].join(" ")

/** Hover-only red, for a primary whose verb removes something. */
const DANGER_SEGMENT =
  "hover:bg-danger-bg hover:text-danger dark:hover:bg-danger-bg dark:hover:text-danger"

export function RowActions({
  /** Names the row in every accessible label — "Edit Baghdad Branch". */
  label,
  primary,
  onEdit,
  editHref,
  editLabel,
  items = [],
  className,
}: {
  label: string
  /** The surface verb, where it is not Edit. Wins over the `onEdit` shorthand. */
  primary?: RowActionPrimary
  /** Shorthand: an Edit segment that opens a dialog. */
  onEdit?: () => void
  /** Shorthand: an Edit segment that navigates. Takes an unprefixed path. */
  editHref?: string
  /** Overrides the "Edit" wording, e.g. "Rename" where that is the only edit. */
  editLabel?: string
  items?: RowActionItem[]
  className?: string
}) {
  const t = useT()

  const [ordinary, destructive] = React.useMemo(
    () => [
      items.filter((item) => !item.destructive),
      items.filter((item) => item.destructive),
    ],
    [items]
  )

  // The shorthands are folded into the same object the segment renders from,
  // so there is one code path below rather than a branch per calling style.
  const surface: RowActionPrimary | undefined =
    primary ??
    (onEdit || editHref
      ? {
          label: editLabel ?? t("common.edit"),
          icon: Pencil,
          onSelect: onEdit,
          href: editHref,
        }
      : undefined)

  const hasMenu = items.length > 0
  const danger = surface?.tone === "danger"

  const segmentClass = cn(
    SEGMENT,
    "px-2.5 text-text-secondary",
    "rounded-s-[7px]",
    // With no menu beside it the segment owns both ends.
    !hasMenu && "rounded-e-[7px]",
    danger && DANGER_SEGMENT
  )

  const Icon = surface?.pending ? Loader2 : surface?.icon
  const glyph = Icon ? (
    <Icon
      className={cn("size-3.5 shrink-0", surface?.pending && "animate-spin")}
      strokeWidth={1.75}
      aria-hidden
    />
  ) : null

  return (
    <div
      className={cn(
        // §7.2 Secondary at §19.5's `--shadow-xs`. Dark mode drops the shadow
        // and steps the surface up instead (§9.7).
        "inline-flex shrink-0 items-center rounded-md border border-border bg-surface",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-120",
        "hover:border-border-strong",
        danger && "hover:border-danger-border",
        "dark:bg-[rgba(255,255,255,0.04)] dark:shadow-none",
        className
      )}
    >
      {/* A real `Link` where the verb is a navigation, so it middle-clicks and
          opens in a new tab like any other link. */}
      {surface?.href ? (
        <Link
          href={surface.href}
          aria-label={`${surface.label} — ${label}`}
          className={segmentClass}
        >
          {glyph}
          {surface.label}
        </Link>
      ) : surface ? (
        <button
          type="button"
          onClick={surface.onSelect}
          disabled={surface.disabled || surface.pending}
          aria-label={`${surface.label} — ${label}`}
          title={surface.label}
          className={segmentClass}
        >
          {glyph}
          {surface.label}
        </button>
      ) : null}

      {surface && hasMenu && (
        // Inset so it reads as a seam between two segments rather than as a bar
        // cutting the control in half (§1.6).
        <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
      )}

      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={t("common.moreActionsFor", { name: label })}
                className={cn(
                  SEGMENT,
                  "w-7 rounded-e-[7px] text-text-muted",
                  !surface && "rounded-s-[7px]"
                )}
              >
                <MoreHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {ordinary.map((item) => {
              const ItemIcon = item.icon
              return (
                <DropdownMenuItem
                  key={item.key}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  <ItemIcon
                    className="size-4 shrink-0 text-text-muted"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {item.label}
                </DropdownMenuItem>
              )
            })}

            {ordinary.length > 0 && destructive.length > 0 && (
              <DropdownMenuSeparator />
            )}

            {/* §12.3 gives the destructive item the only red in the list — the
                row control itself stays quiet, because thirty red buttons in a
                table is a wall where nothing reads as urgent. */}
            {destructive.map((item) => {
              const ItemIcon = item.icon
              return (
                <DropdownMenuItem
                  key={item.key}
                  variant="destructive"
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  <ItemIcon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                  {item.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
