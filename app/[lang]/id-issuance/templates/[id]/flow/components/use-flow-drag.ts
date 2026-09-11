"use client"

import * as React from "react"

import type { Node } from "@/features/nodes/types"

/**
 * Dragging a step out of the library rail and onto the canvas.
 *
 * Only that one journey. A card already on the canvas is moved by the canvas
 * itself (`flow-canvas.tsx`), which owns the pan/zoom transform and can place
 * it freely; this hook exists because the rail is a *sibling* of the canvas,
 * so a gesture that starts there has nowhere else to live.
 *
 * ### Why not `draggable` + `dataTransfer`
 *
 * That is what this was, and it did not work. Three separate reasons, any one
 * of which is enough:
 *
 *  1. **`user-select: none` suppresses `dragstart`.** The canvas sets it so a
 *     pan does not smear a text selection across the page, and WebKit and
 *     Blink both decline to start a native drag from inside such a subtree.
 *     The palette chips dragged fine — they live outside the canvas — while
 *     the cards on it did not, which is exactly the shape of the bug that got
 *     reported twice.
 *  2. **It does not exist on touch.** No `dragstart`, no `drop`, nothing. Half
 *     the ways into this app are tablets.
 *  3. **The effect negotiation is invisible when it fails.** A `dropEffect`
 *     the source did not permit means no `drop` event and no error — a cursor
 *     that silently refuses.
 *
 * Pointer events have none of that. They fire on every input, they ignore
 * `user-select`, and the hit test is ours rather than the browser's.
 *
 * ### It reports where, not what
 *
 * The drop is handed back as raw viewport coordinates. Turning those into a
 * position on the canvas means undoing its pan and zoom, which only the
 * canvas knows — so it exposes a converter and the owner calls it. This hook
 * stays free of any geometry it would have to keep in step with.
 */

/** What is being dragged. A step already in the chain knows where it sits. */
export type FlowDragSource =
  | { kind: "library"; node: Node }
  | { kind: "chain"; index: number; node: Node }

export type FlowDragState = {
  source: FlowDragSource
}

/**
 * The pointer position is **not** in that state, on purpose.
 *
 * The ghost is a full-size card and it has to keep up with the cursor with no
 * lag. Putting its coordinates in React state would re-render the builder,
 * the rail and every card on the canvas dozens of times a second, to move one
 * absolutely positioned element.
 *
 * So position is written straight to the ghost's `translate` each frame, and
 * the only thing that goes through React is *whether* a drag is happening —
 * twice per gesture.
 *
 * The wrinkle is that any re-render would otherwise paint over the imperative
 * value with whatever the JSX says. That is what the layout effect below is
 * for: it repaints after every render, so the two writers cannot disagree.
 */

/**
 * How far the pointer travels before a press becomes a drag.
 *
 * Without a threshold every click is a zero-length drag, and a chip in the
 * library could never simply be pressed to append it.
 */
const DRAG_THRESHOLD = 5

export function useFlowDrag(
  /** Where the step was released, in viewport coordinates. */
  onDrop: (source: FlowDragSource, clientX: number, clientY: number) => void
) {
  const [state, setState] = React.useState<FlowDragState | null>(null)

  /** Set on press, promoted to a real drag once the threshold is crossed. */
  const pending = React.useRef<{
    source: FlowDragSource
    x: number
    y: number
    pointerId: number
  } | null>(null)
  const moved = React.useRef(false)

  /** Attach to the element that follows the cursor. */
  const ghostRef = React.useRef<HTMLDivElement | null>(null)
  const position = React.useRef({ x: 0, y: 0 })
  const frame = React.useRef(0)

  /**
   * Writes the pointer position onto the ghost, at most once per frame.
   *
   * `translate` rather than `transform`: it is an independent CSS property, so
   * the element keeps whatever `transform` its own styles set — the centring
   * and the canvas-matching scale — without this having to know about either.
   */
  const paint = React.useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = ghostRef.current
      if (!el) return
      el.style.translate = `${position.current.x}px ${position.current.y}px`
    })
  }, [])

  // After every render, including the one that mounts the ghost. Without this
  // the ghost appears at the top-left corner for a frame, and every slot
  // change would snap it back there.
  React.useLayoutEffect(() => {
    const el = ghostRef.current
    if (!el) return
    el.style.translate = `${position.current.x}px ${position.current.y}px`
  })

  /**
   * A drag ends with a `pointerup`, and the browser fires a `click` straight
   * after it. Without this the chip you just dragged out of the library would
   * also be *pressed*, appending a second copy to the end of the chain.
   */
  const swallowClick = React.useRef(false)

  /** Listeners are only attached while something is actually being pressed. */
  const [armed, setArmed] = React.useState(false)

  // Kept in a ref so the effect below does not resubscribe on every render of
  // the component that owns the callback.
  const onDropRef = React.useRef(onDrop)
  React.useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  const begin = React.useCallback(
    (event: React.PointerEvent, source: FlowDragSource) => {
      // Left button only. Right opens the context menu and middle pans.
      if (event.pointerType === "mouse" && event.button !== 0) return
      pending.current = {
        source,
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      }
      moved.current = false
      position.current = { x: event.clientX, y: event.clientY }
      setArmed(true)
    },
    []
  )

  React.useEffect(() => {
    if (!armed) return

    const reset = () => {
      pending.current = null
      moved.current = false
      if (frame.current) {
        cancelAnimationFrame(frame.current)
        frame.current = 0
      }
      setState(null)
      setArmed(false)
    }

    const move = (event: PointerEvent) => {
      const press = pending.current
      if (!press || event.pointerId !== press.pointerId) return

      if (
        !moved.current &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) <
          DRAG_THRESHOLD
      ) {
        return
      }
      position.current = { x: event.clientX, y: event.clientY }

      // Promote once. After that React is out of the loop entirely — the
      // ghost is the only thing that moves, and it moves imperatively.
      if (!moved.current) {
        moved.current = true
        setState({ source: press.source })
      }
      paint()
    }

    const finish = (event: PointerEvent) => {
      const press = pending.current
      if (!press || event.pointerId !== press.pointerId) return

      if (moved.current) {
        swallowClick.current = true
        onDropRef.current(press.source, event.clientX, event.clientY)
      }
      reset()
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // Escape abandons the drag without dropping — and counts as a drag, so
      // the click that never comes is suppressed either way.
      if (moved.current) swallowClick.current = true
      reset()
    }

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", reset)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", reset)
      window.removeEventListener("keydown", onKey)
    }
    // `paint` is stable (`useCallback` with no deps) but naming it here keeps
    // the exhaustive-deps rule honest rather than silenced.
  }, [armed, paint])

  /**
   * Whether the click now arriving is the tail of a drag, and should be
   * ignored. Reading it clears it, so a genuine press straight afterwards
   * still counts.
   */
  const consumeClick = React.useCallback(() => {
    if (!swallowClick.current) return false
    swallowClick.current = false
    return true
  }, [])

  return { drag: state, begin, consumeClick, ghostRef }
}
