"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"

import type { Features } from "@/lib/table-features"
import { statusMeta } from "@/features/members-requests/status"
import type { MemberRequest } from "@/features/members-requests/types"
import {
  EMPTY_VALUE,
  formatDate,
  formatPhone,
  formatText,
} from "@/utils/format"

/**
 * Card view — DESIGN.md §8.12 and §9.
 *
 * Also the responsive fallback: below `lg` the table collapses to this rather
 * than squeezing every column.
 *
 * Structured as header → body → optional footer (§9.2–§9.4) instead of the
 * flat stack it was. Two changes do most of the decluttering: the identifying
 * fields (name, phone, status) are grouped and separated from the descriptive
 * ones by a single rule, and every field that has no value is simply dropped
 * rather than printed as a dash — a card only shows what it actually knows.
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

function RequestCard({ request }: { request: MemberRequest }) {
  const status = statusMeta(request.status)

  return (
    // §9.1: 12px radius, 1px border, 20px padding, no resting shadow.
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      {/* Header — the two things that identify the applicant, and the one
          thing you act on. Nothing competes with the name (§1.2). */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-text">
            {formatText(request.name)}
          </h3>
          <p className="mt-1 truncate font-mono text-[13px] tabular-nums text-text-muted">
            {formatPhone(request.phone)}
          </p>
        </div>
        <SoftBadge tone={status.tone}>{status.label}</SoftBadge>
      </div>

      {/* Body — 16px header-to-body gap (§9.2), one rule, aligned pairs. */}
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail label="Organization" value={formatText(request.organization?.name)} />
        <Detail label="Submitted" value={formatDate(request.createdAt)} />
        <Detail label="Join date" value={formatDate(request.joinDate)} />
      </dl>

      {/* Footer — the request id, and a rejection note when there is one. */}
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{request.id}
        </span>
        {request.note && (
          <p
            title={request.note}
            className="truncate text-xs text-text-muted"
          >
            {request.note}
          </p>
        )}
      </div>
    </article>
  )
}

export function CardView({ table }: { table: TanTable<Features, MemberRequest> }) {
  const requests = table.getRowModel().rows.map((row) => row.original)

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title="No requests match these filters" />
      </div>
    )
  }

  return (
    // Wider minimum than before: the pairs need room to sit on one line each,
    // and auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  )
}
