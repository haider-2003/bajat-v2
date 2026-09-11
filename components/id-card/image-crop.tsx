"use client"

import * as React from "react"
import { Crop, ImagePlus, Loader2, Minus, Plus, RefreshCw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/i18n/context"

import { SlotTile, wellSize } from "./slot-tile"
import { useObjectUrl } from "./use-object-url"

/**
 * The photo slot on an issue form — docs/ISSUE-ID-FORM.md §5.2 (`image`).
 *
 * ### The crop is not a nicety
 *
 * The slot on the card has a fixed aspect ratio and, often, a fixed corner
 * radius. The server draws whatever file it is given into that box with
 * `stretch_enabled` (photo-editor-spec §19.5), which means an uncropped 4:3
 * portrait squashed into a 3:4 slot is what gets printed. So the file this
 * control produces is *already* the right shape: the operator frames the face
 * once here, and the card cannot be wrong later.
 *
 * ### It exports source pixels, not slot pixels
 *
 * The canvas is sized to the selected rectangle **in the original image's own
 * pixels**, not to the card slot's 90×110 design units. Downscaling here would
 * throw away resolution the printer wants — a card is printed at ~300dpi from a
 * 323px-wide design, so the design units are nowhere near the output size.
 *
 * ### The rounding is preview-only
 *
 * The exported file is always rectangular. Corners are rounded by the renderer
 * from the element's own `cornerRadius`, so baking them in would double the
 * effect and hard-code a radius the design is still free to change. The mask
 * here is drawn at the same *fraction* of the shorter side, so the operator
 * frames against the shape that will actually be printed.
 */

/* ------------------------------------------------------------------ *
 * The field
 * ------------------------------------------------------------------ */

export function ImageCropField({
  value,
  onChange,
  /** The card slot's shape, width ÷ height. */
  aspectRatio,
  /** Corner radius as a fraction of the slot's shorter side, 0–0.5. */
  cornerRadiusRatio = 0,
  label,
  disabled = false,
  id,
  describedBy,
  invalid = false,
}: {
  value: File | null
  onChange: (file: File | null) => void
  aspectRatio: number
  cornerRadiusRatio?: number
  /** The variable's label, for the dialog title and the accessible name. */
  label: string
  disabled?: boolean
  id?: string
  describedBy?: string
  invalid?: boolean
}) {
  const t = useT()
  const inputRef = React.useRef<HTMLInputElement>(null)
  /** The image being framed: a data URL, plus what to call the result. */
  const [source, setSource] = React.useState<CropSource | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const preview = useObjectUrl(value)

  const pick = (file: File | undefined) => {
    if (!file) return
    // A drop can hand over anything; the file input already filtered.
    if (!file.type.startsWith("image/")) {
      setError(t("issue.form.imageUnreadable"))
      return
    }
    setError(null)

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      setSource({ url: reader.result, name: file.name, type: file.type })
    }
    reader.onerror = () => setError(t("issue.form.imageUnreadable"))
    reader.readAsDataURL(file)

    // Cleared so picking the *same* file again still fires a change event —
    // which is what happens after a crop is discarded and retried.
    if (inputRef.current) inputRef.current.value = ""
  }

  /**
   * Re-framing works on the cropped file, not the original.
   *
   * The original is not kept: it would mean holding a full-resolution image
   * per photo slot for the life of the form, and a second crop of a crop is
   * what the operator is asking for anyway — they are nudging the frame they
   * can see, not starting over. Starting over is what "choose a different
   * photo" is for.
   */
  const recrop = () => {
    if (!value) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      setSource({ url: reader.result, name: value.name, type: value.type })
    }
    reader.readAsDataURL(value)
  }

  const well = wellSize(aspectRatio)

  return (
    <>
      <SlotTile
        id={id}
        describedBy={describedBy}
        invalid={invalid}
        disabled={disabled}
        preview={preview}
        fit="cover"
        aspectRatio={aspectRatio}
        radius={slotRadius(Math.min(well.w, well.h), cornerRadiusRatio)}
        icon={ImagePlus}
        title={value ? value.name : t("issue.form.imageChoose")}
        hint={error ?? (value ? t("issue.form.imageHelper") : t("issue.form.imageDrop"))}
        hintTone={error ? "danger" : "muted"}
        onPick={() => inputRef.current?.click()}
        onDropFile={pick}
        actions={
          value && (
            <>
              <Button
                id={id}
                type="button"
                variant="ghost"
                className="h-9 md:h-8"
                disabled={disabled}
                onClick={recrop}
              >
                <Crop data-icon="inline-start" strokeWidth={1.75} />
                {t("issue.form.imageRecrop")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 md:h-8"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <RefreshCw data-icon="inline-start" strokeWidth={1.75} />
                {t("issue.form.imageReplace")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-text-muted hover:text-danger md:size-8"
                disabled={disabled}
                onClick={() => onChange(null)}
                aria-label={t("issue.form.imageRemoveLabel", { field: label })}
              >
                <X strokeWidth={1.75} />
              </Button>
            </>
          )
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => pick(event.target.files?.[0])}
      />

      <CropDialog
        source={source}
        label={label}
        aspectRatio={aspectRatio}
        cornerRadiusRatio={cornerRadiusRatio}
        onCancel={() => setSource(null)}
        onApply={(file) => {
          setSource(null)
          onChange(file)
        }}
      />
    </>
  )
}

/** The well's radius in px: the slot's fraction of its shorter side. */
function slotRadius(shorter: number, ratio: number): number {
  return ratio > 0 ? shorter * ratio : 8
}

/* ------------------------------------------------------------------ *
 * The crop dialog
 * ------------------------------------------------------------------ */

type CropSource = { url: string; name: string; type: string }

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

function CropDialog({
  source,
  label,
  aspectRatio,
  cornerRadiusRatio,
  onCancel,
  onApply,
}: {
  source: CropSource | null
  label: string
  aspectRatio: number
  cornerRadiusRatio: number
  onCancel: () => void
  onApply: (file: File) => void
}) {
  return (
    <Dialog open={source !== null} onOpenChange={(open) => !open && onCancel()}>
      {/* Mounted per opening: zoom and pan start where a new photo expects
          them, not where the last one was left. */}
      {source && (
        <CropBody
          source={source}
          label={label}
          aspectRatio={aspectRatio}
          cornerRadiusRatio={cornerRadiusRatio}
          onApply={onApply}
        />
      )}
    </Dialog>
  )
}

function CropBody({
  source,
  label,
  aspectRatio,
  cornerRadiusRatio,
  onApply,
}: {
  source: CropSource
  label: string
  aspectRatio: number
  cornerRadiusRatio: number
  onApply: (file: File) => void
}) {
  const t = useT()

  /**
   * The frame element, held in state rather than a ref.
   *
   * `DialogContent` portals through floating-ui, which renders nothing on
   * its first pass and mounts its children a commit later — so a layout
   * effect that reads a ref on *this* component's mount finds `null`, and a
   * frame that is never measured draws the photo at 0×0. A callback ref
   * fires when the element actually attaches, whichever commit that is.
   */
  const [frameEl, setFrameEl] = React.useState<HTMLDivElement | null>(null)

  /** The image's intrinsic size, once it has loaded. */
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null)
  /** The frame's rendered size, measured — it is responsive. */
  const [frame, setFrame] = React.useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = React.useState(1)
  /** Top-left of the drawn image, relative to the frame, in CSS px. */
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  React.useLayoutEffect(() => {
    if (!frameEl) return
    // Layout size, not the client rect: the dialog arrives scaled 0.98 → 1
    // (§13.2), and a rect read mid-entry would size every crop 2% small.
    const measure = () =>
      setFrame({ w: frameEl.offsetWidth, h: frameEl.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frameEl)
    return () => observer.disconnect()
  }, [frameEl])

  /**
   * The scale at which the image just covers the frame, times the zoom.
   *
   * Cover rather than contain: a crop frame with letterbox bars in it is a
   * frame the operator can position the subject *outside* of, and the exported
   * rectangle would carry transparent edges into the card.
   */
  const cover = natural && frame ? Math.max(frame.w / natural.w, frame.h / natural.h) : 0
  const scale = cover * zoom

  // Memoized because the clamp below closes over it: a fresh object per render
  // would rebuild the callback on every pointer move.
  const drawn = React.useMemo(
    () => (natural ? { w: natural.w * scale, h: natural.h * scale } : null),
    [natural, scale]
  )

  /** Pan is clamped so the frame is never uncovered. */
  const clamp = React.useCallback(
    (next: { x: number; y: number }) => {
      if (!frame || !drawn) return next
      return {
        x: Math.min(0, Math.max(frame.w - drawn.w, next.x)),
        y: Math.min(0, Math.max(frame.h - drawn.h, next.y)),
      }
    },
    [frame, drawn]
  )

  /**
   * Centre the photo once, when both it and the frame are known.
   *
   * Neither arrival is ordered before the other — the frame is measured when
   * the portal mounts it, the image when the data URL decodes — so the
   * centring waits for whichever comes second. Once only: after that the
   * offset is the operator's, and a frame resize clamps it rather than
   * resetting it.
   */
  const centred = React.useRef(false)
  React.useLayoutEffect(() => {
    if (centred.current || !natural || !frame || frame.w === 0) return
    centred.current = true
    const s = Math.max(frame.w / natural.w, frame.h / natural.h) * zoom
    setOffset({ x: (frame.w - natural.w * s) / 2, y: (frame.h - natural.h * s) / 2 })
  }, [natural, frame, zoom])

  const changeZoom = (nextZoom: number) => {
    const bounded = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(nextZoom.toFixed(2))))
    setZoom(bounded)
    if (!natural || !frame) return
    // Zoom about the frame's centre, so the subject stays put rather than
    // drifting toward the top-left corner.
    const before = Math.max(frame.w / natural.w, frame.h / natural.h) * zoom
    const after = Math.max(frame.w / natural.w, frame.h / natural.h) * bounded
    const ratio = after / before
    setOffset((current) =>
      clampWith(frame, { w: natural.w * after, h: natural.h * after }, {
        x: frame.w / 2 - (frame.w / 2 - current.x) * ratio,
        y: frame.h / 2 - (frame.h / 2 - current.y) * ratio,
      })
    )
  }

  /** Pointer drag. Capture keeps the pan alive outside the frame. */
  const onPointerDown = (event: React.PointerEvent) => {
    if (!drawn || !frame) return
    const start = { x: event.clientX, y: event.clientY }
    const from = offset
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    const move = (e: PointerEvent) => {
      setOffset(
        clamp({ x: from.x + (e.clientX - start.x), y: from.y + (e.clientY - start.y) })
      )
    }
    const up = () => {
      target.releasePointerCapture(event.pointerId)
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", up)
      target.removeEventListener("pointercancel", up)
    }
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", up)
    target.addEventListener("pointercancel", up)
  }

  const apply = async () => {
    if (!natural || !frame || !drawn) return
    setBusy(true)
    try {
      const file = await cropToFile({
        url: source.url,
        name: source.name,
        type: source.type,
        // The selected rectangle, converted back into source pixels.
        sx: -offset.x / scale,
        sy: -offset.y / scale,
        sw: frame.w / scale,
        sh: frame.h / scale,
      })
      onApply(file)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const maskRadius = frame
    ? (cornerRadiusRatio > 0 ? Math.min(frame.w, frame.h) * cornerRadiusRatio : 0)
    : 0

  return (
    <DialogContent size="lg">
      <DialogCloseButton disabled={busy} />

      <DialogHeader>
        <DialogTitle>{t("issue.crop.title", { field: label })}</DialogTitle>
        <DialogDescription>{t("issue.crop.description")}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        {/* Sized by width *and* height: a portrait slot at the full 420px
            is taller than the room a laptop leaves under the header, and a
            frame that scrolls is a frame the zoom controls fall off. So the
            width is whichever is tightest — the column, 420px, or the width
            that keeps the height inside 46vh at the slot's ratio. */}
        <div
          ref={setFrameEl}
          onPointerDown={onPointerDown}
          className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-lg bg-surface-sunken select-none active:cursor-grabbing"
          style={{
            width: `min(100%, 420px, calc(46vh * ${aspectRatio}))`,
            aspectRatio: `${aspectRatio}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source.url}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget
              setNatural({ w: img.naturalWidth, h: img.naturalHeight })
            }}
            style={
              drawn
                ? {
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: drawn.w,
                    height: drawn.h,
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                    maxWidth: "none",
                  }
                : { position: "absolute", opacity: 0 }
            }
          />

          {/* The shape the card will print, drawn over the photo rather than
              cut out of it: what falls outside is dimmed, not hidden, so the
              operator can see what they are excluding. */}
          {maskRadius > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)_inset]"
              style={{ borderRadius: maskRadius }}
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 ring-1 ring-white/40 ring-inset"
            style={{ borderRadius: maskRadius }}
          />
        </div>

        {/* Zoom. A slider plus two steppers, because a slider alone is hard to
            land precisely on a phone. */}
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("issue.crop.zoomOut")}
            disabled={zoom <= ZOOM_MIN}
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
          >
            <Minus strokeWidth={1.75} />
          </Button>

          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            aria-label={t("issue.crop.zoom")}
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent-violet outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("issue.crop.zoomIn")}
            disabled={zoom >= ZOOM_MAX}
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
          >
            <Plus strokeWidth={1.75} />
          </Button>
        </div>

        {failed && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {t("issue.crop.failed")}
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogClose
          render={
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full md:h-9 md:w-auto"
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
          }
        />
        <Button
          type="button"
          className="h-11 w-full md:h-9 md:w-auto"
          disabled={busy || !natural}
          onClick={apply}
        >
          {busy && (
            <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
          )}
          {t("issue.crop.apply")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** `clamp` as a free function, for the zoom handler's pre-state offset. */
function clampWith(
  frame: { w: number; h: number },
  drawn: { w: number; h: number },
  next: { x: number; y: number }
) {
  return {
    x: Math.min(0, Math.max(frame.w - drawn.w, next.x)),
    y: Math.min(0, Math.max(frame.h - drawn.h, next.y)),
  }
}

/**
 * The selected rectangle, drawn to a canvas at its own source resolution and
 * exported with the upload's original filename and MIME type.
 *
 * The type is preserved so a PNG with transparency stays a PNG; a type the
 * canvas cannot encode falls back to JPEG, which every browser can write.
 */
async function cropToFile({
  url,
  name,
  type,
  sx,
  sy,
  sw,
  sh,
}: {
  url: string
  name: string
  type: string
  sx: number
  sy: number
  sw: number
  sh: number
}): Promise<File> {
  const image = await loadImage(url)

  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(sw))
  canvas.height = Math.max(1, Math.round(sh))

  const context = canvas.getContext("2d")
  if (!context) throw new Error("2d context unavailable")
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  const mime = type === "image/png" || type === "image/webp" ? type : "image/jpeg"
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 0.92)
  )
  if (!blob) throw new Error("encode failed")

  return new File([blob], name || `photo.${mime === "image/png" ? "png" : "jpg"}`, {
    type: mime,
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("load failed"))
    image.src = src
  })
}
