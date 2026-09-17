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
import type { Features } from "@/lib/table-features"
import { displayImageSrc } from "@/utils/download-image"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

import { PrintActions } from "./print-actions"

/**
 * Gallery view — DESIGN.md §8.12 and §9.
 *
 * Also the responsive fallback: below `lg` the table collapses to this rather
 * than squeezing eight columns.
 *
 * ### This one leads with the artwork
 *
 * Every other card view in the app is a summary of fields. A print queue is
 * looked at differently — the operator is checking *what comes out of the
 * printer*, and the fastest read of a wrong template or a missing photo is the
 * card itself, not a line that says which template it used. So the front face
 * is the header, at true CR80 proportions, and the fields sit under it.
 */
export function CardView({
  table,
  onPreview,
}: {
  table: TanTable<Features, IDCard>
  onPreview: (card: IDCard) => void
}) {
  const t = useT()
  const cards = table.getRowModel().rows.map((row) => row.original)

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={t("printer.emptyTitle")} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {cards.map((card) => (
        <IdentityCard key={card.id} card={card} onPreview={onPreview} />
      ))}
    </div>
  )
}

function IdentityCard({
  card,
  onPreview,
}: {
  card: IDCard
  onPreview: (card: IDCard) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const meta = statusMeta(t, card.status)
  const name = identityName(card)

  return (
    // §9.1: 12px radius, 1px border, 20px padding, no resting shadow.
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <Thumbnail card={card} onPreview={onPreview} />

      {/* Header — who it is, and where it is in the queue (§9.2). */}
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

      {/* Body — 16px header-to-body gap (§9.2), aligned pairs. A field with no
          value is dropped rather than printed as a dash (§9.3). */}
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("filters.attributes.organization")}
          value={formatText(card.organization?.name)}
        />
        <Detail
          label={t("templates.singular")}
          value={formatText(card.template?.title)}
        />
        <Detail
          label={t("printer.columns.lastMoved")}
          value={formatDate(card.updatedAt)}
        />
      </dl>

      {/* Footer — the card id, and the same verb the table row carries. */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{card.id}
        </span>
        <PrintActions card={card} />
      </div>
    </article>
  )
}

/**
 * The front face, and the card's primary affordance.
 *
 * A button rather than a decorative image: clicking the picture of the thing is
 * what everyone tries first, and the alternative — a picture that looks
 * clickable and is not — is worse than no picture.
 *
 * A broken image is left as an empty frame rather than a retry control. The
 * links expire after five minutes (see the preview dialog), and a grid of
 * thirty "Refresh" buttons that all do the same one refetch is noise; the
 * frame stays the right shape and the preview explains it.
 */
function Thumbnail({
  card,
  onPreview,
}: {
  card: IDCard
  onPreview: (card: IDCard) => void
}) {
  const t = useT()
  // The failed URL rather than a bare flag, so a refetch's fresh link clears
  // it during render instead of needing an effect to reset it.
  const [brokenSrc, setBrokenSrc] = React.useState<string | null>(null)
  const missing = !card.frontImage || brokenSrc === card.frontImage

  return (
    <button
      type="button"
      onClick={() => onPreview(card)}
      aria-label={t("printer.previewCard", { id: card.id })}
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
          src={displayImageSrc(card.frontImage)}
          alt=""
          onError={() => setBrokenSrc(card.frontImage ?? null)}
          className="size-full object-contain"
        />
      )}
    </button>
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
