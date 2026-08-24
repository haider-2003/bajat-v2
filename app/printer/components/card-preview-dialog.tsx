"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { AlertCircle, ImageOff, Loader2, Printer, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SoftBadge } from "@/components/ui/data-bits"
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
import { useChangeIdStatus } from "@/features/ids/api"
import { identityName, identityPhone, requestFields } from "@/features/ids/fields"
import { nextPrintStep, statusMeta } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { cn } from "@/lib/utils"
import { EMPTY_VALUE, formatDate, formatPhone, formatText } from "@/utils/format"

/**
 * The card itself, and the two things you do to it — DESIGN.md §13.
 *
 * The printer queue's detail view. A row says *that* a card is waiting; this
 * says what will come out of the printer, which is the only way to catch a
 * blank photo or the wrong template before the stock is spent.
 *
 * ### Printing goes through a separate sheet, not this dialog
 *
 * `window.print()` prints the document, and this dialog is a scrolling popup
 * inside a fixed viewport — printed directly it comes out clipped, at whatever
 * size the popup happened to be, with the app's chrome around it.
 *
 * So the faces are rendered *twice*: once here at CR80 proportions for the eye,
 * and once into `PrintSheet` — a portal straight onto `<body>`, hidden on
 * screen, that is the only thing the print stylesheet leaves visible (the print
 * block at the end of app/globals.css). That one sizes each face to a real
 * 85.6 x 54 mm and gives each its own page, which is what a duplex card printer
 * expects.
 *
 * ### The image links expire
 *
 * `front_image` and `back_image` are pre-signed S3 URLs carrying
 * `X-Amz-Expires=300` — **five minutes** from when the list was fetched. A
 * queue left open over a coffee break comes back to broken images, which is why
 * a failed load offers a refetch rather than an alt-text stub: the fix is new
 * URLs, and the only place to get them is the list request that produced these.
 */
export function CardPreviewDialog({
  card,
  open,
  onOpenChange,
  onRefresh,
  refreshing,
}: {
  /** The row being previewed. `null` between openings — nothing renders. */
  card: IDCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Refetches the list, which is what mints fresh image URLs. */
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <Dialog open={open && card !== null} onOpenChange={onOpenChange}>
      {card && (
        <CardPreview card={card} onRefresh={onRefresh} refreshing={refreshing} />
      )}
    </Dialog>
  )
}

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

function CardPreview({
  card,
  onRefresh,
  refreshing,
}: {
  card: IDCard
  onRefresh: () => void
  refreshing: boolean
}) {
  const change = useChangeIdStatus()
  const step = nextPrintStep(card.status)
  const meta = statusMeta(card.status)

  const name = identityName(card)
  const phone = identityPhone(card)
  const fields = requestFields(card)
  const textFields = fields.filter((field) => !field.image)
  const imageFields = fields.filter((field) => field.image)

  return (
    <DialogContent size="lg">
      <DialogCloseButton />

      <DialogHeader>
        <DialogTitle>{name ?? "Card #" + card.id}</DialogTitle>
        <DialogDescription>
          {formatText(card.template?.title)}
          {card.organization?.name ? " · " + card.organization.name : ""}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
          <span className="font-mono text-xs text-text-placeholder">
            #{card.id}
          </span>
          {/* The QR key is what a verifier scans, so it is worth showing —
              truncated, because it is 36 characters of UUID. */}
          {card.uniqueKey && (
            <span
              title={card.uniqueKey}
              className="truncate font-mono text-xs text-text-placeholder"
            >
              {card.uniqueKey.slice(0, 8)}…
            </span>
          )}
        </div>

        {/* The artwork. Two faces side by side once there is room; stacked
            below `sm`, where a card at half width is unreadable. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <CardFace
            label="Front"
            src={card.frontImage}
            onRefresh={onRefresh}
            refreshing={refreshing}
          />
          <CardFace
            label="Back"
            src={card.backImage}
            emptyLabel="Single-sided template"
            onRefresh={onRefresh}
            refreshing={refreshing}
          />
        </div>

        <dl className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <Detail label="Cardholder" value={formatText(name)} />
          <Detail label="Phone" value={formatPhone(phone)} />
          <Detail
            label="Organization"
            value={formatText(card.organization?.name)}
          />
          <Detail label="Template" value={formatText(card.template?.title)} />
          <Detail label="Issued" value={formatDate(card.createdAt)} />
          <Detail label="Last moved" value={formatDate(card.updatedAt)} />
          <Detail label="Created by" value={formatText(card.creatable?.name)} />
        </dl>

        {/* The template's own variables — whatever this design happens to
            collect. Shown because a wrong value here is the other half of what
            a preview is for. The labels are best-effort: some keys are
            transliterated Arabic, so each one carries its raw key on hover
            (features/ids/fields.ts). */}
        {textFields.length > 0 && (
          <div className="border-t border-border-subtle pt-4">
            <p className="mb-2 text-xs font-medium text-text-muted">
              Template fields
            </p>
            <dl className="flex flex-col gap-2">
              {textFields.map((field) => (
                <Detail
                  key={field.key}
                  label={field.label}
                  title={field.key}
                  value={field.value}
                />
              ))}
            </dl>
          </div>
        )}

        {imageFields.length > 0 && (
          <div className="flex flex-wrap gap-3 border-t border-border-subtle pt-4">
            {imageFields.map((field) => (
              <figure key={field.key} className="w-20">
                {/* eslint-disable-next-line @next/next/no-img-element -- a
                    pre-signed URL on a host the image optimizer is not
                    configured for, and one that expires in five minutes:
                    caching it through /_next/image would cache a 403. */}
                <img
                  src={field.value}
                  alt={field.label}
                  className="size-20 rounded-md border border-border object-cover"
                />
                <figcaption
                  title={field.key}
                  className="mt-1 truncate text-[11px] text-text-muted"
                >
                  {field.label}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {change.isError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
          >
            <AlertCircle
              className="mt-px size-4 shrink-0 text-danger"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-danger">
              Couldn&apos;t move this card. Try again.
            </p>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogClose
          render={
            <Button variant="outline" type="button" className={ACTION}>
              Close
            </Button>
          }
        />

        {/* Advancing the status and printing are deliberately separate buttons.
            The printer jams, the stock runs out — a card marked printed because
            a dialog was opened is a card nobody prints. */}
        {step && (
          <Button
            variant="secondary"
            type="button"
            className={ACTION}
            disabled={change.isPending}
            onClick={() => change.mutate({ id: card.id, status: step.status })}
          >
            {change.isPending && (
              <Loader2
                data-icon="inline-start"
                className="animate-spin"
                strokeWidth={1.75}
              />
            )}
            {step.label}
          </Button>
        )}

        {/* §13.5 allows a solid primary here: it is what the screen is for. */}
        <Button
          type="button"
          className={ACTION}
          disabled={!card.frontImage}
          onClick={() => window.print()}
        >
          <Printer data-icon="inline-start" strokeWidth={1.75} />
          Print
        </Button>
      </DialogFooter>

      {/* Not part of the layout above: it has to be a direct child of <body>
          for the print stylesheet to be able to hide everything else. */}
      <PrintSheet card={card} />
    </DialogContent>
  )
}

/** One `label / value` pair. Renders nothing when there is no value. */
function Detail({
  label,
  value,
  title,
}: {
  label: string
  value: string
  /** The raw template key, for a label that came out unreadable. */
  title?: string
}) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt title={title} className="shrink-0 text-xs text-text-muted">
        {label}
      </dt>
      <dd title={value} className="truncate text-[13px] text-text-secondary">
        {value}
      </dd>
    </div>
  )
}

/**
 * One face of the card, at CR80 proportions.
 *
 * A missing `src` and a *broken* `src` are different states and read
 * differently: the first is a template with no back side, the second is an
 * expired link — and only the second is worth offering a button for.
 */
function CardFace({
  label,
  src,
  emptyLabel = "Not generated yet",
  onRefresh,
  refreshing,
}: {
  label: string
  src: string | null | undefined
  emptyLabel?: string
  onRefresh: () => void
  refreshing: boolean
}) {
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

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 text-xs font-medium text-text-muted">
        {label}
      </figcaption>
      <div
        className={cn(
          "flex aspect-[85.6/54] items-center justify-center overflow-hidden",
          "rounded-lg border border-border bg-surface-sunken"
        )}
      >
        {!src ? (
          <span className="inline-flex items-center gap-2 px-3 text-center text-[13px] text-text-placeholder">
            <ImageOff className="size-4 shrink-0" strokeWidth={1.5} />
            {emptyLabel}
          </span>
        ) : broken ? (
          <div className="px-3 text-center">
            <p className="text-[13px] text-text-muted">This link has expired.</p>
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
              Refresh
            </button>
          </div>
        ) : (
          // See the note on the template-field thumbnails above.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label + " of the card"}
            onError={() => setBrokenSrc(src)}
            className="size-full object-contain"
          />
        )}
      </div>
    </figure>
  )
}

/** The store never changes, so the subscription has nothing to do. */
const subscribeToNothing = () => () => {}

/**
 * What `window.print()` actually puts on paper.
 *
 * Hidden on screen, portalled to `<body>` so that no scrolling or clipping
 * ancestor sits between it and the page box, and sized in millimetres rather
 * than pixels — a card printed at "whatever 320px maps to" is a wasted blank.
 */
function PrintSheet({ card }: { card: IDCard }) {
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
