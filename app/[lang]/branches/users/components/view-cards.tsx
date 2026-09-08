"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import type { BranchUser } from "@/features/branch-users/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatPhone, formatText } from "@/utils/format"

import { UserActions } from "./columns"

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

function UserCard({
  user,
  onEdit,
  onResetMfa,
  onDelete,
}: {
  user: BranchUser
  onEdit: (user: BranchUser) => void
  onResetMfa: (user: BranchUser) => void
  onDelete: (user: BranchUser) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const roles = user.roles ?? []
  const nodes = user.nodes ?? []

  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-text">
            {formatText(user.name)}
          </h3>
          <p
            dir="ltr"
            className="mt-1 truncate font-mono text-xs tabular-nums text-text-muted rtl:text-end"
          >
            {formatPhone(user.phone)}
          </p>
        </div>
        <SoftBadge tone={user.isEnabled ? "success" : "danger"}>
          {user.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
      </div>

      {roles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
          {roles.slice(0, 3).map((role) => (
            <SoftBadge key={role.id} tone="accent">
              {role.name}
            </SoftBadge>
          ))}
          {roles.length > 3 && <SoftBadge>+{roles.length - 3}</SoftBadge>}
        </div>
      )}

      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("branchUsers.columns.branch")}
          value={formatText(user.branch?.name)}
        />
        {user.organization?.name && (
          <Detail
            label={t("branchUsers.columns.organization")}
            value={user.organization.name}
          />
        )}
        <Detail
          label={t("branchUsers.columns.nodes")}
          value={
            nodes.length > 0
              ? nodes.map((node) => node.name).join(t("common.listSeparator"))
              : EMPTY_VALUE
          }
        />
        <Detail
          label={t("branchUsers.columns.twoFactor")}
          value={
            user.tfaEnabled
              ? t("branchUsers.tfaEnrolled")
              : t("branchUsers.tfaNotEnrolled")
          }
        />
        <Detail
          label={t("branchUsers.columns.created")}
          value={formatDate(user.createdAt)}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{user.id}
        </span>
        <UserActions
          user={user}
          onEdit={onEdit}
          onResetMfa={onResetMfa}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}

export function CardView({
  table,
  onEdit,
  onResetMfa,
  onDelete,
  emptyTitle,
  emptyHint,
}: {
  table: TanTable<Features, BranchUser>
  onEdit: (user: BranchUser) => void
  onResetMfa: (user: BranchUser) => void
  onDelete: (user: BranchUser) => void
  emptyTitle: string
  emptyHint?: string
}) {
  const users = table.getRowModel().rows.map((row) => row.original)

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          onEdit={onEdit}
          onResetMfa={onResetMfa}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
