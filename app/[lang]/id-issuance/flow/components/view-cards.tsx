"use client"

import * as React from "react"
import type { Table as TanTable } from "@tanstack/react-table"
import { ImageOff } from "lucide-react"

import { NodeChip } from "@/components/nodes/node-swatch"
import { EmptyState } from "@/components/table/empty-state"
import { identityName, identityPhone } from "@/features/ids/fields"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { Link } from "@/i18n/navigation"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

import { FlowActions, flowHref, type FlowActionHandlers } from "./flow-actions"

/**
 * Card view — DESIGN.md §8.12 and §9. The responsive fallback below `lg`.
 *
 * Same shape as the ledger's grid, with the stage chip where the status badge
 * would be: on this screen the stage *is* the status.
 */
export function CardView({
  table,
  emptyTitle,
  handlers,
}: {
  table: TanTable<Features, IDCard>
  emptyTitle: string
  handlers: FlowActionHandlers
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
  handlers: FlowActionHandlers
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const name = identityName(card)

  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <Thumbnail card={card} />

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
        {card.node?.name && <NodeChip color={card.node.color} name={card.node.name} />}
      </div>

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

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{card.id}
        </span>
        <FlowActions card={card} handlers={handlers} />
      </div>
    </article>
  )
}

function Thumbnail({ card }: { card: IDCard }) {
  const t = useT()
  const [brokenSrc, setBrokenSrc] = React.useState<string | null>(null)
  const missing = !card.frontImage || brokenSrc === card.frontImage

  return (
    <Link
      href={flowHref(card.id)}
      aria-label={t("idsFlow.reviewCard", { id: card.id })}
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
        // A pre-signed, expiring URL; the optimizer would cache a 403.
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
