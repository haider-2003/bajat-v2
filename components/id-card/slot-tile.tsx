"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The picker for a slot on the card — a photo, a signature.
 *
 * One tile, two states. Empty, the whole tile is the button: a well at the
 * slot's shape with the glyph in it, what to do, and one line of help.
 * Filled, the well shows what was captured, the text says what it is, and
 * the actions sit at the end. Same footprint either way, so the form does
 * not jump when a photo lands.
 *
 * Why a tile and not a thumbnail beside a row of buttons: the thumbnail *is*
 * the control's state, and a 96px stamp next to three buttons reads as two
 * things. A tile is one thing with one edge, and clicking anywhere on it is
 * the obvious way to fill it — which is also how every upload control the
 * operator has met elsewhere behaves. Dropping a file on it works for the
 * same reason.
 *
 * ### The label's target
 *
 * `id` lands on the tile while it is the button. Once filled, the tile is a
 * group and the caller puts the `id` on its first action instead, so the
 * field's label always focuses something.
 */
export function SlotTile({
  id,
  describedBy,
  invalid = false,
  disabled = false,
  preview,
  fit,
  aspectRatio,
  radius = 8,
  wellClassName,
  icon: Icon,
  title,
  hint,
  hintTone = "muted",
  onPick,
  actions,
  onDropFile,
}: {
  id?: string
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
  /** An object URL for the well, or `null` for the empty state. */
  preview: string | null
  /** A photo covers the well; a signature — transparent ink — is contained. */
  fit: "cover" | "contain"
  /** The slot's shape, width ÷ height. The well takes it. */
  aspectRatio: number
  /** The well's corner radius, px. */
  radius?: number
  /** Extra classes on the well — a signature needs a light ground for its ink. */
  wellClassName?: string
  icon: LucideIcon
  /** Names the state: what to do when empty, what is there when filled. */
  title: string
  hint: string
  hintTone?: "muted" | "danger"
  /** The empty tile's click. */
  onPick: () => void
  /** The filled tile's actions, rendered at its end. */
  actions?: React.ReactNode
  /** A file dropped on the tile, in either state. */
  onDropFile?: (file: File) => void
}) {
  const [over, setOver] = React.useState(false)
  const { w, h } = wellSize(aspectRatio)

  const drop =
    onDropFile && !disabled
      ? {
          onDragOver: (event: React.DragEvent) => {
            event.preventDefault()
            setOver(true)
          },
          onDragLeave: (event: React.DragEvent) => {
            // Crossing into a child fires a leave too; only a real exit ends it.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            setOver(false)
          },
          onDrop: (event: React.DragEvent) => {
            event.preventDefault()
            setOver(false)
            const file = event.dataTransfer.files?.[0]
            if (file) onDropFile(file)
          },
        }
      : {}

  const well = (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden border border-border",
        preview ? "bg-background-subtle" : "bg-surface dark:bg-surface-elevated",
        invalid && "border-danger",
        wellClassName
      )}
      style={{ width: w, height: h, borderRadius: radius }}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain p-1")}
        />
      ) : (
        <Icon
          className="size-5 text-text-placeholder transition-colors duration-120 group-hover/tile:text-accent-violet"
          strokeWidth={1.5}
          aria-hidden
        />
      )}
    </span>
  )

  const text = (
    <span className="min-w-0 flex-1 basis-40">
      <span className="block truncate text-sm font-medium text-text">{title}</span>
      <span
        className={cn(
          "mt-0.5 block truncate text-xs",
          hintTone === "danger" ? "text-danger" : "text-text-muted"
        )}
      >
        {hint}
      </span>
    </span>
  )

  if (!preview) {
    return (
      <button
        type="button"
        id={id}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={onPick}
        {...drop}
        className={cn(
          "group/tile flex w-full items-center gap-4 rounded-xl border border-dashed p-3 text-start",
          "border-border-strong bg-background-subtle dark:bg-surface-sunken",
          "transition-[border-color,background-color] duration-120",
          "hover:border-accent-violet hover:bg-accent-soft/60 dark:hover:bg-accent-soft/40",
          "outline-none focus-visible:border-accent-violet focus-visible:ring-3 focus-visible:ring-ring/45",
          "disabled:cursor-not-allowed disabled:opacity-60",
          over && "border-accent-violet bg-accent-soft/60 dark:bg-accent-soft/40",
          invalid && "border-danger"
        )}
      >
        {well}
        {text}
      </button>
    )
  }

  return (
    <div
      role="group"
      aria-describedby={describedBy}
      {...drop}
      className={cn(
        "flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-3",
        "border-border bg-surface dark:bg-surface-sunken",
        "transition-[border-color] duration-120",
        over && "border-accent-violet",
        invalid && "border-danger"
      )}
    >
      {well}
      {text}
      <span className="ms-auto flex shrink-0 items-center gap-0.5">{actions}</span>
    </div>
  )
}

/**
 * The well's box: 64px tall, its width from the slot — within reason. A
 * signature slot at 4:1 would otherwise be a strip, and a very tall photo
 * slot a sliver.
 */
export function wellSize(aspectRatio: number) {
  const h = 64
  const w = Math.min(128, Math.max(44, h * aspectRatio))
  return { w: Math.round(w), h }
}
