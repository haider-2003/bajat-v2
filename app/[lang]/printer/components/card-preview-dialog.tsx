"use client"

import * as React from "react"
import { AlertCircle, Loader2, Printer } from "lucide-react"

import { CardStage, PrintSheet } from "@/components/id-card/card-stage"
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
import { useChangeIdStatus } from "@/features/ids/api"
import { identityName, identityPhone, requestFields } from "@/features/ids/fields"
import { nextPrintStep, statusMeta } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { cn } from "@/lib/utils"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

/**
 * The card itself, and the two things you do to it — DESIGN.md §13.
 *
 * The printer queue's detail view. A row says *that* a card is waiting; this
 * says what will come out of the printer, which is the only way to catch a
 * blank photo or the wrong template before the stock is spent.
 *
 * ### The card, the flip and the print sheet live in `components/id-card`
 *
 * `CardStage` (the one-object flip, shaped by the artwork) and `PrintSheet`
 * (the hidden, millimetre-sized portal `window.print()` actually prints) are
 * shared with the Requests and ID Flow detail screens, which show the same
 * card for different reasons. What is left here is what is specific to a
 * print queue: the fields an operator checks before spending stock, and the
 * step that moves the card along.
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
  const t = useT()
  const formatDate = useFormatDate()
  const change = useChangeIdStatus()
  const step = nextPrintStep(card.status)
  const meta = statusMeta(t, card.status)

  const name = identityName(card)
  const phone = identityPhone(card)
  const fields = requestFields(card)
  const textFields = fields.filter((field) => !field.image)
  const imageFields = fields.filter((field) => field.image)

  return (
    <DialogContent size="lg">
      <DialogCloseButton />

      <DialogHeader>
        <DialogTitle>{name ?? t("printer.cardNumber", { id: card.id })}</DialogTitle>
        <DialogDescription>
          {formatText(card.template?.title)}
          {card.organization?.name ? " · " + card.organization.name : ""}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        {/* Full-bleed against DialogBody's 20px gutter, flush under the
            header, and bordered top and bottom so the artwork reads as its
            own region rather than as the first row of a form — §13.6's
            "inner rows sunken relative to the dialog surface". */}
        <CardStage
          card={card}
          meta={meta}
          onRefresh={onRefresh}
          refreshing={refreshing}
          className="-mx-5 border-y border-border-subtle"
        />

        <Section title={t("printer.details")}>
          <Detail label={t("printer.columns.cardholder")} value={formatText(name)} />
          <Detail
            label={t("members.columns.phone")}
            value={formatPhone(phone)}
            mono
          />
          <Detail
            label={t("filters.attributes.organization")}
            value={formatText(card.organization?.name)}
          />
          <Detail
            label={t("templates.singular")}
            value={formatText(card.template?.title)}
          />
          <Detail label={t("printer.issued")} value={formatDate(card.createdAt)} />
          <Detail
            label={t("printer.columns.lastMoved")}
            value={formatDate(card.updatedAt)}
          />
          <Detail
            label={t("printer.createdBy")}
            value={formatText(card.creatable?.name)}
          />
        </Section>

        {/* The template's own variables — whatever this design happens to
            collect. Shown because a wrong value here is the other half of what
            a preview is for. The labels are best-effort: some keys are
            transliterated Arabic, so each one carries its raw key on hover
            (features/ids/fields.ts). */}
        {(textFields.length > 0 || imageFields.length > 0) && (
          <Section title={t("printer.templateFields")}>
            {textFields.map((field) => (
              <Detail
                key={field.key}
                label={field.label}
                title={field.key}
                value={field.value}
              />
            ))}

            {imageFields.length > 0 && (
              <div className="col-span-full flex flex-wrap gap-3">
                {imageFields.map((field) => (
                  <figure key={field.key} className="w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a
                        pre-signed URL on a host the image optimizer is not
                        configured for, and one that expires in five minutes:
                        caching it through /_next/image would cache a 403. */}
                    <img
                      src={field.value}
                      alt={field.label}
                      className="size-20 rounded-lg border border-border object-cover"
                    />
                    <figcaption
                      title={field.key}
                      className="mt-1.5 truncate text-[11px] text-text-muted"
                    >
                      {field.label}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Section>
        )}

        {change.isError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
          >
            <AlertCircle
              className="mt-px size-4 shrink-0 text-danger"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-danger">{t("printer.moveFailed")}</p>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogClose
          render={
            <Button variant="outline" type="button" className={ACTION}>
              {t("common.close")}
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
            {t(step.labelKey)}
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
          {t("printer.print")}
        </Button>
      </DialogFooter>

      {/* Not part of the layout above: it has to be a direct child of <body>
          for the print stylesheet to be able to hide everything else. */}
      <PrintSheet card={card} />
    </DialogContent>
  )
}

/* ------------------------------------------------------------------ *
 * The fields
 * ------------------------------------------------------------------ */

/**
 * §13.4's section: a 14/600 heading with 20px above it and 10px below, over a
 * two-column grid of pairs.
 *
 * Two columns rather than one long ladder: the dialog is 640px wide, and seven
 * label/value rows down the middle of it leave a stripe of dead space on each
 * side while truncating an Arabic organisation name that had the room to fit.
 */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="pt-5">
      <h3 className="mb-2.5 text-sm font-semibold text-text">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 min-[480px]:grid-cols-2">
        {children}
      </dl>
    </section>
  )
}

/**
 * One `label / value` pair, label over value. Renders nothing when there is no
 * value (§9.3 — an absent field is dropped, not printed as a dash).
 *
 * Stacked rather than the inline `label … value` the table cards use: half the
 * values here are Arabic names and timestamps, which at half of a half-width
 * row spend more of their life truncated than read.
 */
function Detail({
  label,
  value,
  title,
  mono,
}: {
  label: string
  value: string
  /** The raw template key, for a label that came out unreadable. */
  title?: string
  /** Digits that read left-to-right whatever the locale does — phone numbers. */
  mono?: boolean
}) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="min-w-0">
      <dt title={title} className="truncate text-xs text-text-muted">
        {label}
      </dt>
      <dd
        title={value}
        dir={mono ? "ltr" : undefined}
        className={cn(
          "mt-1 truncate text-[13px] text-text-secondary",
          mono && "font-mono tabular-nums rtl:text-end"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
