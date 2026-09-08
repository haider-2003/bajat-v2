"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { CountChip } from "@/components/ui/data-bits"
import type { Role } from "@/features/roles/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { formatText } from "@/utils/format"

import { RoleActions } from "./role-columns"

/**
 * Card view — DESIGN.md §8.12 and §9. Also the responsive fallback below `lg`.
 */
function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: Role
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()

  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="truncate text-sm font-medium text-text">
          {formatText(role.name)}
        </h3>
        {role.permissions && (
          <CountChip>
            {t("roles.permissionCount", { count: role.permissions.length })}
          </CountChip>
        )}
      </div>

      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-xs text-text-muted">
            {t("roles.columns.created")}
          </dt>
          <dd className="truncate text-[13px] text-text-secondary">
            {formatDate(role.createdAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{role.id}
        </span>
        <RoleActions role={role} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </article>
  )
}

export function RoleCardView({
  table,
  onEdit,
  onDelete,
  emptyTitle,
  emptyHint,
}: {
  table: TanTable<Features, Role>
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
  emptyTitle: string
  emptyHint?: string
}) {
  const roles = table.getRowModel().rows.map((row) => row.original)

  if (roles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {roles.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
