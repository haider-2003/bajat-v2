"use client"

import { cn } from "@/lib/utils"

/**
 * A node's colour, in the three shapes the app draws it in.
 *
 * ### Nothing here paints raw hex
 *
 * A node's colour is free-form hex chosen by whoever made the node, and in
 * practice most of them are `#000000` — the value you get by not choosing. A
 * column of those rendered literally is a stack of dead black dots that say
 * nothing in light mode and are invisible against `--surface` in dark mode,
 * with the one node somebody *did* colour sitting among them looking like an
 * error.
 *
 * So every colour here goes through the `.node-tone` correction in
 * globals.css, which mixes it against the theme's own surface and text tokens
 * before anything is drawn with it. See that block for why the arithmetic
 * lives in CSS rather than in JS.
 */

/** Hands the raw value to `.node-tone`, which derives the rest from it. */
function toneVars(color: string | null | undefined) {
  return { "--node": color ?? "var(--text-muted)" } as React.CSSProperties
}

/**
 * The dot, for places that already carry the node's name beside them — a
 * picker row, a dialog, a card's field list.
 *
 * `aria-hidden`: the colour restates nothing a screen reader needs, and
 * announcing "image" here would add a stop to every row for no information.
 *
 * Not a bare circle. The fill is the corrected tone and the ring is the hue
 * held at low strength against the surface, which is the pair that keeps a
 * `#FFFFFF` node visible on white and a `#000000` node visible on `#0a0a0a`.
 */
export function NodeSwatch({
  color,
  className,
}: {
  color: string | null | undefined
  className?: string
}) {
  return (
    <span
      aria-hidden
      style={toneVars(color)}
      className={cn(
        "node-tone size-2.5 shrink-0 rounded-full bg-(--node-fill)",
        "ring-2 ring-(--node-halo)",
        // A node whose colour never arrived reads as a hollow ring rather than
        // as a black dot, which would be a legitimate colour.
        !color && "bg-transparent ring-1 ring-border-strong",
        className
      )}
    />
  )
}

/**
 * The node's name *as* its colour — a status badge in the node's own hue.
 *
 * ### It is a `SoftBadge`, and that is the whole idea
 *
 * A stage *is* a status: it is the thing a request is currently sitting in,
 * exactly like `WAITING_TO_PRINT` on the printer queue. So it takes §14.1's
 * flat soft badge without deviation — 20px tall, 6px radius, 8px of padding,
 * 12px/500, a flat wash with matching text and **no rim and no dot**.
 *
 * A first pass gave it its own shape: 8px radius, a ring, a leading dot, 13px
 * text. Every one of those made it heavier than the badges it sits in a table
 * beside, and a stack of them read as a column of grey boxes rather than a
 * column of statuses. The tone is the only thing about this badge that is
 * allowed to be different from the ones next to it.
 *
 * The one deviation is truncation: a `SoftBadge` never wraps or clips because
 * its content is a status name from a fixed list, and these are typed in — a
 * long one has to clip at the column edge rather than push the layout open.
 */
export function NodeChip({
  color,
  name,
  className,
}: {
  color: string | null | undefined
  name: string
  className?: string
}) {
  return (
    <span
      title={name}
      style={toneVars(color)}
      className={cn(
        // §14.1's flat soft badge, to the pixel — see `SoftBadge`.
        "node-tone inline-flex h-5 max-w-full items-center rounded-sm px-2",
        "text-xs font-medium whitespace-nowrap",
        "bg-(--node-wash) text-(--node-ink)",
        className
      )}
    >
      <span className="truncate">{name}</span>
    </span>
  )
}

/**
 * The card view's colour rail — the same correction, full-bleed.
 *
 * Kept here rather than written inline in `view-cards.tsx` so a node is the
 * same colour on its card as it is in the table. A 4px band of raw `#000000`
 * across the top of a dark card is a seam, not a colour.
 */
export function NodeRail({ color }: { color: string | null | undefined }) {
  return (
    <span
      aria-hidden
      style={toneVars(color)}
      className={cn(
        "node-tone h-1 w-full shrink-0 bg-(--node-fill)",
        !color && "bg-border"
      )}
    />
  )
}
