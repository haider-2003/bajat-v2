"use client"

import type { Node } from "@/features/nodes/types"

/**
 * The client-side model of a flow: the same chain the server stores, plus the
 * one thing it does not — where each card sits.
 *
 * ### Position is derived data that the user authors
 *
 * `POST /template/flow` takes `nodeIds: number[]` and nothing else
 * (features/template-flow/types.ts). There is no field for a coordinate, so a
 * card left at a particular spot cannot be saved to the backend at all.
 *
 * Two consequences, both deliberate:
 *
 *  1. **Order is read off the canvas, not stored beside it.** The chain is the
 *     steps sorted top to bottom. Dragging a card above another *is* the
 *     reorder — there is no second, hidden ordering that the layout could
 *     disagree with. This is what lets free placement and a saved sequence
 *     coexist: the picture is the data.
 *  2. **Positions live in `localStorage`, keyed by template.** They survive a
 *     reload on this machine and nowhere else — a colleague opening the same
 *     template sees the default column. That is a real limitation and the
 *     honest one available; the alternative is cards that jump back into a
 *     straight line every time the page loads.
 */

export type Point = { x: number; y: number }

export type FlowStep = {
  /** Stable within a session. A node may legitimately appear twice. */
  uid: string
  node: Node
  /** Top-left of the whole card block, caption included, in canvas space. */
  x: number
  y: number
}

/**
 * Everything on the canvas: the steps, plus the two ends.
 *
 * The ends carry coordinates like everything else. An earlier version derived
 * them — trigger a fixed gap above the topmost step, terminal the same below
 * the bottommost — which meant dragging a single card dragged both ends along
 * with it. With one or two steps that is the entire diagram sliding around,
 * which is not moving a node, it is moving the view.
 *
 * They are placed objects now. Not saved to the server (neither is a row in
 * the database) and not part of the chain, but draggable and remembered
 * exactly like a step.
 */
export type FlowLayout = {
  steps: FlowStep[]
  trigger: Point
  terminal: Point
}

/** The two ends answer to these where a step would give its `uid`. */
export const TRIGGER_UID = "__trigger"
export const TERMINAL_UID = "__terminal"


/** Card geometry. The wire maths depends on these being exact. */
export const CARD_W = 320
/** The caption above the card — see the note on `FlowNodeCard`. */
export const CAPTION_H = 22
/**
 * The card box below the caption.
 *
 * Fixed rather than measured. Every wire endpoint is computed from it, and
 * measuring each card would mean a `ResizeObserver` per card feeding layout
 * back into the render that positions them.
 *
 * The card does not merely *happen* to be this tall — it is laid out as a
 * column of this exact height, with a fixed header and a detail band taking
 * the remainder. A first pass picked a number by eye and left the content to
 * fit, which clipped the second line of every detail band. If this changes,
 * nothing else needs to: the card adapts, the wires follow.
 */
export const CARD_H = 126

/** The header strip inside the card; the detail band gets what is left. */
export const CARD_HEADER_H = 48

/** Caption plus card. */
export const BLOCK_H = CAPTION_H + CARD_H

/**
 * Vertical pitch of the tidy column.
 *
 * A block is `BLOCK_H` tall, so this minus that is the wire between two
 * cards. At 176 that gap was 28px — barely a wire, and not enough for the
 * insert button that sits at its midpoint.
 */
export const ROW_PITCH = 220

let uidCounter = 0

export function makeStep(node: Node, x: number, y: number): FlowStep {
  uidCounter += 1
  return { uid: `s${uidCounter}-${node.id}`, node, x, y }
}

/**
 * The chain, in the order it will be saved.
 *
 * Top to bottom, with `x` breaking ties so two cards level with each other
 * still have a defined order — left to right, which is the reading order the
 * rest of the app uses. `slice()` first: this must not reorder the array the
 * caller is rendering from.
 */
export function orderedSteps(steps: FlowStep[]): FlowStep[] {
  return steps.slice().sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * The key a step's position is remembered under.
 *
 * The node id plus which occurrence of that node this is. Not the `uid`,
 * which is regenerated every session — this has to survive a reload, and
 * after a save the server hands the chain back in exactly the order these
 * were computed from, so the keys line up again.
 */
function positionKey(nodeId: number, occurrence: number) {
  return `${nodeId}:${occurrence}`
}

function storageKey(templateId: number) {
  return `bajat-flow-layout-${templateId}`
}

/** Every placed thing, keyed by its position key or by an end's uid. */
type StoredPositions = Record<string, Point>

function isPoint(value: unknown): value is Point {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Point).x === "number" &&
    typeof (value as Point).y === "number"
  )
}

function readStored(templateId: number): StoredPositions {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(storageKey(templateId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    // Entry-by-entry rather than a blanket cast: this is data from a previous
    // release of this screen, and the shape has already changed once.
    const out: StoredPositions = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (isPoint(value)) out[key] = { x: value.x, y: value.y }
    }
    return out
  } catch {
    // Private mode, blocked storage, or something else wrote here. A default
    // column is a fine answer; a thrown error on page load is not.
    return {}
  }
}

export function writeLayout(templateId: number, layout: FlowLayout) {
  if (typeof window === "undefined") return
  const seen = new Map<number, number>()
  const out: StoredPositions = {
    [TRIGGER_UID]: layout.trigger,
    [TERMINAL_UID]: layout.terminal,
  }
  for (const step of orderedSteps(layout.steps)) {
    const n = seen.get(step.node.id) ?? 0
    seen.set(step.node.id, n + 1)
    out[positionKey(step.node.id, n)] = { x: step.x, y: step.y }
  }
  try {
    localStorage.setItem(storageKey(templateId), JSON.stringify(out))
  } catch {
    // Quota, or storage disabled. The layout simply will not persist.
  }
}

/**
 * Builds the editable layout from what the server returned, restoring any
 * remembered positions and falling back to a straight column.
 *
 * The default column puts the trigger first and the terminal last, at the
 * same pitch as the steps between them — which is the layout this screen had
 * before anything could be moved.
 */
export function hydrateLayout(templateId: number, nodes: Node[]): FlowLayout {
  const seen = new Map<number, number>()
  const stored = readStored(templateId)

  let complete = !!stored[TRIGGER_UID] && !!stored[TERMINAL_UID]

  const steps = nodes.map((node, index) => {
    const n = seen.get(node.id) ?? 0
    seen.set(node.id, n + 1)
    const saved = stored[positionKey(node.id, n)]
    if (!saved) complete = false
    return makeStep(node, saved?.x ?? 0, saved?.y ?? (index + 1) * ROW_PITCH)
  })

  /**
   * A partly-remembered layout is not worth restoring.
   *
   * Positions are keyed by node and occurrence, so any change to the chain
   * since it was last stored — a step added, a step removed, the whole flow
   * emptied and rebuilt — leaves some cards with a remembered spot and the
   * rest defaulting to a column. The result is neither the layout that was
   * arranged nor a tidy one: a few cards stranded where they used to belong,
   * with the new ones stacked through them.
   *
   * All or nothing, and nothing means the straight column — the same thing
   * Straighten produces. Restoring only survives a reload where the chain is
   * exactly as it was left, which is the only case where those coordinates
   * still describe anything.
   */
  if (!complete) return tidyLayout(steps)

  return {
    steps,
    trigger: stored[TRIGGER_UID],
    terminal: stored[TERMINAL_UID],
  }
}

/**
 * The straight column: trigger, the steps in order, terminal.
 *
 * A one-shot rearrangement, not a mode. It changes where the cards sit and
 * nothing else — the chain is untouched, because the order it lays out in is
 * the order that was already there, and cards stay draggable afterwards.
 *
 * With no steps the terminal is pushed a full extra pitch down, so the
 * "nothing here yet" hint has somewhere to sit between the two ends. At one
 * pitch it landed on top of the terminal card.
 */
export function tidyLayout(steps: FlowStep[]): FlowLayout {
  const ordered = orderedSteps(steps)
  return {
    steps: ordered.map((step, index) => ({
      ...step,
      x: 0,
      y: (index + 1) * ROW_PITCH,
    })),
    trigger: { x: 0, y: 0 },
    terminal: { x: 0, y: (Math.max(ordered.length, 1) + 1) * ROW_PITCH },
  }
}

/**
 * Where a step goes when it is added without being placed by hand.
 *
 * Just above the terminal, nudged down from the last step — so a step added
 * from the rail lands at the end of the chain, which is what pressing a chip
 * with nothing armed means.
 */
export function nextFreeSpot(layout: FlowLayout): Point {
  const last = orderedSteps(layout.steps).at(-1)
  if (!last) return { x: layout.trigger.x, y: layout.trigger.y + ROW_PITCH }
  return { x: last.x, y: last.y + ROW_PITCH }
}

/**
 * Pushes the two ends back outside the steps, if a step has passed them.
 *
 * Adding a step puts it below the bottom-most one, which after a couple of
 * additions is below the *terminal* — so the flow ended up running through
 * "Ready to print" and then carrying on, because nothing ever moved the
 * terminal out of the way.
 *
 * Only ever outward, and only when something has actually crossed: an end
 * that already has room keeps exactly where it was put. That is the whole
 * difference between this and the version that derived the ends from the
 * steps — that one dragged both ends along with every card you moved.
 *
 * Run when a step is *added*, not when one is dragged. A card dragged past
 * the terminal is a deliberate placement and shoving the terminal aside
 * mid-gesture would be the canvas arguing with the cursor.
 */
export function settleEnds(layout: FlowLayout): FlowLayout {
  const ordered = orderedSteps(layout.steps)
  const top = ordered[0]
  const bottom = ordered.at(-1)
  if (!top || !bottom) return layout

  const trigger =
    layout.trigger.y > top.y - ROW_PITCH
      ? { ...layout.trigger, y: top.y - ROW_PITCH }
      : layout.trigger

  const terminal =
    layout.terminal.y < bottom.y + ROW_PITCH
      ? { ...layout.terminal, y: bottom.y + ROW_PITCH }
      : layout.terminal

  return { ...layout, trigger, terminal }
}
