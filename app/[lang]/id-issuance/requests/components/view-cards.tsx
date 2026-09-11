"use client"

import * as React from "react"
import type { Table as TanTable } from "@tanstack/react-table"
import { ImageOff } from "lucide-react"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import { identityName, identityPhone } from "@/features/ids/fields"
import { statusMeta } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { Link } from "@/i18n/navigation"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

import { RequestActions, type RequestActionHandlers } from "./request-actions"

/**
 * Card view — DESIGN.md §8.12 and §9.
 *
 * The responsive fallback: below `lg` the table collapses to this rather
 * than squeezing eight columns. Leads with the artwork for the same reason
 * the printer's grid does — a card is recognised by its face faster than by
 * a line naming its template.
 *
 * The thumbnail is a `Link` to the card's page rather than a button: the
 * record lives at its own URL here, so the picture of the thing goes where
 * the row goes.
 */
export function CardView({
  table,
  emptyTitle,
  handlers,
}: {
  table: TanTable<Features, IDCard>
  emptyTitle: string
  handlers: RequestActionHandlers
}) {
  const cards = table.getRowModel().rows.map((row) => row.original)

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {cards.map((card) => (
        <IdentityCard key={card.id} card={card} handlers={handlers} />
      ))}
    </div>
  )
}

function IdentityCard({
  card,
  handlers,
}: {
  card: IDCard
  handlers: RequestActionHandlers
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const meta = statusMeta(t, card.status)
  const name = identityName(card)

  return (
    // §9.1: 12px radius, 1px border, 20px padding, no resting shadow.
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <Thumbnail card={card} />

      {/* Header — who it is, and where it is (§9.2). */}
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-text">
            {formatText(name)}
          </h3>
          <p
            dir="ltr"
            className="mt-1 truncate font-mono text-[13px] tabular-nums text-text-muted rtl:text-end"
          >
            {formatPhone(identityPhone(card))}
          </p>
        </div>
        <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
      </div>

      {/* Body — a field with no value is dropped rather than printed as a
          dash (§9.3). */}
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("templates.singular")}
          value={formatText(card.template?.title)}
        />
        <Detail
          label={t("filters.attributes.organization")}
          value={formatText(card.organization?.name)}
        />
        <Detail label={t("ids.columns.issued")} value={formatDate(card.createdAt)} />
      </dl>

      {/* Footer — the card id, and the same verbs the table row carries. */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{card.id}
        </span>
        <RequestActions card={card} handlers={handlers} />
      </div>
    </article>
  )
}

/**
 * The front face, linking to the card's page.
 *
 * A broken image is left as an empty frame rather than a retry control. The
 * links expire after five minutes (see `CardStage`), and a grid of thirty
 * "Refresh" buttons that all do the same one refetch is noise; the frame
 * stays the right shape and the page explains it.
 */
function Thumbnail({ card }: { card: IDCard }) {
  const t = useT()
  // The failed URL rather than a bare flag, so a refetch's fresh link clears
  // it during render instead of needing an effect to reset it.
  const [brokenSrc, setBrokenSrc] = React.useState<string | null>(null)
  const missing = !card.frontImage || brokenSrc === card.frontImage

  return (
    <Link
      href={`/id-issuance/requests/${card.id}`}
      aria-label={t("ids.openCard", { id: card.id })}
      className={[
        "flex aspect-[85.6/54] w-full items-center justify-center overflow-hidden",
        "rounded-lg border border-border bg-surface-sunken",
        "transition-colors duration-120 outline-none",
        "hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
      ].join(" ")}
    >
      {missing ? (
        <ImageOff className="size-5 text-text-placeholder" strokeWidth={1.5} />
      ) : (
        // A pre-signed URL on a host the image optimizer is not configured
        // for, and one that expires in five minutes: caching it through
        // /_next/image would cache a 403.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.frontImage ?? undefined}
          alt=""
          onError={() => setBrokenSrc(card.frontImage ?? null)}
          className="size-full object-contain"
        />
      )}
    </Link>
  )
}

/** One `label / value` pair. Renders nothing when there is no value. */
function Detail({ label, value }: { label: string; value: string }) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd title={value} className="truncate text-[13px] text-text-secondary">
        {value}
      </dd>
    </div>
  )
}
