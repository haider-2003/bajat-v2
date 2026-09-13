"use client"

import * as React from "react"
import axios from "axios"
import { ArrowLeft, Check, Download, History, Printer, RefreshCw, X } from "lucide-react"

import { CardStage, PrintSheet } from "@/components/id-card/card-stage"
import { NodeChip } from "@/components/nodes/node-swatch"
import { Permission } from "@/components/permission"
import { EmptyState } from "@/components/table/empty-state"
import { LoadFailed, LoadingState } from "@/components/table/load-states"
import { Button } from "@/components/ui/button"
import { useGetId } from "@/features/ids/api"
import { identityName, identityPhone, requestFields } from "@/features/ids/fields"
import { statusMeta } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { useGetTemplate } from "@/features/templates/api"
import { readDesign } from "@/features/templates/design"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { Link, useLocaleRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { downloadCardFaces } from "@/utils/download-image"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

import { NodeHistoryTrail } from "./node-history"
import { ReviewDialog, type ReviewMode } from "./review-dialog"

/**
 * Reviewing one card at its current node — docs/IDS-FLOW-EXPORTS-ROUTES.md §3.5.
 *
 * ### Same card as the ledger's page, different question
 *
 * `GET /identity/{id}` — the same cache entry the Requests detail reads —
 * and the same chained `GET /template/{id}` for the field labels. What is
 * different is the verb. The ledger asks "where is this card on the status
 * ladder"; this asks "does it pass *my* step", and the answer is a record:
 * a note, ad-hoc fields, attachments, appended to `nodeHistory` for the
 * next reviewer to read. So the trail sits beside the fields here, and the
 * fields are read-only — a reviewer judges what was submitted, they do not
 * edit it.
 *
 * ### After a decision, one navigation
 *
 * The card has left this reviewer's inbox — approved, it is at the next
 * node; rejected, the flow has stopped — so there is nothing on its page
 * left for them to do, and the page goes back to the inbox. Once. The
 * reference client went `back()` and then `push()`ed the inbox on top of it
 * (spec §9.4).
 *
 * ### Has an error state, unlike the reference page
 *
 * A failed or missing card renders a way back rather than nothing at all
 * (spec §9.13).
 *
 * ### Gates
 *
 * Approve and reject follow `update-identity`, disabled with a tooltip: the
 * inbox's Review segment is gated the same way, and the server is the
 * authority on whether the caller holds this node.
 */
const BACK_HREF = "/id-issuance/flow"

export function FlowReview({ id }: { id: number }) {
  const t = useT()
  const router = useLocaleRouter()
  const formatDate = useFormatDate()

  const cardQuery = useGetId(id)
  const card = cardQuery.data ?? null

  const templateQuery = useGetTemplate(card?.template?.id)
  const design = React.useMemo(
    () => readDesign(templateQuery.data?.template),
    [templateQuery.data]
  )

  const [mode, setMode] = React.useState<ReviewMode | null>(null)

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
        <EmptyState title={t("ids.notFound")} hint={t("idsFlow.notFoundHint")} />
        <div className="mt-5 flex justify-center">
          <Button variant="outline" nativeButton={false} render={<Link href={BACK_HREF} />}>
            <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" strokeWidth={1.75} />
            {t("idsFlow.backToInbox")}
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
  const history = card.nodeHistory ?? []

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={BACK_HREF}
            className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
            {t("idsFlow.backToInbox")}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {name ?? t("ids.cardNumber", { id: card.id })}
            </h1>
            {card.node?.name && <NodeChip color={card.node.color} name={card.node.name} />}
          </div>
          <p className="mt-1 text-[13px] text-text-muted">
            {formatText(card.template?.title)}
            {card.organization?.name ? " · " + card.organization.name : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-10 sm:h-8"
              disabled={!card.frontImage}
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
            <Button
              variant="outline"
              className="h-10 sm:h-8"
              disabled={!card.frontImage}
              onClick={() => window.print()}
            >
              <Printer data-icon="inline-start" strokeWidth={1.75} />
              {t("ids.printOrPdf")}
            </Button>
            <button
              type="button"
              onClick={() => cardQuery.refetch()}
              disabled={cardQuery.isFetching}
              className={cn(
                "ms-auto inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium",
                "text-text-muted transition-colors outline-none hover:text-text",
                "focus-visible:ring-2 focus-visible:ring-ring disabled:text-text-placeholder"
              )}
            >
              <RefreshCw
                className={cn("size-3.5", cardQuery.isFetching && "animate-spin")}
                strokeWidth={1.5}
              />
              {t("templates.refreshArtwork")}
            </button>
          </div>
          <PrintSheet card={card} />
        </div>

        <div className="flex flex-col gap-6">
          {/* The decision — the reason this page exists. */}
          <section className="rounded-xl border border-border bg-background-subtle p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-text">{t("idsFlow.decision.title")}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              {card.node?.name
                ? t("idsFlow.decision.hintAtStage", { stage: card.node.name })
                : t("idsFlow.decision.hint")}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Permission can="update-identity" showWithTooltip>
                <Button
                  className="h-11 w-full sm:h-9 sm:w-auto"
                  onClick={() => setMode("approve")}
                >
                  <Check data-icon="inline-start" strokeWidth={1.75} />
                  {t("idsFlow.approve")}
                </Button>
              </Permission>
              <Permission can="update-identity" showWithTooltip>
                <Button
                  variant="destructive"
                  className="h-11 w-full sm:h-9 sm:w-auto"
                  onClick={() => setMode("reject")}
                >
                  <X data-icon="inline-start" strokeWidth={1.75} />
                  {t("idsFlow.reject")}
                </Button>
              </Permission>
            </div>
          </section>

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
            <Detail label={t("templates.singular")} value={formatText(card.template?.title)} />
            <Detail label={t("common.status")} value={meta.label} />
            <Detail label={t("ids.columns.issued")} value={formatDate(card.createdAt)} />
            <Detail label={t("printer.createdBy")} value={formatText(card.creatable?.name)} />
          </Section>

          <SubmittedFields card={card} design={design} />

          {/* What the reviewers before this one recorded. */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <History className="size-4 text-text-muted" strokeWidth={1.5} aria-hidden />
              <h2 className="text-sm font-semibold text-text">{t("idsFlow.history.title")}</h2>
              {history.length > 0 && (
                <span className="font-mono text-xs text-text-placeholder">{history.length}</span>
              )}
            </div>
            <NodeHistoryTrail history={history} />
          </section>
        </div>
      </div>

      <ReviewDialog
        card={card}
        mode={mode}
        onOpenChange={(open) => !open && setMode(null)}
        onDone={() => {
          setMode(null)
          router.push(BACK_HREF)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ *
 * The submission
 * ------------------------------------------------------------------ */

function SubmittedFields({
  card,
  design,
}: {
  card: IDCard
  design: ReturnType<typeof readDesign>
}) {
  const t = useT()
  const fields = React.useMemo(() => requestFields(card, design), [card, design])
  const textFields = fields.filter((field) => !field.image)
  const imageFields = fields.filter((field) => field.image)

  if (fields.length === 0) return null

  return (
    <Section title={t("printer.templateFields")}>
      {textFields.map((field) => (
        <Detail key={field.key} label={field.label} title={field.key} value={field.value} />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 min-[480px]:grid-cols-2">
        {children}
      </dl>
    </section>
  )
}

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

