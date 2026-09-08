"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import type { Member } from "@/features/members/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

/**
 * Card view — DESIGN.md §8.12 and §9.
 *
 * Also the responsive fallback: below `lg` the table collapses to this rather
 * than squeezing every column.
 *
 * Structured as header → body → footer (§9.2–§9.4). Two rules do most of the
 * decluttering: the identifying fields are grouped and separated from the
 * descriptive ones by a single rule, and a field with no value is dropped
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

function MemberCard({ member }: { member: Member }) {
  const t = useT()
  const formatDate = useFormatDate()
  // Documented as always present; read defensively all the same, because a
  // missing array is a crash rather than a blank line.
  const organizations = member.organizations ?? []

  return (
    // §9.1: 12px radius, 1px border, 20px padding, no resting shadow.
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      {/* Header — the two things that identify the member. Nothing competes
          with the name (§1.2). */}
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium text-text">
          {formatText(member.name)}
        </h3>
        <p className="mt-1 truncate font-mono text-[13px] tabular-nums text-text-muted">
          {formatPhone(member.phone)}
        </p>
      </div>

      {/* The card is where the full membership list lives — the table column
          only has room for the first and a count. Badges rather than a comma
          string: they wrap as units, so a long name never splits across two
          lines mid-word (§14.1). */}
      {organizations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
          {organizations.map((organization) => (
            <SoftBadge key={organization.id}>{organization.name}</SoftBadge>
          ))}
        </div>
      )}

      {/* Body — 16px header-to-body gap (§9.2), aligned pairs. */}
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("members.columns.joinDate")}
          value={formatDate(member.joinDate)}
        />
        <Detail
          label={t("members.columns.added")}
          value={formatDate(member.createdAt)}
        />
      </dl>

      {/* Footer — the member id. */}
      <div className="mt-4 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{member.id}
        </span>
      </div>
    </article>
  )
}

export function CardView({ table }: { table: TanTable<Features, Member> }) {
  const t = useT()
  const members = table.getRowModel().rows.map((row) => row.original)

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={t("members.emptyTitle")} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {members.map((member) => (
        <MemberCard key={member.id} member={member} />
      ))}
    </div>
  )
}
