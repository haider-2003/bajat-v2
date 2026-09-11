"use client"

import * as React from "react"
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Printer,
  X,
  Zap,
} from "lucide-react"

import { NodePill } from "@/components/nodes/node-swatch"

import { CARD_H, CARD_HEADER_H, CARD_W } from "./flow-model"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * One card on the flow canvas.
 *
 * ### The colour is a pill, not a painted card
 *
 * The first version wrapped each card in the node's hue — a tinted header
 * band, a matching rim, a coloured port at each edge. It looked like five
 * different components stacked on top of each other, because a hue applied to
 * a whole surface stops reading as *this node's colour* and starts reading as
 * *this card's style*. Six steps in six colours was six unrelated widgets in a
 * column.
 *
 * The card is now neutral — one surface, one hairline, on every card — and the
 * colour lives in exactly one place: a `NodePill` in the header. That is the
 * only element that varies, so it is the only element the eye uses to tell two
 * cards apart, which is what the colour was for.
 *
 * ### Two sections, and a label outside
 *
 * A quiet caption above the card ("When this happens", "Step 2") and a card
 * split into a header and one detail band. The split is what lets the header
 * stay a single line — the identity of the step — while everything that
 * explains it sits below a rule where it can be skipped. A card that puts both
 * in one block has to choose between a title that wraps and a detail that gets
 * cut, and at six cards in a column it chooses badly.
 *
 * ### No ports
 *
 * There is nothing to connect: the order of the array *is* the connection
 * (features/template-flow/types.ts). An earlier pass drew dots at the card
 * edges anyway, to make the wire look like it plugged into something — which
 * is a control that cannot be clicked, on a canvas where everything else can.
 * The wire now meets the card edge, which is enough.
 *
 * ### Reordering is a handle *and* two buttons
 *
 * The grip is the discoverable affordance, and since the drag runs on pointer
 * events it works with a finger as well as a mouse. What it still cannot be is
 * driven from a keyboard, so the same move is always available as arrow
 * buttons — hover-revealed with a mouse, permanent on a touch screen where
 * there is no hover to reveal them.
 */

export type FlowCardVariant = "trigger" | "step" | "terminal"

/** A 24px control in the card header. */
const CARD_BUTTON = [
  "inline-flex size-6 shrink-0 items-center justify-center rounded-[6px]",
  "text-text-muted transition-colors duration-120 outline-none",
  "hover:bg-[rgba(0,0,0,0.06)] hover:text-text",
  "dark:hover:bg-[rgba(255,255,255,0.09)]",
  "focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:pointer-events-none disabled:opacity-35",
].join(" ")

export type FlowNodeCardProps = {
  variant: FlowCardVariant
  /** The node's own hex. Steps only — the two ends are not nodes. */
  color?: string | null
  /** The step's name. Rendered as the pill on a step, as text on the ends. */
  title: string
  /** The quiet caption above the card. */
  caption: string
  /** Small-caps label on the detail band. Omit to drop the band entirely. */
  detailLabel?: string
  detailBody?: string
  index?: number
  /** Picks the card up. Steps only. See `use-flow-drag.ts`. */
  onDragStart?: (event: React.PointerEvent<HTMLDivElement>) => void
  /** Fires for every move once picked up — the card owns its own capture. */
  onDragMove?: (event: React.PointerEvent<HTMLDivElement>) => void
  onDragEnd?: (event: React.PointerEvent<HTMLDivElement>) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  dragging?: boolean
}

export function FlowNodeCard({
  variant,
  color,
  title,
  caption,
  detailLabel,
  detailBody,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp = false,
  canMoveDown = false,
  dragging = false,
}: FlowNodeCardProps) {
  const t = useT()

  const isStep = variant === "step"
  const EndIcon = variant === "trigger" ? Zap : variant === "terminal" ? Printer : null

  return (
    <div style={{ width: CARD_W }} className="relative shrink-0">
      {/* Outside the card, in the ground's own colour — a caption on the
          canvas rather than a heading in the card.

          Its `h-4` plus the margin below it are `CAPTION_H`, and the canvas
          measures wire endpoints from that constant — a block's top is the
          caption's top, and the card's own top edge is `CAPTION_H` below it.
          The three numbers have to move together.

          There used to be a short vertical line drawn up through this space.
          It dated from when the wires were laid out in a flex column and
          stopped at the block's top edge, leaving the caption as an ungapped
          stretch the chain visibly skipped. The wires are positioned in
          canvas space now and land exactly on the card's top edge, so that
          segment was drawing a second, shorter line above the real one — and
          when the wire came in from the *side* instead, it was left hanging
          over the card attached to nothing. */}
      <p className="mb-1.5 h-4 ps-0.5 text-[11px] leading-4 font-medium text-text-muted">
        {caption}
      </p>

      <div
        // Pointer events, not `draggable`. The canvas sets `user-select:
        // none` so a pan does not smear a selection across the page, and that
        // alone stops a native `dragstart` from ever firing in WebKit and
        // Blink — which is why these cards would not move while the library
        // chips outside the canvas would. See the head of `use-flow-drag.ts`.
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        // Gated on the handler, not on `isStep`. Gating on the variant is
        // what stopped the trigger and the terminal from being movable at
        // all: the canvas was passing them a drag handler that this then
        // threw away. Whether a card can be moved is the canvas's call.
        onPointerDown={
          onDragStart
            ? (event) => {
                // The header controls own their own presses. Without this,
                // reaching for Remove also arms a drag, and a hand that
                // shifts a few pixels between press and release turns the
                // click into an aborted drag that removes nothing.
                if ((event.target as HTMLElement).closest("button")) return
                onDragStart(event)
              }
            : undefined
        }
        // How the canvas tells a press on a card from a press on the ground —
        // see the pointer-type note in `flow-canvas.tsx`.
        data-flow-card=""
        // Fixed height, and `CARD_H` is the same number. Every wire endpoint
        // on the canvas is computed from it, and measuring each card instead
        // would mean a ResizeObserver per card feeding layout back into the
        // render that positions them.
        style={{ height: CARD_H }}
        className={cn(
          "group/card relative flex flex-col overflow-hidden text-start",
          "rounded-xl border border-border bg-surface",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none",
          "transition-[border-color,opacity,box-shadow] duration-150",
          "hover:border-border-strong",
          "focus-within:border-accent-violet focus-within:ring-3 focus-within:ring-ring/40",
          // The original stays in place, faded, while its copy follows the
          // cursor — so the gap it will leave is visible during the drag.
          dragging && "opacity-40 shadow-none",
          onDragStart && "cursor-grab active:cursor-grabbing",
          "motion-reduce:transition-none"
        )}
      >
        {/* Header — one line, and the only line that identifies the step.
            A fixed height rather than one derived from its contents, so the
            card's total is the same whether the title is a pill or a string
            of text, and the wire endpoints stay exact either way. */}
        <div
          style={{ height: CARD_HEADER_H }}
          className="flex shrink-0 items-center gap-2 px-3"
        >
          {isStep ? (
            <GripVertical
              aria-hidden
              strokeWidth={1.75}
              className="size-4 shrink-0 text-text-placeholder"
            />
          ) : EndIcon ? (
            <EndIcon
              aria-hidden
              strokeWidth={1.75}
              className={cn(
                "size-4 shrink-0",
                variant === "trigger" ? "text-accent-violet" : "text-success"
              )}
            />
          ) : null}

          {isStep ? (
            <span className="flex min-w-0 flex-1">
              <NodePill color={color} name={title} />
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
              {title}
            </span>
          )}

          {isStep && (
            <div
              className={cn(
                "ms-auto flex shrink-0 items-center gap-0.5",
                // Revealed on hover, and always present for a keyboard: an
                // action that only exists under a pointer does not exist.
                "hidden group-hover/card:flex group-focus-within/card:flex",
                // And there is no hover on a touch screen at all, where these
                // three buttons are the *only* way to reorder or remove a step
                // — drag-and-drop does not fire there. Permanent, not revealed.
                "pointer-coarse:flex"
              )}
            >
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                title={t("flow.moveUp")}
                aria-label={t("flow.moveUpNamed", { name: title })}
                className={CARD_BUTTON}
              >
                <ChevronUp className="size-3.5" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                title={t("flow.moveDown")}
                aria-label={t("flow.moveDownNamed", { name: title })}
                className={CARD_BUTTON}
              >
                <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                onClick={onRemove}
                title={t("flow.removeStep")}
                aria-label={t("flow.removeStepNamed", { name: title })}
                className={cn(
                  CARD_BUTTON,
                  "hover:bg-danger-bg hover:text-danger dark:hover:bg-danger-bg"
                )}
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}
        </div>

        {/* Detail band. Divided by a hairline rather than a filled strip: the
            card has one surface, and a second tone here would make the header
            look like a title bar bolted on. */}
        {detailLabel && (
          <div className="min-h-0 flex-1 border-t border-border px-3 py-2.5">
            <p className="text-[10px] font-semibold tracking-[0.07em] text-text-placeholder uppercase">
              {detailLabel}
            </p>
            {detailBody && (
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-secondary">
                {detailBody}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
