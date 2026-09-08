"use client"

import type { Table as TanTable } from "@tanstack/react-table"
import { ShieldBan } from "lucide-react"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import type { BlackList } from "@/features/black-list/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

import { RemoveEntryButton } from "./entry-actions"

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
 *
 * ### The number is the headline, not the name
 *
 * Same reasoning as the table (see columns.tsx): the block keys on the phone,
 * and two entries can carry the same name. So the number takes the heading and
 * the name sits under it, which is the inverse of the member card beside it —
 * deliberately, because these are not the same kind of record.
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

function EntryCard({
  entry,
  onRemove,
}: {
  entry: BlackList
  onRemove: (entry: BlackList) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()

  return (
    // §9.1: 12px radius, 1px border, 20px padding, no resting shadow.
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      {/* Header — the number that is barred, and the name it was filed under.
          The glyph is the one piece of tone on the card: it says what kind of
          record this is at a glance, without turning the whole card red. */}
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger-bg text-danger"
        >
          <ShieldBan className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h3
            dir="ltr"
            className="truncate font-mono text-sm font-medium tabular-nums text-text rtl:text-end"
          >
            {formatPhone(entry.phone)}
          </h3>
          <p className="mt-1 truncate text-[13px] text-text-muted">
            {formatText(entry.name)}
          </p>
        </div>
      </div>

      {/* Whose list this is. A badge rather than a `Detail` row: it is scope,
          not a value, and it wraps as a unit so a long organization name never
          splits mid-word (§14.1). */}
      {entry.organization?.name && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
          <SoftBadge>{entry.organization.name}</SoftBadge>
        </div>
      )}

      {/* Body — 16px header-to-body gap (§9.2), aligned pairs. */}
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("blackList.columns.blockedOn")}
          value={formatDate(entry.createdAt)}
        />
      </dl>

      {/* Footer — the entry id, and the one verb this screen has. */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{entry.id}
        </span>
        <RemoveEntryButton entry={entry} onRemove={onRemove} />
      </div>
    </article>
  )
}

export function CardView({
  table,
  onRemove,
  emptyTitle,
  emptyHint,
}: {
  table: TanTable<Features, BlackList>
  onRemove: (entry: BlackList) => void
  /** The screen owns the wording — an empty list and a filtered-out one differ. */
  emptyTitle: string
  emptyHint?: string
}) {
  const entries = table.getRowModel().rows.map((row) => row.original)

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onRemove={onRemove} />
      ))}
    </div>
  )
}
