"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import { paymentStatusMeta } from "@/features/payments/status"
import type { Payment } from "@/features/payments/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatText } from "@/utils/format"

import { AmountCell } from "./amount-cell"

/**
 * Card view — DESIGN.md §8.12 and §9.
 *
 * Also the responsive fallback: below `lg` the table collapses to this rather
 * than squeezing every column.
 *
 * ### The amount is the headline
 *
 * On the table the reference leads, because a table is scanned for a specific
 * row. A card is read one at a time, and the question asked of a single
 * payment is how much and whether it settled — so the figure takes the heading
 * and the reference drops to the footer beside the id, where a support thread
 * can still quote it.
 */

/** One `label / value` pair. Renders nothing when there is no value. */
function Detail({ label, value }: { label: string; value: string }) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd className="truncate text-[13px] text-text-secondary">{value}</dd>
    </div>
  )
}

function PaymentCard({ payment }: { payment: Payment }) {
  const t = useT()
  const formatDate = useFormatDate()
  const status = paymentStatusMeta(t, payment.status)

  return (
    // §9.1: 12px radius, 1px border, 20px padding, no resting shadow.
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      {/* Header — how much, and whether it settled. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The cell is reused rather than re-styled: an amount that reads
              differently on a card than in a row is two renderings of one
              number, and only one of them can be the careful one. */}
          <div className="text-base [&_span]:text-base [&_span:last-child]:text-xs">
            <AmountCell amount={payment.amount} currency={payment.currency} />
          </div>
          <p className="mt-1 truncate text-[13px] text-text-muted">
            {formatText(payment.member?.name)}
          </p>
        </div>
        <SoftBadge tone={status.tone}>{status.label}</SoftBadge>
      </div>

      {/* Body — 16px header-to-body gap (§9.2), aligned pairs. */}
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("payments.columns.template")}
          value={formatText(payment.template?.title)}
        />
        <Detail
          label={t("payments.columns.paidAt")}
          value={formatDate(payment.paidAt)}
        />
        <Detail
          label={t("payments.columns.created")}
          value={formatDate(payment.createdAt)}
        />
      </dl>

      {/* Footer — the provider's reference, which is what a dispute quotes. */}
      <div className="mt-4 border-t border-border-subtle pt-3">
        <p
          dir="ltr"
          title={payment.requestId}
          className="truncate font-mono text-xs tracking-[0.02em] text-text-placeholder rtl:text-end"
        >
          {formatText(payment.requestId)}
        </p>
      </div>
    </article>
  )
}

export function CardView({
  table,
  emptyTitle,
  emptyHint,
}: {
  table: TanTable<Features, Payment>
  /** The screen owns the wording — an empty list and a filtered-out one differ. */
  emptyTitle: string
  emptyHint?: string
}) {
  const payments = table.getRowModel().rows.map((row) => row.original)

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {payments.map((payment) => (
        <PaymentCard key={payment.id} payment={payment} />
      ))}
    </div>
  )
}
