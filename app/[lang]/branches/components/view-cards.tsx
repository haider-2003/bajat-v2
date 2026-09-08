"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import { branchNodeIds, type Branch } from "@/features/branches/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatText } from "@/utils/format"

import { BranchActions } from "./columns"

/**
 * Card view — DESIGN.md §8.12 and §9. Also the responsive fallback below `lg`.
 */
function Detail({ label, value }: { label: string; value: string }) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd className="truncate text-[13px] text-text-secondary">{value}</dd>
    </div>
  )
}

function BranchCard({
  branch,
  onEdit,
  onDelete,
}: {
  branch: Branch
  onEdit: (branch: Branch) => void
  onDelete: (branch: Branch) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()

  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="truncate text-sm font-medium text-text">
          {formatText(branch.name)}
        </h3>
        <SoftBadge tone={branch.isEnabled ? "success" : "danger"}>
          {branch.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
      </div>

      {branch.organization?.name && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
          <SoftBadge>{branch.organization.name}</SoftBadge>
        </div>
      )}

      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("branches.columns.parent")}
          value={branch.parent?.name ?? t("branches.topLevel")}
        />
        <Detail
          label={t("branches.columns.nodes")}
          value={t("branches.nodeCount", { count: branchNodeIds(branch).length })}
        />
        <Detail
          label={t("branches.columns.created")}
          value={formatDate(branch.createdAt)}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{branch.id}
        </span>
        <BranchActions branch={branch} onEdit={onEdit} onDelete={onDelete} />
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
  table: TanTable<Features, Branch>
  onEdit: (branch: Branch) => void
  onDelete: (branch: Branch) => void
  emptyTitle: string
  emptyHint?: string
}) {
  const branches = table.getRowModel().rows.map((row) => row.original)

  if (branches.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {branches.map((branch) => (
        <BranchCard
          key={branch.id}
          branch={branch}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
