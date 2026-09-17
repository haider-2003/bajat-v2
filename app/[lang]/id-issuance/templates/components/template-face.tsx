"use client"

import * as React from "react"
import { ImageOff } from "lucide-react"

import { displayImageSrc } from "@/utils/download-image"
import { cn } from "@/lib/utils"

/**
 * One face of a card design, at true CR-80 proportions.
 *
 * ### Why the aspect ratio is not negotiable
 *
 * 85.6 x 54 mm is what comes out of the printer. A thumbnail at any other
 * ratio is a picture of a card that does not exist, and the whole reason this
 * screen leads with artwork is so a wrong design is caught *before* the stock
 * is spent. So the frame is always `aspect-[85.6/54]` and the artwork is
 * `object-contain` inside it — letterboxed rather than cropped, because a crop
 * hides exactly the edge content (borders, bleed) somebody is checking for.
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
  imageClassName,
}: {
  src: string | null | undefined
  /** Empty string for decorative use — the caller usually labels the frame. */
  alt: string
  className?: string
  imageClassName?: string
}) {
  const [brokenSrc, setBrokenSrc] = React.useState<string | null>(null)
  const missing = !src || brokenSrc === src

  return (
    <div
      className={cn(
        "flex aspect-[85.6/54] w-full items-center justify-center overflow-hidden",
        "rounded-lg bg-surface-sunken",
        className
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
          src={displayImageSrc(src)}
          alt={alt}
          onError={() => setBrokenSrc(src ?? null)}
          className={cn("size-full object-contain", imageClassName)}
        />
      )}
    </div>
  )
}
