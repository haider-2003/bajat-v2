"use client"

import * as React from "react"
import QRCode from "qrcode"

import {
  DEFAULT_QR_MARGIN,
  GUIDE_COLOR,
  PAGE_GAP,
  ZOOM_MAX,
  ZOOM_MIN,
  variableMeta,
} from "@/features/templates/editor-constants"
import {
  computeDragSnap,
  useEditorStore,
} from "@/features/templates/editor-store"
import type { CanvasElement, EditorPage } from "@/features/templates/editor-types"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The authoring surface — docs/photo-editor-spec.md §5.1 and §11.
 *
 * ### An infinite pan/zoom canvas, not a scroll box
 *
 * The viewport is a fixed window over a `translate(pan) scale(zoom)` plane, the
 * way a node editor works: drag empty space to pan, wheel to pan, ⌘/Ctrl+wheel
 * to zoom **about the cursor**. The dot grid is painted on the window and its
 * size and offset track the transform, so the grid belongs to the work rather
 * than to the frame — that is what stops a zoom from feeling like a resize.
 *
 * Zooming about the cursor is the part worth getting exactly right: keep the
 * canvas point under the pointer fixed, or every zoom step throws the operator's
 * place away and they re-find it by hand.
 *
 * ### Both faces, stacked
 *
 * Not tabs. §5.1 lays the pages out vertically with a 60-unit gap. On a
 * two-sided document the thing an operator most wants while placing a back-side
 * element is to see the front, so the inactive face desaturates rather than
 * disappearing.
 *
 * ### DOM, not Konva — for now
 *
 * Every element is a positioned `div`, which buys real text rendering, focus
 * and hit-testing for free and is comfortable to about fifty layers. What it
 * does *not* buy is §11.5's transform handles with a bounding-box constraint
 * callback; the handles here are visual, and resizing runs through the property
 * bar's W/H fields. That is the one thing worth porting to Konva, and the
 * geometry model is already unscaled so the port touches only this file.
 *
 * ### Artwork colors are literal
 *
 * Nothing inside `.card` reads a theme token. The card is printed: if the
 * artwork followed `data-theme`, someone designing at night would lay out a
 * card in colors that do not exist on the stock.
 */

export function Stage() {
  const doc = useEditorStore((s) => s.doc)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const activePage = useEditorStore((s) => s.activePage)
  const selectedId = useEditorStore((s) => s.selectedId)
  const styleSource = useEditorStore((s) => s.styleSource)

  const select = useEditorStore((s) => s.select)
  const setActivePage = useEditorStore((s) => s.setActivePage)
  const updateElement = useEditorStore((s) => s.updateElement)
  const pushHistory = useEditorStore((s) => s.pushHistory)
  const applyStyleTo = useEditorStore((s) => s.applyStyleTo)
  // The wheel handler reads the store imperatively — it is a native listener
  // outside React's render cycle, so a subscribed selector would only give it
  // stale values.
  const setPan = useEditorStore((s) => s.setPan)
  const setViewportSize = useEditorStore((s) => s.setViewportSize)
  const fitView = useEditorStore((s) => s.fitView)

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [panning, setPanning] = React.useState(false)
  const panRef = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const [guides, setGuides] = React.useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  })
  const [altHeld, setAltHeld] = React.useState(false)
  const [hoverId, setHoverId] = React.useState<string | null>(null)

  const dragRef = React.useRef<{
    id: string
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  const resizeRef = React.useRef<{
    id: string
    handle: string
    startX: number
    startY: number
    box: { x: number; y: number; width: number; height: number }
    pushed: boolean
  } | null>(null)

  /**
   * Track the window's size, and frame the content the first time it is known.
   *
   * The initial fit cannot run on mount: the element has no box until layout,
   * so `fitView` would divide by zero and leave the pages off-screen. Doing it
   * from the observer's first measurement is the only moment both the viewport
   * and the document are real.
   */
  React.useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    let framed = false
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setViewportSize(width, height)
      if (!framed && width > 0 && height > 0) {
        framed = true
        fitView()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [setViewportSize, fitView])

  /**
   * Re-frame when the space changes — but only while the view is still ours.
   *
   * Resizing the window, opening a panel or wrapping the top row all change
   * where the middle of the work area is. Leaving the card where it was puts it
   * behind the drawer or off the bottom of a short window, and neither is
   * something the operator asked for. The moment they pan or zoom themselves,
   * `viewTouched` latches and this stops: a canvas that re-centres itself under
   * your hands is worse than one that is slightly off.
   */
  const safeArea = useEditorStore((s) => s.safeArea)
  const viewportW = useEditorStore((s) => s.viewportW)
  const viewportH = useEditorStore((s) => s.viewportH)
  React.useEffect(() => {
    const state = useEditorStore.getState()
    if (state.viewTouched) return
    if (!state.viewportW || !state.viewportH) return
    state.fitView()
  }, [safeArea, viewportW, viewportH])

  /**
   * Alt tracking — §11.3.
   *
   * The `blur` reset is not defensive padding: on Windows and most Linux WMs,
   * pressing Alt focuses the menu bar and the keyup never reaches the page, so
   * without it the overlay sticks on until the next Alt press.
   */
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.altKey) setAltHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (!e.altKey) setAltHeld(false)
    }
    const blur = () => setAltHeld(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent, element: CanvasElement, page: number) => {
    if (page !== activePage) {
      setActivePage(page)
      select(element.id)
      return
    }
    // §13.2 — the paste fires on selecting a *different* element, so it has to
    // happen before the selection changes.
    if (styleSource && styleSource !== element.id) applyStyleTo(element.id)
    select(element.id)
    if (element.locked) return

    dragRef.current = {
      id: element.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: element.x,
      originY: element.y,
      moved: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onResizeStart = (e: React.PointerEvent, element: CanvasElement, handle: string) => {
    // The handle sits outside the element's own box, so without this the
    // viewport would read the press as empty canvas: deselect, then pan.
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = {
      id: element.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      box: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      },
      pushed: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizeMove = (e: React.PointerEvent) => {
    const resize = resizeRef.current
    if (!resize) return
    const state = useEditorStore.getState()

    if (!resize.pushed) {
      pushHistory()
      resize.pushed = true
    }

    const dx = (e.clientX - resize.startX) / zoom
    const dy = (e.clientY - resize.startY) / zoom
    const next = resizeBox(
      resize.box,
      resize.handle,
      dx,
      dy,
      { width: state.doc.width, height: state.doc.height },
      e.shiftKey
    )
    updateElement(resize.id, next)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const state = useEditorStore.getState()
    const element = state.element(drag.id)
    if (!element) return

    if (!drag.moved) {
      // The first move is what makes this a drag rather than a click, so the
      // history entry is pushed here — a click that never moves adds nothing.
      pushHistory()
      drag.moved = true
    }

    const siblings = state.doc.pages[activePage].elements.filter((el) => el.id !== drag.id)
    const snapped = computeDragSnap(
      {
        x: drag.originX + (e.clientX - drag.startX) / zoom,
        y: drag.originY + (e.clientY - drag.startY) / zoom,
        width: element.width,
        height: element.height,
      },
      siblings,
      { width: state.doc.width, height: state.doc.height }
    )

    updateElement(drag.id, { x: snapped.x, y: snapped.y })
    setGuides({ x: snapped.guideX, y: snapped.guideY })
  }

  const endDrag = () => {
    dragRef.current = null
    resizeRef.current = null
    panRef.current = null
    setPanning(false)
    setGuides({ x: null, y: null })
  }

  /**
   * Wheel: pan by default, zoom with ⌘/Ctrl held.
   *
   * Registered natively rather than through React's `onWheel` because the
   * listener has to be non-passive to call `preventDefault` — without it the
   * browser page-zooms on ⌘+wheel and the canvas never sees the gesture.
   */
  React.useEffect(() => {
    const node = viewportRef.current
    if (!node) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const state = useEditorStore.getState()

      if (e.ctrlKey || e.metaKey) {
        const rect = node.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        // Exponential so a trackpad feels linear; clamped before the pan is
        // solved, or the correction is computed against a zoom we never apply.
        const next = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, state.zoom * Math.exp(-e.deltaY / 320))
        )
        // Keep the canvas point under the cursor fixed.
        const wx = (px - state.panX) / state.zoom
        const wy = (py - state.panY) / state.zoom
        state.setView(next, px - wx * next, py - wy * next)
        return
      }

      state.setPan(state.panX - e.deltaX, state.panY - e.deltaY)
    }

    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  const onViewportPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-element]")) return

    // Anywhere that is not an element clears the selection — the page ground,
    // the gap between the faces, and the open canvas around them all count.
    // Scoping this to the active page's ground (as it was) left a click on the
    // empty canvas doing nothing, which reads as the click being ignored.
    select(null)
    if (e.button !== 0 && e.button !== 1) return

    panRef.current = { x: e.clientX, y: e.clientY, ox: panX, oy: panY }
    setPanning(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onViewportPointerMove = (e: React.PointerEvent) => {
    if (resizeRef.current) {
      onResizeMove(e)
      return
    }
    const pan = panRef.current
    if (pan) {
      setPan(pan.ox + (e.clientX - pan.x), pan.oy + (e.clientY - pan.y))
      return
    }
    onPointerMove(e)
  }

  return (
    <div
      ref={viewportRef}
      className={cn(
        "absolute inset-0 overflow-hidden",
        panning ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        // The grid belongs to the work, so it scales and travels with it.
        backgroundImage: "radial-gradient(var(--editor-dot) 1px, transparent 1px)",
        backgroundSize: `${18 * zoom}px ${18 * zoom}px`,
        backgroundPosition: `${panX}px ${panY}px`,
      }}
      onPointerDown={onViewportPointerDown}
      onPointerMove={onViewportPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* `dir="ltr"`, deliberately, inside an app that may be RTL.

          Everything below this point is the **printed card**, not UI. Element
          positions are stored as `x`/`y` in the document and go to the
          server-side renderer verbatim, so the canvas has to keep one fixed
          coordinate frame: a design authored in Arabic and one authored in
          English must come out of the printer identically. Pinning the
          direction here is what guarantees an operator switching language
          never sees their artwork move. */}
      <div
        dir="ltr"
        className="absolute top-0 left-0 flex flex-col items-center"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {doc.pages.map((page, index) => (
          <React.Fragment key={page.id}>
            {index > 0 && <div style={{ height: PAGE_GAP }} aria-hidden />}
            <PageFace
              page={page}
              index={index}
              active={index === activePage}
              width={doc.width}
              height={doc.height}
              selectedId={selectedId}
              guides={index === activePage ? guides : { x: null, y: null }}
              altHeld={altHeld}
              hoverId={hoverId}
              onHover={setHoverId}
              onActivate={() => setActivePage(index)}
              onElementPointerDown={onPointerDown}
              onResizeStart={onResizeStart}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function PageFace({
  page,
  index,
  active,
  width,
  height,
  selectedId,
  guides,
  altHeld,
  hoverId,
  onHover,
  onActivate,
  onElementPointerDown,
  onResizeStart,
}: {
  page: EditorPage
  index: number
  active: boolean
  width: number
  height: number
  selectedId: string | null
  guides: { x: number | null; y: number | null }
  altHeld: boolean
  hoverId: string | null
  onHover: (id: string | null) => void
  onActivate: () => void
  onElementPointerDown: (e: React.PointerEvent, el: CanvasElement, page: number) => void
  onResizeStart: (e: React.PointerEvent, el: CanvasElement, handle: string) => void
}) {
  const t = useT()
  const selected = active ? page.elements.find((e) => e.id === selectedId) ?? null : null
  const hovered = altHeld && hoverId ? page.elements.find((e) => e.id === hoverId) ?? null : null

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "mb-2 flex h-[22px] items-center gap-2 text-[11px] font-semibold tracking-[0.06em] uppercase",
          "transition-colors duration-150",
          active ? "text-accent-violet" : "text-text-placeholder"
        )}
      >
        <span>{index === 0 ? t("printer.front") : t("printer.back")}</span>
        <span className="font-mono text-[10px] font-normal tracking-[0.02em] text-text-placeholder normal-case">
          {width} × {height}
        </span>
      </div>

      <div
        data-page-ground={active ? "" : undefined}
        onPointerDown={active ? undefined : onActivate}
        style={{
          width,
          height,
          background: page.background,
          // Preserved, never authored (§19.2): no panel writes a page image, but
          // a template imported from the legacy tool can carry one, and drawing
          // it is the difference between seeing that design and seeing a blank
          // face with elements floating on it.
          ...(page.backgroundImage && {
            backgroundImage: cssUrl(page.backgroundImage),
            backgroundSize: "cover",
            backgroundPosition: "center",
          }),
        }}
        className={cn(
          "relative overflow-hidden rounded-lg text-[#171717]",
          "shadow-[var(--editor-shadow-card)]",
          !active && "cursor-pointer saturate-50 opacity-55"
        )}
      >
        {page.elements.map((element) => (
          <ElementNode
            key={element.id}
            element={element}
            interactive={active}
            measured={hovered?.id === element.id}
            onPointerDown={(e) => onElementPointerDown(e, element, index)}
            onPointerEnter={() => active && onHover(element.id)}
            onPointerLeave={() => active && onHover(null)}
          />
        ))}

        {selected && <SelectionFrame element={selected} onResizeStart={onResizeStart} />}

        {guides.x !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute z-40 w-px"
            style={{ left: guides.x, top: -14, bottom: -14, background: GUIDE_COLOR }}
          />
        )}
        {guides.y !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute z-40 h-px"
            style={{ top: guides.y, left: -14, right: -14, background: GUIDE_COLOR }}
          />
        )}

        {altHeld && selected && (
          <Measurements
            selected={selected}
            target={hovered && hovered.id !== selected.id ? hovered : null}
            page={{ width, height }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * A `url()` whose argument cannot escape the quotes it is wrapped in.
 *
 * Not `CSS.escape`: that escapes an *identifier*, so it would mangle every
 * `:`, `/` and `,` in a data URI — and it does not exist on the server, where
 * this component still renders once.
 */
function cssUrl(src: string) {
  return `url("${src.replace(/[\\"]/g, "\\$&").replace(/\r?\n/g, "")}")`
}

function ElementNode({
  element,
  interactive,
  measured,
  ...handlers
}: {
  element: CanvasElement
  interactive: boolean
  measured: boolean
} & Pick<
  React.ComponentProps<"div">,
  "onPointerDown" | "onPointerEnter" | "onPointerLeave"
>) {
  const style: React.CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
    outline: measured ? `1px solid ${GUIDE_COLOR}` : undefined,
  }

  const common = {
    style,
    "data-element": element.id,
    className: cn(
      "absolute select-none",
      interactive ? (element.locked ? "cursor-default" : "cursor-move") : "pointer-events-none"
    ),
    ...(interactive ? handlers : {}),
  }

  if (element.kind === "text") {
    return (
      <div
        {...common}
        style={{
          ...style,
          fontFamily: `"${element.fontFamily ?? "Arial"}", Arial, sans-serif`,
          fontSize: element.fontSize,
          fontWeight: element.fontWeight === "bold" ? 700 : 400,
          fontStyle: element.fontStyle === "italic" ? "italic" : "normal",
          textDecoration: element.textDecoration || "none",
          letterSpacing: element.letterSpacing ? `${element.letterSpacing}em` : undefined,
          color: element.fill,
          display: "flex",
          alignItems: "center",
          whiteSpace: "pre",
          overflow: "hidden",
          justifyContent:
            element.align === "center"
              ? "center"
              : element.align === "right"
                ? "flex-end"
                : "flex-start",
        }}
      >
        {element.text}
      </div>
    )
  }

  if (element.kind === "shape") {
    return (
      <div
        {...common}
        style={{
          ...style,
          background: element.fill,
          borderRadius:
            element.shape === "circle" || element.shape === "ellipse"
              ? "50%"
              : element.cornerRadius,
          boxShadow:
            element.stroke && element.strokeWidth
              ? `inset 0 0 0 ${element.strokeWidth}px ${element.stroke}`
              : undefined,
        }}
      />
    )
  }

  if (element.isQR) return <QrNode element={element} common={common} />

  // A picture the operator added — §9.2. It is not a slot and must not wear a
  // slot's chrome: the grey box and dashed ring say "a photo goes here at issue
  // time", which is the opposite of what this element is.
  if (!element.variable) return <PictureNode element={element} style={style} common={common} />

  // A variable-bound image slot with no upload yet — §10.5's placeholder. The
  // two kinds are told apart by the *definition's* type, not by the variable's
  // name: a signature variable called `sig` is still a signature, and the
  // amber box is what the serializer writes into the document for it
  // (features/templates/editor-io.ts), so the canvas has to agree.
  return <SlotNode element={element} style={style} common={common} />
}

/**
 * An uploaded picture.
 *
 * `objectFit: "fill"` rather than `cover`, to agree with the document: §5.2's
 * `stretch_enabled` is written `true` on every image the editor emits, which
 * tells the server-side renderer to stretch the source into the element box.
 * Showing a cropped `cover` preview of a picture that is going to print
 * stretched is the canvas lying about the output.
 *
 * The element is inserted at the image's own aspect ratio, so the two agree
 * until the operator resizes it — at which point the distortion on screen is
 * exactly the distortion that will print, which is the point.
 */
function PictureNode({
  element,
  style,
  common,
}: {
  element: CanvasElement
  style: React.CSSProperties
  common: React.ComponentProps<"div">
}) {
  return (
    <div
      {...common}
      style={{ ...style, borderRadius: element.cornerRadius, overflow: "hidden" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={element.src}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "fill" }}
      />
    </div>
  )
}

function SlotNode({
  element,
  style,
  common,
}: {
  element: CanvasElement
  style: React.CSSProperties
  common: React.ComponentProps<"div">
}) {
  const signature = useEditorStore(
    (s) => s.variables.find((v) => v.name === element.variable)?.type === "signature"
  )

  return (
    <div
      {...common}
      style={{
        ...style,
        borderRadius: element.cornerRadius,
        background: signature ? "#FEF3C7" : "#F3F4F6",
        boxShadow: `inset 0 0 0 2px ${signature ? "#F59E0B" : "#D1D5DB"}`,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      {element.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={element.src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: Math.max(5, Math.min(11, element.width / 10)),
            color: signature ? "#92400E" : "#6B7280",
            padding: "0 4px",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {`{${element.variable ?? "image"}}`}
        </span>
      )}
    </div>
  )
}

/**
 * §9.4 — the QR encodes the literal string `"no-data"` at authoring time. The
 * renderer substitutes the identity's real key when it draws the final card, so
 * what is on screen here is a true-to-size stand-in, not the payload.
 *
 * ### The quiet zone is part of the code
 *
 * `qrMargin` is in **modules**, so the white border scales with the slot and a
 * resize never eats into it. A scanner needs that border to find the code's
 * edges; dropping it to nothing is the most common way a printed QR stops
 * reading. `qrTransparent` removes it deliberately, for artwork that already
 * supplies the light ground — see the warning the QR panel carries.
 */
function QrNode({
  element,
  common,
}: {
  element: CanvasElement
  common: React.ComponentProps<"div">
}) {
  const ref = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, element.qrValue || "no-data", {
      width: Math.max(21, Math.round(element.width)),
      margin: element.qrMargin ?? DEFAULT_QR_MARGIN,
      color: {
        dark: element.qrColor || "#000000",
        // 8-digit hex: the encoder writes the light modules at alpha 0, so the
        // artwork shows through rather than being covered by a white square.
        light: element.qrTransparent ? "#00000000" : "#FFFFFF",
      },
    }).catch(() => {
      // A placeholder QR that fails to draw is not worth interrupting the
      // operator over — the slot still shows its box.
    })
  }, [
    element.qrValue,
    element.qrColor,
    element.width,
    element.qrMargin,
    element.qrTransparent,
  ])

  return (
    <div {...common}>
      <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  )
}

/** §11.5's minimum. A box smaller than this is rejected, not shrunk further. */
const MIN_SIZE = 5

/**
 * Resize one edge or corner — §11.5.
 *
 * Each axis is solved from the **opposite edge**, which is what keeps that edge
 * pinned: dragging the west handle moves `x` and `width` together so the east
 * edge does not creep. Clamping to the page happens in the same step rather
 * than afterwards, so the box can never leave the card and then be corrected
 * back with a visible jump.
 *
 * Hold Shift on a corner to keep the aspect ratio.
 */
function resizeBox(
  box: { x: number; y: number; width: number; height: number },
  handle: string,
  dx: number,
  dy: number,
  page: { width: number; height: number },
  preserveRatio: boolean
) {
  let { x, y, width, height } = box
  const right = box.x + box.width
  const bottom = box.y + box.height

  if (handle.includes("w")) {
    x = Math.max(0, Math.min(box.x + dx, right - MIN_SIZE))
    width = right - x
  } else if (handle.includes("e")) {
    width = Math.max(MIN_SIZE, Math.min(box.width + dx, page.width - box.x))
  }

  if (handle.includes("n")) {
    y = Math.max(0, Math.min(box.y + dy, bottom - MIN_SIZE))
    height = bottom - y
  } else if (handle.includes("s")) {
    height = Math.max(MIN_SIZE, Math.min(box.height + dy, page.height - box.y))
  }

  // Corners only — a ratio lock on an edge handle would move an axis the
  // operator did not grab.
  const corner = handle.length === 2
  if (preserveRatio && corner && box.width > 0 && box.height > 0) {
    const ratio = box.width / box.height
    // Follow whichever axis moved further, so the drag tracks the pointer.
    if (Math.abs(width - box.width) >= Math.abs(height - box.height)) {
      height = width / ratio
    } else {
      width = height * ratio
    }
    if (handle.includes("w")) x = right - width
    if (handle.includes("n")) y = bottom - height
    // Re-clamp: the ratio pass can push the box back off the card.
    width = Math.max(MIN_SIZE, Math.min(width, page.width - x))
    height = Math.max(MIN_SIZE, Math.min(height, page.height - y))
  }

  // Whole pixels while dragging; the property fields still accept decimals.
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  }
}

function SelectionFrame({
  element,
  onResizeStart,
}: {
  element: CanvasElement
  onResizeStart: (e: React.PointerEvent, el: CanvasElement, handle: string) => void
}) {
  const handles: [string, number, number][] = [
    ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5],
    ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5],
  ]
  const cursor: Record<string, string> = {
    nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
    n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-40 outline-[1.5px] outline-accent-violet"
      style={{ left: element.x, top: element.y, width: element.width, height: element.height }}
    >
      {/* The live readout rides the selection — the number belongs where the
          eye already is, not across the screen in the property bar. */}
      <span className="absolute -top-[21px] -left-[1.5px] inline-flex h-[17px] items-center rounded-[5px] bg-accent-violet px-1.5 font-mono text-[10px] tabular-nums whitespace-nowrap text-white">
        {Math.round(element.x)} · {Math.round(element.y)}
      </span>
      {!element.locked &&
        handles.map(([key, fx, fy]) => (
          <span
            key={key}
            onPointerDown={(e) => onResizeStart(e, element, key)}
            style={{
              left: `calc(${fx * 100}% - 5px)`,
              top: `calc(${fy * 100}% - 5px)`,
              cursor: cursor[key],
            }}
            className={cn(
              // `pointer-events-auto` re-enables hit-testing the frame turned
              // off, and the padded hit area makes a 10px handle grabbable
              // without drawing a bigger dot.
              "pointer-events-auto absolute size-2.5 rounded-[2px]",
              "border-[1.5px] border-accent-violet bg-white",
              "after:absolute after:-inset-1.5 after:content-['']"
            )}
          />
        ))}
    </div>
  )
}

/**
 * §11.3 — the Figma-style distance readout.
 *
 * Two modes: selected → hovered element when the pointer is over a different
 * one, otherwise selected → the four page edges. Every distance under half a
 * unit is dropped, because a label reading "0" is noise.
 */
function Measurements({
  selected,
  target,
  page,
}: {
  selected: CanvasElement
  target: CanvasElement | null
  page: { width: number; height: number }
}) {
  const lines: { horizontal: boolean; pos: number; start: number; length: number }[] = []

  if (target) {
    const vOverlap =
      Math.max(selected.y, target.y) < Math.min(selected.y + selected.height, target.y + target.height)
    const anchorY = vOverlap
      ? (Math.max(selected.y, target.y) + Math.min(selected.y + selected.height, target.y + target.height)) / 2
      : selected.y + selected.height / 2

    if (target.x + target.width <= selected.x) {
      lines.push({ horizontal: true, pos: anchorY, start: target.x + target.width, length: selected.x - (target.x + target.width) })
    } else if (target.x >= selected.x + selected.width) {
      lines.push({ horizontal: true, pos: anchorY, start: selected.x + selected.width, length: target.x - (selected.x + selected.width) })
    }

    const hOverlap =
      Math.max(selected.x, target.x) < Math.min(selected.x + selected.width, target.x + target.width)
    const anchorX = hOverlap
      ? (Math.max(selected.x, target.x) + Math.min(selected.x + selected.width, target.x + target.width)) / 2
      : selected.x + selected.width / 2

    if (target.y + target.height <= selected.y) {
      lines.push({ horizontal: false, pos: anchorX, start: target.y + target.height, length: selected.y - (target.y + target.height) })
    } else if (target.y >= selected.y + selected.height) {
      lines.push({ horizontal: false, pos: anchorX, start: selected.y + selected.height, length: target.y - (selected.y + selected.height) })
    }
  } else {
    const midY = selected.y + selected.height / 2
    const midX = selected.x + selected.width / 2
    lines.push({ horizontal: true, pos: midY, start: 0, length: selected.x })
    lines.push({ horizontal: true, pos: midY, start: selected.x + selected.width, length: page.width - (selected.x + selected.width) })
    lines.push({ horizontal: false, pos: midX, start: 0, length: selected.y })
    lines.push({ horizontal: false, pos: midX, start: selected.y + selected.height, length: page.height - (selected.y + selected.height) })
  }

  return (
    <>
      {lines
        .filter((l) => l.length > 0.5)
        .map((line, i) => (
          <React.Fragment key={i}>
            <span
              aria-hidden
              className="pointer-events-none absolute z-[46]"
              style={
                line.horizontal
                  ? { top: line.pos, left: line.start, width: line.length, height: 1, background: GUIDE_COLOR }
                  : { left: line.pos, top: line.start, height: line.length, width: 1, background: GUIDE_COLOR }
              }
            />
            <span
              aria-hidden
              className="pointer-events-none absolute z-[47] -translate-x-1/2 -translate-y-1/2 rounded-[2px] px-1 py-px font-mono text-[9px] leading-none whitespace-nowrap text-white"
              style={{
                background: GUIDE_COLOR,
                left: line.horizontal ? line.start + line.length / 2 : line.pos,
                top: line.horizontal ? line.pos : line.start + line.length / 2,
              }}
            >
              {Math.round(line.length)}
            </span>
          </React.Fragment>
        ))}
    </>
  )
}

/** Exported for the variables panel, which labels a row by its element kind. */
export function elementKindForVariable(type: string) {
  return variableMeta(type as never).element
}
