"use client"

import * as React from "react"
import { Crosshair, Minus, Plus } from "lucide-react"

import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

import {
  BLOCK_H,
  CAPTION_H,
  CARD_H,
  CARD_W,
  orderedSteps,
  TERMINAL_UID,
  TRIGGER_UID,
  type FlowLayout,
  type Point,
} from "./flow-model"
import { FlowNodeCard } from "./flow-node-card"

/**
 * The flow canvas — a pan-and-zoom surface where cards sit wherever they are
 * put.
 *
 * ### Cards are placed, and the order is read back off the placement
 *
 * This was a single centred column with fixed gaps, and dropping a card
 * snapped it into the nearest gap. Cards now carry a coordinate and stay
 * exactly where they are released.
 *
 * The chain that gets saved is the steps **sorted top to bottom**
 * (`orderedSteps`). That is the whole trick: there is no second ordering
 * hiding behind the layout that could disagree with it, so dragging a card
 * above another *is* the reorder — the step numbers in the captions renumber
 * under the cursor as it happens. Position is free and still meaningful.
 *
 * See `flow-model.ts` for why the coordinates cannot go to the server and
 * where they go instead.
 *
 * ### Dragging is local, and committed once
 *
 * While a card moves, its position lives in this component's own state,
 * updated once per frame. Only on release does it go up to the owner.
 * Keeping it here means a drag re-renders the canvas and nothing else — not
 * the rail, not the header — while the wires and the step numbers still
 * follow the card in real time, which they must: they are the feedback that
 * says what the drop will mean.
 *
 * ### Vertical, and that is a direction decision
 *
 * The flow reads top to bottom, so nothing here flips for Arabic. Centring
 * offsets use `left-1/2 -translate-x-1/2` rather than `start-1/2`: the
 * logical property anchors from the right under RTL while the negative
 * translate keeps pulling left, putting the element half its own width
 * off-centre.
 *
 * ### Wheel is a native listener, not `onWheel`
 *
 * React registers `wheel` at the root as a **passive** listener, so
 * `preventDefault()` inside an `onWheel` prop is ignored. Ctrl-wheel would
 * then zoom the browser instead of the canvas, which is the one gesture
 * people try first.
 */

const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.6
const ZOOM_STEP = 0.2

/**
 * How far a wheel notch pans and zooms.
 *
 * A canvas is not a document: one notch that scrolls a page by a couple of
 * lines moves a flow by almost nothing. The divisor is what the zoom exponent
 * is divided by — **smaller is faster**, because it is the denominator.
 */
const PAN_SPEED = 1.6
const ZOOM_WHEEL_DIVISOR = 180

/**
 * A wheel delta in pixels, whatever unit it arrived in.
 *
 * `deltaY` is only in pixels when `deltaMode` is `DOM_DELTA_PIXEL`. Firefox
 * reports mouse wheels in **lines** (about 3 per notch), which is why panning
 * can crawl on one browser and feel fine on another.
 */
function wheelPixels(value: number, mode: number) {
  if (mode === 1) return value * 16
  if (mode === 2) return value * 400
  return value
}

/** Breathing room around the diagram when fitting it to the window. */
const CANVAS_PADDING = 72

/** The "nothing here yet" panel. Fixed, so it can be centred in the gap. */
const EMPTY_HINT_H = 92

type Transform = { x: number; y: number; zoom: number }

const IDENTITY: Transform = { x: 0, y: 0, zoom: 1 }

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** What the owner needs from the canvas to place a dropped library step. */
export type CanvasView = {
  /** Viewport coordinates to canvas coordinates, undoing pan and zoom. */
  toCanvas: (clientX: number, clientY: number) => { x: number; y: number }
  /** Whether the point is over the canvas at all. */
  contains: (clientX: number, clientY: number) => boolean
}

/* -------------------------------------------------------------------------
 * Wires
 * ---------------------------------------------------------------------- */

/**
 * The wire between two cards, and the point halfway along it.
 *
 * ### The ports are chosen, not fixed
 *
 * Bottom-of-A to top-of-B is right only while B is actually *below* A. Put
 * two cards side by side and B's top edge is above A's bottom edge, so a
 * bottom-to-top curve has to dive down, turn around and climb back up — a
 * loop that reads as two separate lines crossing the gap rather than one
 * connection. Which is exactly what it looked like.
 *
 * So the exit and entry are picked from the geometry: stacked cards connect
 * bottom to top with vertical handles, and cards that are level (or where the
 * next one sits higher) connect side to side with horizontal ones. One sweep
 * either way, and no loop in any arrangement.
 *
 * ### The midpoint is the real one
 *
 * `(a + b) / 2` is the midpoint of the straight line between the endpoints,
 * which on a curved wire is not on the wire — the insert button would float
 * beside it. This evaluates the cubic at `t = 0.5`, which is exact and is two
 * multiplications.
 */

/** Below this much clear vertical space, two cards count as side by side. */
const STACK_THRESHOLD = 28

type Wire = { d: string; mid: Point }

function wireBetween(a: Point, b: Point): Wire {
  const aBottom = a.y + BLOCK_H
  const bTop = b.y + CAPTION_H
  const gap = bTop - aBottom

  let p0: Point
  let p1: Point
  let p2: Point
  let p3: Point

  if (gap >= STACK_THRESHOLD) {
    // Stacked: out of the bottom, into the top.
    p0 = { x: a.x + CARD_W / 2, y: aBottom }
    p3 = { x: b.x + CARD_W / 2, y: bTop }
    // The handle grows with the drop *and* with the sideways offset, so a
    // long diagonal bows instead of cutting straight across the corner.
    const handle = Math.min(
      160,
      Math.max(34, gap * 0.55 + Math.abs(p3.x - p0.x) * 0.16)
    )
    p1 = { x: p0.x, y: p0.y + handle }
    p2 = { x: p3.x, y: p3.y - handle }
  } else {
    // Level, or the next card is higher: out of one side, into the other.
    const rightward = b.x >= a.x
    p0 = {
      x: rightward ? a.x + CARD_W : a.x,
      y: a.y + CAPTION_H + CARD_H / 2,
    }
    p3 = {
      x: rightward ? b.x : b.x + CARD_W,
      y: b.y + CAPTION_H + CARD_H / 2,
    }
    const handle = Math.min(160, Math.max(40, Math.abs(p3.x - p0.x) * 0.5))
    p1 = { x: p0.x + (rightward ? handle : -handle), y: p0.y }
    p2 = { x: p3.x - (rightward ? handle : -handle), y: p3.y }
  }

  return {
    d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`,
    mid: {
      x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
      y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
    },
  }
}

/* -------------------------------------------------------------------------
 * Canvas
 * ---------------------------------------------------------------------- */

export type FlowCanvasProps = {
  /** The steps and the two ends. Everything on the canvas is placed. */
  layout: FlowLayout
  /** Committed when a card is released. Takes an end's uid too. */
  onCardMove: (uid: string, x: number, y: number) => void
  onRemove: (uid: string) => void
  /** Where the next library pick lands: its order index and its position. */
  armed: { index: number; x: number; y: number } | null
  onArm: (armed: { index: number; x: number; y: number } | null) => void
  /** Exchanges two cards' positions — what a reorder is, here. */
  onSwap: (aUid: string, bUid: string) => void
  fitSignal: number
  templateTitle: string
  onZoomChange: (zoom: number) => void
  /** Filled in by the canvas so the owner can place a dropped library step. */
  viewRef: React.RefObject<CanvasView | null>
}

export function FlowCanvas({
  layout,
  onCardMove,
  onRemove,
  armed,
  onArm,
  onSwap,
  fitSignal,
  templateTitle,
  onZoomChange,
  viewRef,
}: FlowCanvasProps) {
  const t = useT()

  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const [transform, setTransform] = React.useState<Transform>(IDENTITY)
  const [panning, setPanning] = React.useState(false)

  /** The card being moved right now, and where it currently is. */
  const [live, setLive] = React.useState<{
    uid: string
    x: number
    y: number
  } | null>(null)

  /**
   * Everything on the canvas at its current position, with whichever card is
   * being dragged shifted to where the pointer has it.
   *
   * One override applied in one place, so a step and an end are moved by
   * exactly the same code path — which is the point: an end is a card you can
   * place, not a decoration bolted to the first and last step.
   */
  const at = React.useCallback(
    (uid: string, base: Point): Point =>
      live && live.uid === uid ? { x: live.x, y: live.y } : base,
    [live]
  )

  /** Steps in saved order, with the moving card at its live position. */
  const ordered = React.useMemo(() => {
    const merged = live
      ? layout.steps.map((s) =>
          s.uid === live.uid ? { ...s, x: live.x, y: live.y } : s
        )
      : layout.steps
    return orderedSteps(merged)
  }, [layout.steps, live])

  const trigger = at(TRIGGER_UID, layout.trigger)
  const terminal = at(TERMINAL_UID, layout.terminal)

  /* -- Geometry -------------------------------------------------------- */

  /** Everything the diagram covers, in canvas space. */
  const bounds = React.useMemo(() => {
    const points: Point[] = [trigger, terminal, ...ordered]
    const minX = Math.min(...points.map((p) => p.x))
    const minY = Math.min(...points.map((p) => p.y))
    const maxX = Math.max(...points.map((p) => p.x)) + CARD_W
    const maxY = Math.max(...points.map((p) => p.y)) + BLOCK_H
    return { minX, minY, width: maxX - minX, height: maxY - minY }
  }, [trigger, terminal, ordered])

  /* -- View ------------------------------------------------------------ */

  const toCanvas = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - transform.x) / transform.zoom,
        y: (clientY - rect.top - transform.y) / transform.zoom,
      }
    },
    [transform]
  )

  React.useEffect(() => {
    viewRef.current = {
      toCanvas,
      contains: (clientX, clientY) => {
        const rect = viewportRef.current?.getBoundingClientRect()
        if (!rect) return false
        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        )
      },
    }
  }, [toCanvas, viewRef])

  React.useEffect(() => {
    onZoomChange(transform.zoom)
  }, [onZoomChange, transform.zoom])

  /**
   * Centres the diagram and scales it down until it fits, never up.
   *
   * Zooming past 100% to fill a tall window makes a three-step flow look like
   * a poster; the cards are drawn at the size they are meant to be read at.
   */
  const fit = React.useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const vw = viewport.clientWidth
    const vh = viewport.clientHeight
    const cw = bounds.width + CANVAS_PADDING * 2
    const ch = bounds.height + CANVAS_PADDING * 2
    if (!cw || !ch) return

    const zoom = clampZoom(Math.min(1, Math.min(vw / cw, vh / ch)))
    setTransform({
      zoom,
      x: (vw - bounds.width * zoom) / 2 - bounds.minX * zoom,
      y: (vh - bounds.height * zoom) / 2 - bounds.minY * zoom,
    })
  }, [bounds])

  /**
   * Re-fit only when the owner asks — a load, or a discard.
   *
   * Explicitly **not** on every change of `steps`, which is what the previous
   * derived-column version did. A card has now been put somewhere on purpose,
   * and moving the view out from under it throws that away. Held in a ref so
   * that re-fitting does not itself depend on the bounds it is measuring.
   */
  const fitRef = React.useRef(fit)
  React.useEffect(() => {
    fitRef.current = fit
  }, [fit])
  React.useEffect(() => {
    fitRef.current()
  }, [fitSignal])

  const zoomByStep = React.useCallback((delta: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    setTransform((prev) => {
      const zoom = clampZoom(prev.zoom + delta)
      if (zoom === prev.zoom) return prev
      const ox = viewport.clientWidth / 2
      const oy = viewport.clientHeight / 2
      const ratio = zoom / prev.zoom
      return {
        zoom,
        x: ox - (ox - prev.x) * ratio,
        y: oy - (oy - prev.y) * ratio,
      }
    })
  }, [])

  // Native listener: React's `wheel` is passive, so an `onWheel` prop cannot
  // call `preventDefault`.
  React.useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const dx = wheelPixels(event.deltaX, event.deltaMode)
      const dy = wheelPixels(event.deltaY, event.deltaMode)

      if (event.ctrlKey || event.metaKey) {
        setTransform((prev) => {
          const zoom = clampZoom(prev.zoom * Math.exp(-dy / ZOOM_WHEEL_DIVISOR))
          if (zoom === prev.zoom) return prev
          const ratio = zoom / prev.zoom
          return {
            zoom,
            x: px - (px - prev.x) * ratio,
            y: py - (py - prev.y) * ratio,
          }
        })
        return
      }

      const [panX, panY] = event.shiftKey && dx === 0 ? [dy, 0] : [dx, dy]
      setTransform((prev) => ({
        ...prev,
        x: prev.x - panX * PAN_SPEED,
        y: prev.y - panY * PAN_SPEED,
      }))
    }

    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [])

  /* -- Panning --------------------------------------------------------- */

  const pan = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as HTMLElement
    // Anything with a gesture of its own keeps it — a card is dragged, a
    // button is pressed. Either would otherwise also drag the whole canvas.
    if (target.closest("button, a, input, [data-flow-card]")) return

    pan.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current
    if (!p || p.pointerId !== event.pointerId) return
    setTransform((prev) => ({
      ...prev,
      x: p.originX + (event.clientX - p.startX),
      y: p.originY + (event.clientY - p.startY),
    }))
  }

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current
    if (!p || p.pointerId !== event.pointerId) return
    pan.current = null
    setPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  /* -- Moving a card --------------------------------------------------- */

  /**
   * Free dragging, in canvas space.
   *
   * The grab offset is taken once so the card does not jump to centre itself
   * under the cursor, and every position after that is the pointer minus that
   * offset — converted through the current zoom, so a card tracks the cursor
   * exactly whether the canvas is at 25% or 160%.
   */
  const grab = React.useRef<{
    uid: string
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const frame = React.useRef(0)
  const latest = React.useRef<{ uid: string; x: number; y: number } | null>(null)

  const beginDrag = (event: React.PointerEvent, uid: string, base: Point) => {
    if (event.pointerType === "mouse" && event.button !== 0) return
    const point = toCanvas(event.clientX, event.clientY)
    grab.current = {
      uid,
      pointerId: event.pointerId,
      offsetX: point.x - base.x,
      offsetY: point.y - base.y,
    }
    latest.current = null
    // Arming a gap and then moving a card are conflicting intents; the drag
    // is the more recent one.
    onArm(null)
    setLive({ uid, x: base.x, y: base.y })
    // Capture on the card, so a fast drag that outruns the pointer keeps
    // delivering moves to it rather than to whatever is underneath.
    event.currentTarget.setPointerCapture(event.pointerId)
    event.stopPropagation()
  }

  const moveCard = (event: React.PointerEvent) => {
    const g = grab.current
    if (!g || g.pointerId !== event.pointerId) return
    const point = toCanvas(event.clientX, event.clientY)
    latest.current = {
      uid: g.uid,
      x: point.x - g.offsetX,
      y: point.y - g.offsetY,
    }
    // One state update per frame. A pointer fires several times between
    // paints, and each one re-renders every card and every wire.
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (latest.current) setLive({ ...latest.current })
    })
  }

  const endCardDrag = (event: React.PointerEvent) => {
    const g = grab.current
    if (!g || g.pointerId !== event.pointerId) return
    if (frame.current) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
    const final = latest.current
    grab.current = null
    latest.current = null
    setLive(null)
    // Committed only here, and only if the card actually went somewhere.
    if (final) onCardMove(final.uid, final.x, final.y)
  }

  const zoomPercent = Math.round(transform.zoom * 100)

  /** The wire path, in saved order: trigger → steps → terminal. */
  const chain: Point[] = [
    trigger,
    ...ordered.map((s) => ({ x: s.x, y: s.y })),
    terminal,
  ]

  // Computed once and read by both the paths and the insert buttons, so a
  // button can never sit on a curve that was worked out slightly differently
  // from the one it is supposed to be on.
  const wires = chain.slice(0, -1).map((from, i) => wireBetween(from, chain[i + 1]))

  return (
    <div
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      role="application"
      aria-label={t("flow.canvasLabel", { template: templateTitle })}
      className={cn(
        "flow-canvas relative flex-1 touch-none overflow-hidden bg-background-subtle select-none",
        panning ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        // A dotted grid pinned to the transform, so panning moves the ground
        // with the content instead of sliding content over a static texture.
        backgroundImage:
          "radial-gradient(circle at 1px 1px, var(--flow-dot) 1px, transparent 0)",
        backgroundSize: `${24 * transform.zoom}px ${24 * transform.zoom}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
      }}
    >
      <div
        className="group/chain absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.zoom})`,
        }}
      >
        {/* Wires, under the cards.

            A 1×1 SVG with `overflow-visible` rather than one sized to the
            bounds: cards can be moved anywhere, including to negative
            coordinates, and a sized viewport would clip whatever went above
            or left of the origin. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 overflow-visible"
          width={1}
          height={1}
        >
          {wires.map((wire, i) => {
            return (
              <g key={i}>
                <path
                  d={wire.d}
                  fill="none"
                  strokeWidth="1.5"
                  className="stroke-(--flow-wire)"
                />
                <path
                  d={wire.d}
                  fill="none"
                  strokeWidth="1.5"
                  className={cn(
                    "flow-wire-pulse",
                    armed?.index === i
                      ? "stroke-(--flow-wire-live)"
                      : "stroke-transparent"
                  )}
                />
              </g>
            )
          })}
        </svg>

        {/* Insert buttons, at each wire's midpoint. Positioned rather than
            laid out, because the wire they belong to now runs between two
            arbitrary points. */}
        {wires.map((wire, i) => {
          const mid = wire.mid
          const isArmed = armed?.index === i
          return (
            <button
              key={`insert-${i}`}
              type="button"
              onClick={() =>
                onArm(
                  isArmed
                    ? null
                    : {
                        index: i,
                        // A step armed here lands centred on the wire it was
                        // armed from, which is where the gap visibly is.
                        x: mid.x - CARD_W / 2,
                        y: mid.y - BLOCK_H / 2,
                      }
                )
              }
              aria-pressed={isArmed}
              title={isArmed ? t("flow.insertHereArmed") : t("flow.insertHere")}
              aria-label={t("flow.insertAtPosition", { position: i + 1 })}
              style={{ left: mid.x, top: mid.y }}
              className={cn(
                "absolute inline-flex size-6 -translate-x-1/2 -translate-y-1/2",
                "items-center justify-center rounded-full border",
                "transition-all duration-120 outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring",
                isArmed
                  ? cn(
                      "scale-110 border-(--flow-wire-live) bg-(--flow-wire-live)",
                      "text-white ring-4 ring-(--flow-wire-glow)"
                    )
                  : cn(
                      "border-border bg-surface text-text-muted",
                      // Quiet at rest so a ten-step flow is not ten buttons
                      // shouting; the diagram reveals them together.
                      "opacity-0 group-hover/chain:opacity-100 focus-visible:opacity-100",
                      // No hover on a touch screen, where this is the only
                      // way to insert at a chosen position.
                      "pointer-coarse:opacity-100",
                      "hover:scale-110 hover:border-(--flow-wire-live) hover:text-(--flow-wire-live)"
                    ),
                "motion-reduce:transition-none motion-reduce:hover:scale-100"
              )}
            >
              <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
            </button>
          )
        })}

        {/* The two ends. Draggable like anything else — they are not rows in
            the database, so their coordinates are pure layout, but they are
            placed rather than derived. Deriving them from the first and last
            step meant that moving one card slid both ends along with it,
            which with a short chain is the whole diagram moving. */}
        <div
          className={cn("absolute", live?.uid === TRIGGER_UID && "z-20")}
          style={{ left: trigger.x, top: trigger.y }}
        >
          <FlowNodeCard
            variant="trigger"
            caption={t("flow.triggerEyebrow")}
            title={t("flow.triggerTitle")}
            detailLabel={t("flow.sectionTemplate")}
            detailBody={templateTitle}
            dragging={live?.uid === TRIGGER_UID}
            onDragStart={(event) => beginDrag(event, TRIGGER_UID, layout.trigger)}
            onDragMove={moveCard}
            onDragEnd={endCardDrag}
          />
        </div>

        {ordered.map((step, index) => {
          const previous = ordered[index - 1]
          const next = ordered[index + 1]
          const moving = live?.uid === step.uid
          return (
            <div
              key={step.uid}
              // The card being moved rides above the others, so it is never
              // hidden behind one it is passing over.
              className={cn("absolute", moving && "z-20")}
              style={{ left: step.x, top: step.y }}
            >
              <FlowNodeCard
                variant="step"
                color={step.node.color}
                caption={t("flow.stepEyebrow", { position: index + 1 })}
                title={step.node.name}
                detailLabel={t("flow.sectionStage")}
                detailBody={
                  step.node.organization?.name ?? t("flow.stepSubtitleFallback")
                }
                dragging={moving}
                onDragStart={(event) => beginDrag(event, step.uid, step)}
                onDragMove={moveCard}
                onDragEnd={endCardDrag}
                // The arrows exchange two cards' positions, which is what a
                // reorder *is* once the order is read off the layout.
                onMoveUp={previous ? () => onSwap(step.uid, previous.uid) : undefined}
                onMoveDown={next ? () => onSwap(step.uid, next.uid) : undefined}
                onRemove={() => onRemove(step.uid)}
                canMoveUp={!!previous}
                canMoveDown={!!next}
              />
            </div>
          )
        })}

        <div
          className={cn("absolute", live?.uid === TERMINAL_UID && "z-20")}
          style={{ left: terminal.x, top: terminal.y }}
        >
          <FlowNodeCard
            variant="terminal"
            caption={t("flow.terminalEyebrow")}
            title={t("flow.terminalTitle")}
            detailLabel={t("flow.sectionOutcome")}
            detailBody={t("flow.terminalSubtitle")}
            dragging={live?.uid === TERMINAL_UID}
            onDragStart={(event) => beginDrag(event, TERMINAL_UID, layout.terminal)}
            onDragMove={moveCard}
            onDragEnd={endCardDrag}
          />
        </div>

        {/* An empty chain is the normal state of a new template, so the space
            between the two ends says what to do with it.

            Centred in the actual gap rather than pinned below the trigger.
            Pinned, it sat on top of the terminal card whenever the two ends
            were close — which they were by default. And it stands down
            entirely when the gap is too small to hold it, because the ends
            can now be dragged together and a hint overlapping a card is
            worse than no hint. */}
        {(() => {
          if (ordered.length > 0) return null
          const gapTop = trigger.y + BLOCK_H
          const gapBottom = terminal.y + CAPTION_H
          const gap = gapBottom - gapTop
          if (gap < EMPTY_HINT_H + 40) return null
          return (
            <div
              className={cn(
                "absolute flex flex-col items-center justify-center gap-1",
                "rounded-xl border border-dashed border-border-strong bg-surface/50",
                "px-4 text-center"
              )}
              style={{
                left: trigger.x,
                top: gapTop + (gap - EMPTY_HINT_H) / 2,
                width: CARD_W,
                height: EMPTY_HINT_H,
              }}
            >
              <p className="text-[13px] font-medium text-text-secondary">
                {t("flow.emptyTitle")}
              </p>
              <p className="text-[12px] leading-relaxed text-text-muted">
                {t("flow.emptyHint")}
              </p>
            </div>
          )
        })()}
      </div>

      {/* Zoom controls. */}
      <div
        className={cn(
          "absolute end-4 bottom-4 z-30 flex items-center gap-0.5",
          "rounded-lg border border-border bg-surface p-1",
          "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_-16px_rgba(0,0,0,0.3)]",
          "dark:shadow-none"
        )}
      >
        <ZoomButton
          onClick={() => zoomByStep(-ZOOM_STEP)}
          disabled={transform.zoom <= MIN_ZOOM + 0.001}
          label={t("flow.zoomOut")}
        >
          <Minus className="size-3.5" strokeWidth={2} aria-hidden />
        </ZoomButton>

        {/* The readout is the reset: pressing it returns to 100%. */}
        <button
          type="button"
          onClick={() => zoomByStep(1 - transform.zoom)}
          title={t("flow.resetZoom")}
          className={cn(
            "h-7 min-w-12 rounded-[6px] px-1.5 text-[12px] font-medium tabular-nums",
            "text-text-secondary transition-colors duration-120 outline-none",
            "hover:bg-muted hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {zoomPercent}%
        </button>

        <ZoomButton
          onClick={() => zoomByStep(ZOOM_STEP)}
          disabled={transform.zoom >= MAX_ZOOM - 0.001}
          label={t("flow.zoomIn")}
        >
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
        </ZoomButton>

        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />

        <ZoomButton onClick={() => fitRef.current()} label={t("flow.fitToView")}>
          <Crosshair className="size-3.5" strokeWidth={2} aria-hidden />
        </ZoomButton>

      </div>
    </div>
  )
}

function ZoomButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-[6px]",
        "text-text-secondary transition-colors duration-120 outline-none",
        "hover:bg-muted hover:text-text",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40"
      )}
    >
      {children}
    </button>
  )
}
