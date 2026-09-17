"use client"

import * as React from "react"
import QRCode from "qrcode"

import type { DesignElement, DesignPage } from "@/features/templates/design"
import { displayImageSrc } from "@/utils/download-image"
import { cn } from "@/lib/utils"

import { useObjectUrl } from "./use-object-url"

/**
 * One face of a card design, drawn from the stored JSON with values filled in.
 *
 * ### Why this exists when the server already renders the card
 *
 * `front_image` on a template is the *blank*: the artwork with `{employee_no}`
 * still written across it. The filled card only exists after `POST /identity`,
 * which is far too late to notice that a name overruns its box or that the
 * photo slot is a circle. So the design is drawn client-side while the form is
 * being filled, from the same `pages[].children[]` the server renders from.
 *
 * It is a **preview, not a proof**. The server draws with its own font stack
 * and its own text metrics; this draws with the browser's. Two things follow:
 * the operator can trust the layout, the values and the crop, and nobody
 * should be measuring kerning off it.
 *
 * ### Everything is scaled from one transform
 *
 * Elements carry unscaled design coordinates (323×204 for a CR-80). The page
 * box is rendered at its authored size and a single `scale()` fits it to
 * whatever width the caller has — so every child keeps sub-pixel positions
 * that agree with the stored geometry, and no per-element arithmetic can drift.
 * Font sizes come along with it, which is the whole point: text at 8px in the
 * design has to *look* like text at 8px on a card.
 */

/** What each variable currently prints. */
export type CardValues = Record<string, CardValue>

export type CardValue = {
  /** The text to draw, already formatted. `""` draws nothing. */
  text?: string
  /**
   * For an image slot: the picked file itself, not a URL.
   *
   * The slot mints its own object URL (`useObjectUrl`) rather than being
   * handed one, so nothing upstream has to own a cache of them — see the note
   * on that hook.
   */
  file?: File | null
  /**
   * Drawn at half opacity, for a value the operator did not supply — a
   * server-generated stand-in, or an untouched field showing its own name.
   */
  pending?: boolean
}

export function CardFaceRender({
  page,
  values,
  /** Rendered width in CSS px. The height follows the page's aspect ratio. */
  width,
  className,
}: {
  page: DesignPage
  values: CardValues
  width: number
  className?: string
}) {
  const scale = width / page.width

  return (
    // `dir="ltr"`, deliberately, inside an app that may be RTL — the same pin
    // the editor's stage carries (components/photo-editor/stage.tsx). This is
    // the printed card, not UI: element positions are physical, and a text
    // box's alignment and overflow must resolve the same way whichever
    // language the operator is working in. Left to inherit `rtl`, a
    // right-aligned box lands on the left (`flex-end` flips) and a line that
    // overruns its box clips its *start* — so the same design drew one way
    // in the gallery and another in the issue form.
    <div
      dir="ltr"
      className={cn(
        "relative overflow-hidden rounded-lg bg-white text-[#171717]",
        className
      )}
      style={{ width, height: page.height * scale }}
      aria-hidden
    >
      {/* Pinned to the physical top-left rather than left in flow.
     
          A block child is aligned to the *inline start*, which under `dir=rtl`
          is the right edge — so the unscaled 323px page box sat flush right
          inside its wider frame, and `transform-origin: top left` then scaled
          it away from there: a white gutter down one side and the artwork
          running off the other. The card's geometry is physical (elements
          carry `x` / `y` in design units), so its box has to be too. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: page.width,
          height: page.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: page.background,
        }}
      >
        {page.backgroundImage && (
          // A pre-signed or data URL on a host the image optimizer is not
          // configured for.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageSrc(page.backgroundImage)}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}

        {page.elements.map((element) => (
          <ElementRender
            key={element.id}
            element={element}
            value={element.variable ? values[element.variable] : undefined}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Elements
 * ------------------------------------------------------------------ */

function ElementRender({
  element,
  value,
}: {
  element: DesignElement
  value: CardValue | undefined
}) {
  const box: React.CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
  }

  if (element.isQR) return <QrRender element={element} box={box} />

  if (element.kind === "shape") {
    return (
      <div
        style={{
          ...box,
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

  if (element.kind === "text") return <TextRender element={element} value={value} />

  return <ImageRender element={element} value={value} />
}

/**
 * A text element.
 *
 * A bound element's own `text` is the authoring cue — `{employee_no}` — and is
 * replaced wholesale by the value (§19.4). An *unbound* one can still hold
 * `{name}` inside a sentence, which the server substitutes from the flat body,
 * so braces are replaced in place there rather than the whole string being
 * swapped.
 *
 * `whiteSpace: "pre"` and `overflow: hidden` match the editor's own stage: the
 * card is a fixed box and an overrunning value is clipped on the printed card
 * too. Seeing that clip is the reason to look at a preview.
 */
function TextRender({
  element,
  value,
}: {
  element: DesignElement
  value: CardValue | undefined
}) {
  const raw = element.text ?? ""
  const text = element.variable ? (value?.text ?? "") : raw
  const pending = element.variable ? (value?.pending ?? !value?.text) : false

  return (
    <div
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        opacity: element.opacity * (pending ? 0.35 : 1),
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: "top left",
        fontFamily: `"${element.fontFamily ?? "Arial"}", Arial, sans-serif`,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight === "bold" ? 700 : 400,
        fontStyle: element.fontStyle === "italic" ? "italic" : "normal",
        textDecoration: element.textDecoration || "none",
        lineHeight: element.lineHeight ?? 1.2,
        // `em`, as the editor draws it — the two must agree on every unit.
        letterSpacing: element.letterSpacing
          ? `${element.letterSpacing}em`
          : undefined,
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
      {element.variable ? (pending && !text ? placeholderFor(element) : text) : raw}
    </div>
  )
}

/** `{employee_no}` — what an unfilled slot shows, as the card would print it. */
function placeholderFor(element: DesignElement): string {
  const authored = element.text?.trim()
  if (authored) return authored
  return `{${element.variable}}`
}

/**
 * An image element: the design's own artwork, or an uploaded photo in a
 * variable slot.
 *
 * `object-fit: cover` for a supplied photo, matching `stretch_enabled` on the
 * renderer's side (§19.5) — the crop tool has already cut the file to the
 * slot's aspect ratio, so cover and fill agree and cover survives a file that
 * arrived some other way.
 */
function ImageRender({
  element,
  value,
}: {
  element: DesignElement
  value: CardValue | undefined
}) {
  // One URL per slot, for as long as that slot holds that file.
  const uploaded = useObjectUrl(value?.file)
  const src = element.variable ? uploaded : element.src
  const radius = element.cornerRadius ?? 0

  const box: React.CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
    borderRadius: radius,
    overflow: "hidden",
  }

  if (src) {
    return (
      <div style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayImageSrc(src)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    )
  }

  // An empty slot. Drawn as the editor draws it — a dashed well with the
  // variable's name — so an operator who has not uploaded the photo yet can
  // see *where* it goes rather than a blank rectangle.
  return (
    <div
      style={{
        ...box,
        background: "rgba(0,0,0,0.04)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.14)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: Math.max(5, Math.min(10, element.width / 10)),
          color: "rgba(0,0,0,0.45)",
          padding: "0 4px",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {`{${element.variable ?? "image"}}`}
      </span>
    </div>
  )
}

/**
 * The QR slot.
 *
 * It encodes `no-data` here, as it does in the editor: the real payload is the
 * identity's `unique_key`, which the server mints when the card is created and
 * which therefore cannot exist while the form is still open. What the preview
 * is for is the *placement* — that the code is inside the trim, big enough,
 * and on a light enough patch of artwork to scan.
 */
function QrRender({
  element,
  box,
}: {
  element: DesignElement
  box: React.CSSProperties
}) {
  const ref = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, element.qrValue || "no-data", {
      width: Math.max(21, Math.round(element.width)),
      // The quiet zone the design was authored with, not a guess: it is stored
      // on the element now (features/templates/design.ts), and a preview that
      // draws a different border from the editor is a preview of a different
      // card. Older documents carry none and keep the 2 they always had.
      margin: element.qrMargin ?? 2,
      color: {
        dark: element.qrColor || "#000000",
        light: element.qrTransparent ? "#00000000" : "#FFFFFF",
      },
    }).catch(() => {
      // A stand-in code that fails to draw is not worth interrupting the form
      // over; the slot keeps its box.
    })
  }, [
    element.qrValue,
    element.qrColor,
    element.qrMargin,
    element.qrTransparent,
    element.width,
  ])

  return (
    <div style={box}>
      <canvas ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  )
}
