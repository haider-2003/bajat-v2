"use client"

import * as React from "react"
import { ImageOff } from "lucide-react"

import { displayImageSrc } from "@/utils/download-image"
import { cn } from "@/lib/utils"

/** Width ÷ height of a CR-80 — the stand-in until the artwork says otherwise. */
export const CR80 = 85.6 / 54

/**
 * One face of a card design, drawn at the artwork's own proportions.
 *
 * ### The slot is CR-80; the card is whatever the designer made
 *
 * Most designs are landscape 85.6 x 54 mm, but portrait ones exist, and a
 * portrait design stretched or letterboxed into a landscape frame is a picture
 * of a card that does not exist — the whole reason this screen leads with
 * artwork is so a wrong design is caught *before* the stock is spent.
 *
 * So there are two boxes. The outer one is a fixed CR-80 *slot* that reserves
 * the same space on every tile, which is what keeps a grid of mixed
 * orientations from going ragged. The inner one is the card: it takes the
 * image's measured shape and fits inside the slot — full width when it is
 * wider than CR-80, full height when it is taller — and it is the box that
 * carries the border, the fill and the shadow. A portrait card is therefore a
 * narrow card standing in the middle of the slot, rather than a landscape
 * white slab with the design marooned in the middle of it.
 *
 * The shape is measured off the loaded image (`CardStage` does the same), so
 * until it has loaded the card is assumed CR-80 and the image is `contain`ed —
 * the two agree once the measurement lands, and a letterboxed frame is a
 * kinder thing to flash than a cropped one.
 *
 * ### The image links expire
 *
 * `front_image` / `back_image` are pre-signed S3 URLs carrying
 * `X-Amz-Expires=300` — five minutes from when the list was fetched, the same
 * as the printer queue's. A page left open comes back to broken images, so a
 * failure is a quiet empty frame here and an explicit refetch in the preview
 * dialog: thirty "Retry" buttons in a grid all firing the same one request is
 * noise, and the frame at least stays the right shape.
 *
 * The broken *URL* is tracked rather than a bare flag, so a refetch's fresh
 * link clears the state during render instead of needing an effect to reset it.
 */
export function TemplateFace({
  src,
  alt,
  className,
  cardClassName,
  imageClassName,
}: {
  src: string | null | undefined
  /** Empty string for decorative use — the caller usually labels the frame. */
  alt: string
  /** The slot: how much room the card is given. Sizing belongs here. */
  className?: string
  /** The card itself: border, fill, shadow — anything that traces its edges. */
  cardClassName?: string
  imageClassName?: string
}) {
  const [brokenSrc, setBrokenSrc] = React.useState<string | null>(null)
  const { ratio, measure } = useArtworkRatio(src)
  const missing = !src || brokenSrc === src

  return (
    <div
      className={cn(
        "flex aspect-[85.6/54] w-full items-center justify-center",
        className
      )}
    >
      <div
        style={{ aspectRatio: ratio }}
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-lg bg-surface-sunken",
          // One of the two always fits, because the slot is CR-80: a card wider
          // than that is bounded by the width, a taller one by the height.
          ratio >= CR80 ? "w-full" : "h-full",
          cardClassName
        )}
      >
        {missing ? (
          <ImageOff
            className="size-5 text-text-placeholder"
            strokeWidth={1.5}
            aria-hidden
          />
        ) : (
          // A pre-signed URL on a host the image optimizer is not configured
          // for, and one that expires in five minutes: caching it through
          // /_next/image would cache a 403.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={measure}
            src={displayImageSrc(src)}
            alt={alt}
            onLoad={(event) => measure(event.currentTarget)}
            onError={() => setBrokenSrc(src ?? null)}
            className={cn("size-full object-contain", imageClassName)}
          />
        )}
      </div>
    </div>
  )
}

/**
 * The artwork's width ÷ height, measured off the loaded image.
 *
 * The URL is stored with the number for the same reason `brokenSrc` is stored
 * rather than a flag: a face that swaps from front to back must not keep the
 * other side's shape for a frame, and comparing during render beats an effect
 * that resets it after one.
 *
 * `onLoad` alone misses an image the browser already has cached, whose load
 * event can fire before React attaches the handler — so the ref reads
 * `complete` images on attach and the handler catches the rest.
 */
export function useArtworkRatio(src: string | null | undefined) {
  const [measured, setMeasured] = React.useState<{
    src: string
    ratio: number
  } | null>(null)

  const measure = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !src || !img.complete) return
      const { naturalWidth, naturalHeight } = img
      if (!naturalWidth || !naturalHeight) return
      const ratio = naturalWidth / naturalHeight
      setMeasured((prev) =>
        prev?.src === src && prev.ratio === ratio ? prev : { src, ratio }
      )
    },
    [src]
  )

  return {
    ratio: src && measured?.src === src ? measured.ratio : CR80,
    measure,
  } as const
}
