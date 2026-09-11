"use client"

import * as React from "react"
import { Check, Eraser, PenLine, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

import { SlotTile } from "./slot-tile"
import { useObjectUrl } from "./use-object-url"

/**
 * The signature slot on an issue form — docs/ISSUE-ID-FORM.md §5.2
 * (`signature`).
 *
 * A `signature` variable is an image slot like any other as far as the payload
 * is concerned: the field sends a `File`, and the renderer draws it into the
 * element's box. What is different is where the file comes from — nobody
 * uploads a photograph of a signature, they sign.
 *
 * ### Transparent, black, round-capped
 *
 * The PNG has no background. A signature is drawn *onto* the card's artwork,
 * and a white rectangle behind it would punch a hole through whatever band the
 * slot sits on. Round caps and joins are what make a slow hand look like ink
 * rather than like a polyline.
 *
 * ### The canvas is drawn at device resolution
 *
 * The backing store is sized to `clientWidth × dpr`, not to a fixed 300×150.
 * A signature captured at CSS pixels on a 3x phone is a 300px-wide image
 * stretched across a printed slot, and it shows. Pointer coordinates are
 * scaled by the same factor, so the stroke lands under the finger.
 */

/** Aspect ratio of the pad, when the slot does not supply one. */
const DEFAULT_RATIO = 2.5

/** The pad's height, px. Its width follows from the slot's ratio. */
const PAD_HEIGHT = 160

export function SignatureField({
  value,
  onChange,
  /** The slot's shape, width ÷ height — the pad matches it. */
  aspectRatio,
  label,
  disabled = false,
  id,
  describedBy,
  invalid = false,
}: {
  value: File | null
  onChange: (file: File | null) => void
  aspectRatio?: number
  label: string
  disabled?: boolean
  id?: string
  describedBy?: string
  invalid?: boolean
}) {
  const t = useT()
  const [drawing, setDrawing] = React.useState(false)
  const preview = useObjectUrl(value)

  if (drawing) {
    return (
      <SignaturePad
        aspectRatio={aspectRatio ?? DEFAULT_RATIO}
        label={label}
        onCancel={() => setDrawing(false)}
        onSave={(file) => {
          setDrawing(false)
          onChange(file)
        }}
      />
    )
  }

  return (
    <SlotTile
      id={id}
      describedBy={describedBy}
      invalid={invalid}
      disabled={disabled}
      preview={preview}
      fit="contain"
      aspectRatio={aspectRatio ?? DEFAULT_RATIO}
      // Ink is black and the PNG is transparent: the well is white whatever
      // the theme, or a dark-mode signature is invisible.
      wellClassName="bg-white"
      icon={PenLine}
      title={value ? t("issue.form.signatureCaptured") : t("issue.form.signatureDraw")}
      hint={value ? t("issue.form.signatureReplaceHint") : t("issue.form.signatureHelper")}
      onPick={() => setDrawing(true)}
      actions={
        value && (
          <>
            <Button
              id={id}
              type="button"
              variant="ghost"
              className="h-9 md:h-8"
              disabled={disabled}
              onClick={() => setDrawing(true)}
            >
              <PenLine data-icon="inline-start" strokeWidth={1.75} />
              {t("issue.form.signatureRedo")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-text-muted hover:text-danger md:size-8"
              disabled={disabled}
              onClick={() => onChange(null)}
              aria-label={t("issue.form.signatureRemoveLabel", { field: label })}
            >
              <X strokeWidth={1.75} />
            </Button>
          </>
        )
      }
    />
  )
}

/* ------------------------------------------------------------------ *
 * The pad
 * ------------------------------------------------------------------ */

function SignaturePad({
  aspectRatio,
  label,
  onCancel,
  onSave,
}: {
  aspectRatio: number
  label: string
  onCancel: () => void
  onSave: (file: File) => void
}) {
  const t = useT()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  /** Whether anything has been drawn — "save" on a blank pad is not a save. */
  const [marked, setMarked] = React.useState(false)

  /**
   * Size the backing store to the box, at device resolution.
   *
   * Re-run on resize, which clears the canvas — deliberately: a stroke drawn
   * at one width cannot be rescaled to another without going soft, and the pad
   * only resizes when the sheet does, which is not something that happens
   * mid-signature.
   */
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const fit = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(box.width * dpr))
      canvas.height = Math.max(1, Math.round(box.height * dpr))

      const context = canvas.getContext("2d")
      if (!context) return
      context.scale(dpr, dpr)
      context.lineWidth = 2
      context.lineCap = "round"
      context.lineJoin = "round"
      context.strokeStyle = "#000000"
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const context = canvas.getContext("2d")
    if (!context) return

    const box = canvas.getBoundingClientRect()
    const at = (e: { clientX: number; clientY: number }) => ({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
    })

    canvas.setPointerCapture(event.pointerId)
    const start = at(event)
    context.beginPath()
    context.moveTo(start.x, start.y)
    // A tap with no movement should still leave a dot — a signature can end
    // on one, and a `moveTo` alone paints nothing.
    context.lineTo(start.x + 0.01, start.y)
    context.stroke()
    setMarked(true)

    const move = (e: PointerEvent) => {
      const point = at(e)
      context.lineTo(point.x, point.y)
      context.stroke()
    }
    const up = () => {
      context.closePath()
      canvas.releasePointerCapture(event.pointerId)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", up)
    }
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerup", up)
    canvas.addEventListener("pointercancel", up)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    // In device pixels: the context is scaled, so clearing by CSS size would
    // leave the bottom-right of a retina canvas painted.
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.restore()
    setMarked(false)
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas || !marked) return
    canvas.toBlob((blob) => {
      if (!blob) return
      onSave(
        new File([blob], `signature_${Date.now()}.png`, { type: "image/png" })
      )
    }, "image/png")
  }

  return (
    // The tile's own frame, opened up: the pad takes the place of the tile
    // it was clicked from, so the form does not gain a second box.
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 dark:bg-surface-sunken">
      {/* Sized by height: the pad keeps the slot's shape, but at 160px tall —
          a strip to sign on, not a poster. A slot squarer than the usual
          2.5:1 would otherwise fill the column top to bottom. */}
      <div
        className="relative mx-auto max-w-full"
        style={{ width: `calc(${PAD_HEIGHT}px * ${aspectRatio})` }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={draw}
          aria-label={t("issue.form.signaturePadLabel", { field: label })}
          className={cn(
            "block w-full cursor-crosshair touch-none rounded-lg border border-border-strong",
            // A light ground while drawing, whatever the theme: ink is black,
            // and black on a dark surface is a signature nobody can see
            // themselves writing. The exported PNG is transparent regardless.
            "bg-white"
          )}
          style={{ aspectRatio: `${aspectRatio}` }}
        />
        {/* A line to sign on, and — until the first stroke — what to do.
            Fixed greys, not tokens: the ground under them is always white. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-[26%] border-t border-dashed border-[#d4d4d4]"
        />
        {!marked && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-[#a3a3a3]"
          >
            {t("issue.form.signHere")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-10 md:h-8"
          disabled={!marked}
          onClick={save}
        >
          <Check data-icon="inline-start" strokeWidth={1.75} />
          {t("issue.form.signatureSave")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 md:h-8"
          disabled={!marked}
          onClick={clear}
        >
          <Eraser data-icon="inline-start" strokeWidth={1.75} />
          {t("common.clear")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="ms-auto h-10 md:h-8"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  )
}
