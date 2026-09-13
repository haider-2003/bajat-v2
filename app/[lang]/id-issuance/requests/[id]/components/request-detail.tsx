"use client"

import * as React from "react"
import axios from "axios"
import {
  ArrowLeft,
  Check,
  Download,
  Printer,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react"

import { CardStage, PrintSheet } from "@/components/id-card/card-stage"
import { DeleteIdentityDialog } from "@/components/id-card/delete-identity-dialog"
import { Permission } from "@/components/permission"
import { EmptyState } from "@/components/table/empty-state"
import { LoadFailed, LoadingState } from "@/components/table/load-states"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SoftBadge } from "@/components/ui/data-bits"
import { useAuthStore } from "@/features/auth/store"
import { useChangeIdStatus, useGetId } from "@/features/ids/api"
import { identityName, identityPhone, requestFields } from "@/features/ids/fields"
import { ledgerVerbs, statusMeta } from "@/features/ids/status"
import type { IDCard, StatusName } from "@/features/ids/types"
import { useGetTemplate } from "@/features/templates/api"
import { readDesign } from "@/features/templates/design"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { Link, useLocaleRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { downloadCardFaces } from "@/utils/download-image"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

import { EditableField } from "./editable-field"

/**
 * One issued card, and everything the ledger can do to it —
 * docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4.
 *
 * ### Two loads, chained
 *
 * `GET /identity/{id}` is the card. `GET /template/{templateId}` follows it,
 * for one thing only: the design's `vars[]`, which is where the *labels* and
 * *types* of the keys in `request` live. The card's embedded template is the
 * thin copy — a title and a face — and without the full one every field is a
 * humanised key edited as free text. The page renders as soon as the card is
 * in; the labels sharpen when the template lands.
 *
 * ### What can be done depends on where the card is
 *
 * `ledgerVerbs` (features/ids/status.ts) is the rule: approve / reject by
 * status only while `PENDING`, send to the printer once it is past that and
 * was not rejected. The confirmation for a status decision collects nothing
 * — no note, no fields — which is the difference between this screen and the
 * ID Flow review, where a decision is a record with attachments.
 *
 * ### Gated where the reference client was not
 *
 * The reference page had no permission check at all (spec §9.14). Here the
 * verbs follow `update-identity`, disabled with a tooltip rather than hidden:
 * a reviewer who cannot act needs to see that the buttons exist and the grant
 * does not. Delete follows `delete-identity` and is hidden without it, as on
 * every screen. The server is the authority on all of them.
 *
 * ### One artwork path
 *
 * Download goes through the app's own image proxy (utils/download-image.ts);
 * "print or save as PDF" goes through the same `PrintSheet` the printer uses,
 * at a real 85.6 × 54 mm — see the note on that component for why a PDF
 * library was not the answer.
 */
const BACK_HREF = "/id-issuance/requests"

/** Which confirmation is open, if any. */
type Decision = "approve" | "reject" | "print" | null

export function RequestDetail({ id }: { id: number }) {
  const t = useT()
  const router = useLocaleRouter()
  const formatDate = useFormatDate()
  const can = useAuthStore((s) => s.can)

  const cardQuery = useGetId(id)
  const card = cardQuery.data ?? null

  // Chained on the card: disabled until it names its template.
  const templateQuery = useGetTemplate(card?.template?.id)
  const design = React.useMemo(
    () => readDesign(templateQuery.data?.template),
    [templateQuery.data]
  )

  const [deleting, setDeleting] = React.useState(false)

  // The card being written, not a skeleton of the page: a single record
  // has no rows to keep the shape of, and the wait and the failure below
  // it should be the same block in two states.
  if (cardQuery.isPending) return <LoadingState label={t("ids.loadingOne")} />

  if (cardQuery.isError || !card) {
    const missing =
      !card ||
      (axios.isAxiosError(cardQuery.error) && cardQuery.error.response?.status === 404)
    return missing ? (
      <div className="rounded-xl border border-border bg-surface px-6 py-16">
        <EmptyState title={t("ids.notFound")} hint={t("ids.notFoundHint")} />
        <div className="mt-5 flex justify-center">
          <Button variant="outline" nativeButton={false} render={<Link href={BACK_HREF} />}>
            <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" strokeWidth={1.75} />
            {t("ids.backToRequests")}
          </Button>
        </div>
      </div>
    ) : (
      <LoadFailed
        title={t("ids.loadOneFailed")}
        error={cardQuery.error}
        onRetry={() => cardQuery.refetch()}
        retrying={cardQuery.isFetching}
      />
    )
  }

  const name = identityName(card)
  const meta = statusMeta(t, card.status)

  return (
    <>
      {/* Title block (§6.9) — who the card is for, and the way back. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={BACK_HREF}
            className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
            {t("ids.backToRequests")}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {name ?? t("ids.cardNumber", { id: card.id })}
            </h1>
            <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
          </div>
          <p className="mt-1 text-[13px] text-text-muted">
            {formatText(card.template?.title)}
            {card.organization?.name ? " · " + card.organization.name : ""}
          </p>
        </div>

        {can("delete-identity") && (
          <Button
            variant="outline"
            className="h-11 w-full sm:h-9 sm:w-auto"
            onClick={() => setDeleting(true)}
          >
            <Trash2 data-icon="inline-start" strokeWidth={1.75} />
            {t("common.delete")}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* The artwork and what can be done with it. */}
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-border">
            <CardStage
              card={card}
              meta={meta}
              onRefresh={() => cardQuery.refetch()}
              refreshing={cardQuery.isFetching}
              stageHeight="[--stage-h:40vh] lg:[--stage-h:52vh]"
            />
          </div>
          <ArtworkActions
            card={card}
            onRefresh={() => cardQuery.refetch()}
            refreshing={cardQuery.isFetching}
          />
        </div>

        <div className="flex flex-col gap-6">
          <DecisionPanel card={card} />

          <Section title={t("printer.details")}>
            <Detail label={t("ids.columns.cardholder")} value={formatText(name)} />
            <Detail
              label={t("members.columns.phone")}
              value={formatPhone(identityPhone(card))}
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
            <Detail label={t("ids.columns.issued")} value={formatDate(card.createdAt)} />
            <Detail
              label={t("filters.attributes.updated")}
              value={formatDate(card.updatedAt)}
            />
            <Detail label={t("printer.createdBy")} value={formatText(card.creatable?.name)} />
            <Detail label={t("ids.uniqueKey")} value={formatText(card.uniqueKey)} mono />
          </Section>

          <TemplateFields
            card={card}
            design={design}
            canEdit={can("update-identity")}
            loadingLabels={templateQuery.isPending && !!card.template?.id}
          />
        </div>
      </div>

      <DeleteIdentityDialog
        card={card}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => router.push(BACK_HREF)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ *
 * The decision
 * ------------------------------------------------------------------ */

/**
 * Approve / reject by status, or hand off to the printer — whichever the
 * card's status allows. Absent entirely when it allows neither: a card that
 * is already at the printer or beyond has nothing to decide here.
 */
function DecisionPanel({ card }: { card: IDCard }) {
  const t = useT()
  const change = useChangeIdStatus()
  const verbs = ledgerVerbs(card.status)
  const [decision, setDecision] = React.useState<Decision>(null)

  if (!verbs.decide && !verbs.sendToPrinter) return null

  const target: Record<NonNullable<Decision>, StatusName> = {
    approve: "APPROVED",
    reject: "REJECTED",
    print: "WAITING_TO_PRINT",
  }

  const confirm = () => {
    if (!decision) return
    change.mutate(
      { id: card.id, status: target[decision] },
      { onSuccess: () => setDecision(null) }
    )
  }

  const close = (open: boolean) => {
    if (!open) {
      setDecision(null)
      change.reset()
    }
  }

  const ACTION = "h-11 w-full sm:h-9 sm:w-auto"

  return (
    <section className="rounded-xl border border-border bg-background-subtle p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-text">{t("ids.decision.title")}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
        {verbs.decide
          ? t("ids.decision.pendingHint")
          : verbs.already
            ? t("ids.decision.alreadyQueuedHint")
            : t("ids.decision.printHint")}
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {verbs.decide && (
          <>
            <Permission can="update-identity" showWithTooltip>
              <Button className={ACTION} onClick={() => setDecision("approve")}>
                <Check data-icon="inline-start" strokeWidth={1.75} />
                {t("ids.decision.approve")}
              </Button>
            </Permission>
            <Permission can="update-identity" showWithTooltip>
              <Button
                variant="destructive"
                className={ACTION}
                onClick={() => setDecision("reject")}
              >
                <X data-icon="inline-start" strokeWidth={1.75} />
                {t("ids.decision.reject")}
              </Button>
            </Permission>
          </>
        )}

        {verbs.sendToPrinter && (
          <Permission can="update-identity" showWithTooltip>
            <Button
              variant={verbs.decide ? "secondary" : "default"}
              className={ACTION}
              // Already there: the verb stays, disabled, because "it is
              // already in the queue" is the answer, not "you cannot".
              disabled={verbs.already}
              onClick={() => setDecision("print")}
            >
              <Send data-icon="inline-start" strokeWidth={1.75} />
              {verbs.already ? t("ids.decision.alreadyQueued") : t("ids.decision.sendToPrinter")}
            </Button>
          </Permission>
        )}
      </div>

      <ConfirmDialog
        open={decision === "approve"}
        onOpenChange={close}
        title={t("ids.decision.approveTitle")}
        description={t("ids.decision.approveDescription")}
        terms={cardTerms(t, card)}
        confirmLabel={t("ids.decision.approve")}
        pendingLabel={t("ids.decision.approving")}
        destructive={false}
        onConfirm={confirm}
        pending={change.isPending}
        error={change.isError ? change.error : undefined}
        errorFallback={t("ids.decision.failed")}
      />
      <ConfirmDialog
        open={decision === "reject"}
        onOpenChange={close}
        title={t("ids.decision.rejectTitle")}
        description={t("ids.decision.rejectDescription")}
        terms={cardTerms(t, card)}
        confirmLabel={t("ids.decision.reject")}
        pendingLabel={t("ids.decision.rejecting")}
        onConfirm={confirm}
        pending={change.isPending}
        error={change.isError ? change.error : undefined}
        errorFallback={t("ids.decision.failed")}
      />
      <ConfirmDialog
        open={decision === "print"}
        onOpenChange={close}
        title={t("ids.decision.printTitle")}
        description={t("ids.decision.printDescription")}
        terms={cardTerms(t, card)}
        note={t("ids.decision.printNote")}
        confirmLabel={t("ids.decision.sendToPrinter")}
        pendingLabel={t("ids.decision.sending")}
        destructive={false}
        onConfirm={confirm}
        pending={change.isPending}
        error={change.isError ? change.error : undefined}
        errorFallback={t("ids.decision.failed")}
      />
    </section>
  )
}

/** The card, restated in a confirmation — enough to know which one it is. */
function cardTerms(t: ReturnType<typeof useT>, card: IDCard) {
  return [
    { label: t("ids.columns.card"), value: `#${card.id}` },
    { label: t("ids.columns.cardholder"), value: formatText(identityName(card)) },
    { label: t("templates.singular"), value: formatText(card.template?.title) },
    { label: t("common.status"), value: statusMeta(t, card.status).label },
  ]
}

/* ------------------------------------------------------------------ *
 * The artwork's verbs
 * ------------------------------------------------------------------ */

function ArtworkActions({
  card,
  onRefresh,
  refreshing,
}: {
  card: IDCard
  onRefresh: () => void
  refreshing: boolean
}) {
  const t = useT()
  const hasArtwork = !!card.frontImage

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="h-10 sm:h-8"
          disabled={!hasArtwork}
          onClick={() =>
            downloadCardFaces({
              front: card.frontImage,
              back: card.backImage,
              baseName: card.uniqueKey || `card-${card.id}`,
            })
          }
        >
          <Download data-icon="inline-start" strokeWidth={1.75} />
          {t("ids.downloadImages")}
        </Button>

        {/* The browser's print dialog is also its "Save as PDF" — see the
            note on `PrintSheet`. */}
        <Button
          variant="outline"
          className="h-10 sm:h-8"
          disabled={!hasArtwork}
          onClick={() => window.print()}
        >
          <Printer data-icon="inline-start" strokeWidth={1.75} />
          {t("ids.printOrPdf")}
        </Button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={cn(
            "ms-auto inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium",
            "text-text-muted transition-colors outline-none hover:text-text",
            "focus-visible:ring-2 focus-visible:ring-ring disabled:text-text-placeholder"
          )}
        >
          <RefreshCw
            className={cn("size-3.5", refreshing && "animate-spin")}
            strokeWidth={1.5}
          />
          {t("templates.refreshArtwork")}
        </button>
      </div>

      {/* Not part of the layout above: it has to be a direct child of <body>
          for the print stylesheet to be able to hide everything else. */}
      <PrintSheet card={card} />
    </>
  )
}

/* ------------------------------------------------------------------ *
 * The fields
 * ------------------------------------------------------------------ */

/**
 * The template's own variables — whatever this design happens to collect —
 * each one editable in place where the design allows it.
 */
function TemplateFields({
  card,
  design,
  canEdit,
  loadingLabels,
}: {
  card: IDCard
  design: ReturnType<typeof readDesign>
  canEdit: boolean
  /** The template is still on its way: labels may sharpen shortly. */
  loadingLabels: boolean
}) {
  const t = useT()
  const fields = React.useMemo(() => requestFields(card, design), [card, design])
  const textFields = fields.filter((field) => !field.image)
  const imageFields = fields.filter((field) => field.image)

  if (fields.length === 0) return null

  return (
    <Section
      title={t("printer.templateFields")}
      hint={loadingLabels ? t("ids.fields.loadingLabels") : t("ids.fields.editHint")}
    >
      {textFields.map((field) => (
        <EditableField key={field.key} card={card} field={field} canEdit={canEdit} />
      ))}

      {imageFields.length > 0 && (
        <div className="col-span-full flex flex-wrap gap-3">
          {imageFields.map((field) => (
            <figure key={field.key} className="w-20">
              {/* eslint-disable-next-line @next/next/no-img-element -- a
                  pre-signed URL that expires in five minutes; the optimizer
                  would cache a 403. */}
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
  )
}

/* ------------------------------------------------------------------ *
 * Layout bits
 * ------------------------------------------------------------------ */

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {hint && <p className="text-xs text-text-placeholder">{hint}</p>}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 min-[480px]:grid-cols-2">
        {children}
      </dl>
    </section>
  )
}

/**
 * One `label / value` pair, label over value. Renders nothing for an absent
 * value (§9.3 — dropped, not printed as a dash).
 */
function Detail({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  /** Digits that read left-to-right whatever the locale does. */
  mono?: boolean
}) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-text-muted">{label}</dt>
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

