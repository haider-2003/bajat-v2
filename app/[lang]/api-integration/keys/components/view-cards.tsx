"use client"

import type { Table as TanTable } from "@tanstack/react-table"
import { KeyRound } from "lucide-react"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import type { ApiKey } from "@/features/api-keys/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatText } from "@/utils/format"

import { ApiKeyActions } from "./columns"
import { SecretCell } from "./secret-cell"

/**
 * Card view — DESIGN.md §8.12 and §9.
 *
 * Also the responsive fallback: below `lg` the table collapses to this rather
 * than squeezing every column.
 *
 * Structured as header → body → footer (§9.2–§9.4). A field with no value is
 * dropped rather than printed as a dash — a card only shows what it knows.
 *
 * The secret keeps its masked treatment here: a card is *more* likely to be on
 * a phone screen in a shared space than a table is, not less.
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

function ApiKeyCard({
  apiKey,
  onRename,
  onDelete,
}: {
  apiKey: ApiKey
  onRename: (apiKey: ApiKey) => void
  onDelete: (apiKey: ApiKey) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()

  return (
    // §9.1: 12px radius, 1px border, 20px padding, no resting shadow.
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      {/* Header — what this key is for. The glyph says what kind of record
          this is at a glance, without turning the whole card a colour. */}
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-violet"
        >
          <KeyRound className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-text">
            {formatText(apiKey.name)}
          </h3>
          <p className="mt-1 truncate text-[13px] text-text-muted">
            {formatText(apiKey.user?.name)}
          </p>
        </div>
      </div>

      {/* The secret gets its own band: it is the widest thing on the card and
          the only one with controls attached, so it does not sit in the
          aligned `Detail` pairs below. */}
      <div className="mt-4 min-w-0 rounded-lg border border-border bg-background-subtle px-2.5 py-2">
        <SecretCell secret={apiKey.key} name={apiKey.name} />
      </div>

      {/* Whose key this is. A badge rather than a `Detail` row: it is scope,
          not a value, and it wraps as a unit (§14.1). */}
      {apiKey.organization?.name && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
          <SoftBadge>{apiKey.organization.name}</SoftBadge>
        </div>
      )}

      {/* Body — 16px header-to-body gap (§9.2), aligned pairs. */}
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("apiKeys.columns.created")}
          value={formatDate(apiKey.createdAt)}
        />
      </dl>

      {/* Footer — the key id, and the same control the table row carries. */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{apiKey.id}
        </span>
        <ApiKeyActions
          apiKey={apiKey}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}

export function CardView({
  table,
  onRename,
  onDelete,
  emptyTitle,
  emptyHint,
}: {
  table: TanTable<Features, ApiKey>
  onRename: (apiKey: ApiKey) => void
  onDelete: (apiKey: ApiKey) => void
  /** The screen owns the wording — an empty list and a filtered-out one differ. */
  emptyTitle: string
  emptyHint?: string
}) {
  const keys = table.getRowModel().rows.map((row) => row.original)

  if (keys.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {keys.map((apiKey) => (
        <ApiKeyCard
          key={apiKey.id}
          apiKey={apiKey}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
