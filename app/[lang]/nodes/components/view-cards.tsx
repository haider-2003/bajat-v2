"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import type { Node } from "@/features/nodes/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatText } from "@/utils/format"

import { NodeActions } from "./columns"
import { NodeRail } from "./node-swatch"

/**
 * Card view — DESIGN.md §8.12 and §9.
 *
 * Also the responsive fallback: below `lg` the table collapses to this rather
 * than squeezing every column.
 *
 * Structured as header → body → footer (§9.2–§9.4). A field with no value is
 * dropped rather than printed as a dash — a card only shows what it knows.
 *
 * ### The colour gets room here that it cannot have in a row
 *
 * In the table the swatch is a 12px dot beside the name. A card has space for
 * the tone to be the card's own header rail, which is what the node actually
 * looks like on the board — so the card is a preview of the thing rather than
 * a restatement of its fields.
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

function NodeCard({
  node,
  onEdit,
  onDelete,
}: {
  node: Node
  onEdit: (node: Node) => void
  onDelete: (node: Node) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()

  return (
    // §9.1: 12px radius, 1px border, no resting shadow. `overflow-hidden` so
    // the colour rail is clipped by the card's own curve.
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {/* The node's colour, full-bleed and theme-corrected — see
          `node-swatch.tsx`. Raw `#000000` here is a seam, not a colour. */}
      <NodeRail color={node.color} />

      <div className="flex flex-1 flex-col p-5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-text">
            {formatText(node.name)}
          </h3>
          <p
            dir="ltr"
            className="mt-1 truncate font-mono text-xs tracking-[0.02em] text-text-muted uppercase rtl:text-end"
          >
            {node.color}
          </p>
        </div>

        {/* Whose workflow this step belongs to. A badge rather than a `Detail`
            row: it is scope, not a value, and it wraps as a unit so a long
            organization name never splits mid-word (§14.1). */}
        {node.organization?.name && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
            <SoftBadge>{node.organization.name}</SoftBadge>
          </div>
        )}

        {/* Body — 16px header-to-body gap (§9.2), aligned pairs. */}
        <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
          <Detail
            label={t("nodes.columns.created")}
            value={formatDate(node.createdAt)}
          />
        </dl>

        {/* Footer — the node id, and the same control the table row carries. */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
            #{node.id}
          </span>
          <NodeActions node={node} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </article>
  )
}

export function CardView({
  table,
  onEdit,
  onDelete,
  emptyTitle,
  emptyHint,
}: {
  table: TanTable<Features, Node>
  onEdit: (node: Node) => void
  onDelete: (node: Node) => void
  /** The screen owns the wording — an empty list and a filtered-out one differ. */
  emptyTitle: string
  emptyHint?: string
}) {
  const nodes = table.getRowModel().rows.map((row) => row.original)

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {nodes.map((node) => (
        <NodeCard key={node.id} node={node} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}
