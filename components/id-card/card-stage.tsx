"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { FlipHorizontal, ImageOff, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SoftBadge, type Tone } from "@/components/ui/data-bits"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The rendered card, lying on a stage — the one object every identity screen
 * shows (the printer's preview, the Requests detail, the ID Flow review).
 *
 * ### The card is one object, not two pictures
 *
 * The faces used to sit side by side in fixed CR80 *landscape* frames. Most of
 * the templates in use are portrait, so both frames spent their width on grey
 * and the artwork came out small between two bars — a preview you have to
 * squint at is not doing the job it exists for.
 *
 * So there is one card on a stage, turning over: the front, a flip button, the
 * back. The frame takes its shape from the artwork's own pixels rather than
 * from a constant, so a portrait design is a portrait card and a landscape one
 * is landscape, and either way the image bleeds to the card's edge. It is the
 * same three-layer flip the issue sheet's live preview uses
 * (`issue-id-sheet.tsx`) — the operator sees the card here the way they saw it
 * when it was issued (§18.1).
 *
 * ### The shape comes from the artwork
 *
 * Nothing in the API says how big a template's design is: `Template` carries no
 * width or height, and the only truthful source is the rendered PNG itself. So
 * the frame starts at CR-80 and re-shapes on the front image's `load`, from its
 * `naturalWidth / naturalHeight`. That is one reflow on a picture that was
 * going to paint anyway, and it is what lets the image bleed to the card's
 * edges instead of being letterboxed inside a guess.
 *
 * The back is not measured. A two-sided design renders both faces at one size;
 * a back that came back a different shape is a bug in the renderer, and
 * re-shaping the frame mid-turn would hide it rather than show it.
 *
 * ### Bounded by height, not just width
 *
 * The card is the tightest of three widths: the stage, 340px, and the width at
 * which its *height* fills `--stage-h`. The last one is what a portrait design
 * needs — at 340px wide it stands ~540px tall, which is the whole dialog with
 * the fields pushed out of sight.
 *
 * ### The image links expire
 *
 * `front_image` and `back_image` are pre-signed S3 URLs carrying
 * `X-Amz-Expires=300` — **five minutes** from when they were fetched. A screen
 * left open over a coffee break comes back to broken images, which is why a
 * failed load offers a refetch rather than an alt-text stub: the fix is new
 * URLs, and the only place to get them is the request that produced these.
 */

/**
 * The card's own shadow — a physical object lying on the stage, not a picture
 * printed on it. The issue sheet's preview carries the same one, because it is
 * the same object seen in a different screen.
 */
export const CARD_SHADOW =
  "shadow-[0_10px_24px_-8px_rgba(0,0,0,0.28),0_2px_6px_-2px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.7)]"

/** Width ÷ height of a CR-80 — the stand-in until the artwork says otherwise. */
const CR80 = 85.6 / 54

export function CardStage({
  card,
  meta,
  onRefresh,
  refreshing,
  className,
  stageHeight = "[--stage-h:34vh] min-[480px]:[--stage-h:42vh]",
}: {
  card: IDCard
  /** The badge in the stage's top corner — usually the status. */
  meta: { tone: Tone; label: string }
  /** Refetches whatever produced the card, which is what mints fresh URLs. */
  onRefresh: () => void
  refreshing: boolean
  className?: string
  /**
   * How tall the card may stand, as a `--stage-h` utility. The dialog default
   * shares an 88vh popup with the fields below it; a page can spend more.
   */
  stageHeight?: string
}) {
  const t = useT()
  const [face, setFace] = React.useState<"front" | "back">("front")
  const [ratio, setRatio] = React.useState(CR80)

  const hasBack = Boolean(card.backImage)
  const flipped = face === "back" && hasBack

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 bg-surface-sunken px-5 py-6",
        stageHeight,
        className
      )}
    >
      {/* Where it is, and the two numbers that identify it. Both are Latin
          inside an RTL column, so the cluster is pinned to LTR — otherwise
          "#279" and the key swap places on the Arabic locale. */}
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
        <div
          dir="ltr"
          className="flex min-w-0 items-center gap-2 font-mono text-xs text-text-placeholder"
        >
          <span>#{card.id}</span>
          {/* The QR key is what a verifier scans, so it is worth showing —
              truncated, because it is 36 characters of UUID. */}
          {card.uniqueKey && (
            <span title={card.uniqueKey} className="truncate">
              {card.uniqueKey.slice(0, 8)}…
            </span>
          )}
        </div>
      </div>

      <div style={{ width: `min(100%, 340px, calc(var(--stage-h) * ${ratio}))` }}>
        <div className="perspective-[1400px]" style={{ aspectRatio: ratio }}>
          {/* Three layers: a box holding the `perspective`, a `transform-3d`
              flipper that turns, and two faces stacked on it with their backs
              hidden — the rear one pre-turned 180° so it faces out once the
              flipper has come round. */}
          <div
            className={cn(
              "relative size-full transform-3d",
              "transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              // §18.0.10 — the turn collapses to an instant swap.
              "motion-reduce:transition-none",
              flipped && "rotate-y-180"
            )}
          >
            <CardFace
              label={t("printer.front")}
              src={card.frontImage}
              onMeasure={setRatio}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
            {hasBack && (
              <CardFace
                className="rotate-y-180"
                label={t("printer.back")}
                src={card.backImage}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            )}
          </div>
        </div>
      </div>

      {hasBack ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 md:h-8"
            aria-pressed={flipped}
            onClick={() => setFace(flipped ? "front" : "back")}
          >
            <FlipHorizontal
              data-icon="inline-start"
              strokeWidth={1.75}
              // The glyph turns with the card.
              className={cn(
                "transition-transform duration-500 motion-reduce:transition-none",
                flipped && "-scale-x-100"
              )}
            />
            {t("issue.flipCard")}
          </Button>
          <span className="text-xs font-medium text-text-muted">
            {flipped ? t("printer.back") : t("printer.front")}
          </span>
        </div>
      ) : (
        // Said once, quietly. Without it a one-sided card is indistinguishable
        // from a two-sided one whose back failed to render — but only once
        // there is a front to compare it to: a card whose artwork has not been
        // generated at all has no sides yet, and the face itself says so.
        card.frontImage && (
          <p className="text-xs text-text-placeholder">
            {t("printer.singleSided")}
          </p>
        )
      )}
    </div>
  )
}

/**
 * One face of the card.
 *
 * A missing `src` and a *broken* `src` are different states and read
 * differently: the first is artwork the backend has not produced yet, the
 * second is an expired link — and only the second is worth offering a button
 * for.
 */
function CardFace({
  className,
  label,
  src,
  onMeasure,
  onRefresh,
  refreshing,
}: {
  className?: string
  label: string
  src: string | null | undefined
  /** Only the front reports its shape — see the note on `CardStage`. */
  onMeasure?: (ratio: number) => void
  onRefresh: () => void
  refreshing: boolean
}) {
  const t = useT()
  /**
   * Which URL failed, rather than a bare "it failed".
   *
   * A refetch hands back a new URL for the same face, and the old failure is
   * not evidence about the new link — so the flag has to clear itself when
   * `src` changes. Storing the URL is what makes that fall out of a render
   * instead of needing an effect to reset it.
   */
  const [brokenSrc, setBrokenSrc] = React.useState<string | null>(null)
  const broken = src != null && brokenSrc === src
  const painted = src != null && !broken

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden",
        "rounded-xl backface-hidden",
        // A painted card is the artwork edge to edge, with nothing framing it
        // but its own shadow. An empty one is a placeholder, and says so with a
        // dashed outline.
        painted
          ? cn("bg-surface", CARD_SHADOW)
          : "border border-dashed border-border-strong bg-surface",
        className
      )}
    >
      {!src ? (
        <span className="inline-flex flex-col items-center gap-2 px-4 text-center text-[13px] text-text-placeholder">
          <ImageOff className="size-5 shrink-0" strokeWidth={1.5} />
          {t("printer.notGenerated")}
        </span>
      ) : broken ? (
        <div className="px-4 text-center">
          <p className="text-[13px] text-text-muted">{t("printer.linkExpired")}</p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={cn(
              "mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5",
              "text-xs font-medium text-text-secondary transition-colors",
              "hover:border-border-strong hover:text-text",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:text-text-placeholder"
            )}
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
              strokeWidth={1.5}
            />
            {t("common.refresh")}
          </button>
        </div>
      ) : (
        // A pre-signed URL on a host the image optimizer is not configured
        // for, and one that expires in five minutes: caching it through
        // /_next/image would cache a 403.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={t("printer.faceAlt", { face: label })}
          onError={() => setBrokenSrc(src)}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth > 0 && naturalHeight > 0) {
              onMeasure?.(naturalWidth / naturalHeight)
            }
          }}
          // The frame is the image's own shape, so `cover` and `contain` agree
          // — `cover` is the one that still bleeds if they ever disagree.
          className="size-full object-cover"
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Print
 * ------------------------------------------------------------------ */

/** The store never changes, so the subscription has nothing to do. */
const subscribeToNothing = () => () => {}

/**
 * What `window.print()` actually puts on paper — and, through the browser's
 * "Save as PDF", what a PDF of the card is.
 *
 * `window.print()` prints the *document*, and every screen showing a card is
 * a scrolling layout inside a fixed viewport — printed directly it comes out
 * clipped, at whatever size the popup happened to be, with the app's chrome
 * around it. So the faces are rendered a second time into this: a portal
 * straight onto `<body>`, hidden on screen, that is the only thing the print
 * stylesheet leaves visible (the print block at the end of app/globals.css).
 * It sizes each face to a real 85.6 × 54 mm and gives each its own page,
 * which is what a duplex card printer expects — and which is also why it is
 * the PDF path rather than a client-side PDF library: a card rasterised at
 * "whatever 1011px is at 96dpi" is a page the size of a poster.
 */
export function PrintSheet({ card }: { card: IDCard }) {
  // `document` does not exist during the server render, and this component is
  // still server-rendered even though it only ever opens from a click. Reading
  // "am I on the client" through `useSyncExternalStore` rather than an effect
  // keeps the server pass and the hydration pass agreeing on `false`, then
  // flips once — no cascading render, and nothing to reset.
  const mounted = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )

  if (!mounted || !card.frontImage) return null

  return createPortal(
    <div data-print-sheet aria-hidden>
      {/* eslint-disable @next/next/no-img-element -- pre-signed, expiring URLs. */}
      <div className="print-card">
        <img src={card.frontImage} alt="" />
      </div>
      {card.backImage && (
        <div className="print-card">
          <img src={card.backImage} alt="" />
        </div>
      )}
      {/* eslint-enable @next/next/no-img-element */}
    </div>,
    document.body
  )
}
