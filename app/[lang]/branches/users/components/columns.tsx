"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarDays,
  CircleDot,
  GitBranch,
  Hash,
  KeyRound,
  Network,
  Phone,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react"

import {
  DateCell,
  HeadCell,
  IdCell,
  PhoneCell,
  TextCell,
} from "@/components/table/cells"
import { RowActions } from "@/components/table/row-actions"
import { CountChip, SoftBadge } from "@/components/ui/data-bits"
import type { BranchUser } from "@/features/branch-users/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A branch user is an organization user pinned to one office
 * (features/branch-users/types.ts), so the columns are the same set plus a
 * Branch column. The organization column is admin-only and hidden otherwise.
 */
export function buildColumns(
  t: Translator,
  onEdit: (user: BranchUser) => void,
  onResetMfa: (user: BranchUser) => void,
  onDelete: (user: BranchUser) => void
): ColumnDef<Features, BranchUser, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <HeadCell icon={User}>{t("branchUsers.columns.name")}</HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.name} emphasis="primary" />,
      size: 200,
      meta: { priority: 110, label: t("branchUsers.columns.name") },
    },
    {
      accessorKey: "phone",
      header: () => (
        <HeadCell icon={Phone}>{t("branchUsers.columns.phone")}</HeadCell>
      ),
      cell: ({ row }) => <PhoneCell value={row.original.phone} />,
      size: 170,
      meta: { priority: 90, label: t("branchUsers.columns.phone") },
    },
    {
      id: "branch",
      accessorFn: (row) => row.branch?.name ?? "",
      header: () => (
        <HeadCell icon={GitBranch}>
          {t("branchUsers.columns.branch")}
        </HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.branch?.name} />,
      size: 180,
      meta: { priority: 75, label: t("branchUsers.columns.branch") },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>
          {t("branchUsers.columns.organization")}
        </HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 180,
      meta: { priority: 65, label: t("branchUsers.columns.organization") },
    },
    {
      id: "roles",
      accessorFn: (row) => row.roles?.[0]?.name ?? "",
      header: () => (
        <HeadCell icon={KeyRound}>{t("branchUsers.columns.roles")}</HeadCell>
      ),
      cell: ({ row }) => <ListCell items={row.original.roles?.map((r) => r.name)} />,
      size: 180,
      meta: { priority: 55, label: t("branchUsers.columns.roles") },
    },
    {
      id: "nodes",
      accessorFn: (row) => row.nodes?.[0]?.name ?? "",
      header: () => (
        <HeadCell icon={Network}>{t("branchUsers.columns.nodes")}</HeadCell>
      ),
      cell: ({ row }) => <ListCell items={row.original.nodes?.map((n) => n.name)} />,
      size: 170,
      meta: { priority: 45, label: t("branchUsers.columns.nodes") },
    },
    {
      id: "twoFactor",
      accessorFn: (row) => (row.tfaEnabled ? "on" : "off"),
      header: () => (
        <HeadCell icon={ShieldCheck}>
          {t("branchUsers.columns.twoFactor")}
        </HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.tfaEnabled ? "success" : "neutral"}>
          {row.original.tfaEnabled
            ? t("branchUsers.tfaEnrolled")
            : t("branchUsers.tfaNotEnrolled")}
        </SoftBadge>
      ),
      size: 130,
      meta: { priority: 35, label: t("branchUsers.columns.twoFactor") },
    },
    {
      id: "status",
      accessorFn: (row) => (row.isEnabled ? "enabled" : "disabled"),
      header: () => (
        <HeadCell icon={CircleDot}>{t("branchUsers.columns.status")}</HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.isEnabled ? "success" : "danger"}>
          {row.original.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
      ),
      size: 120,
      meta: { priority: 80, label: t("branchUsers.columns.status") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>
          {t("branchUsers.columns.created")}
        </HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 170,
      meta: { priority: 30, label: t("branchUsers.columns.created") },
    },
    {
      accessorKey: "id",
      header: () => (
        <HeadCell icon={Hash}>{t("branchUsers.columns.userId")}</HeadCell>
      ),
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 96,
      meta: { priority: 20, label: t("branchUsers.columns.userId") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <UserActions
            user={row.original}
            onEdit={onEdit}
            onResetMfa={onResetMfa}
            onDelete={onDelete}
          />
        </div>
      ),
      size: 130,
      enableSorting: false,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}

export function ListCell({ items }: { items?: string[] }) {
  const list = items ?? []
  if (list.length === 0) return <TextCell value={null} />
  const [first, ...rest] = list
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <TextCell value={first} />
      {rest.length > 0 && <CountChip>+{rest.length}</CountChip>}
    </div>
  )
}

export function UserActions({
  user,
  onEdit,
  onResetMfa,
  onDelete,
  className,
}: {
  user: BranchUser
  onEdit: (user: BranchUser) => void
  onResetMfa: (user: BranchUser) => void
  onDelete: (user: BranchUser) => void
  className?: string
}) {
  const t = useT()

  return (
    <RowActions
      label={user.name}
      onEdit={() => onEdit(user)}
      items={[
        {
          key: "reset-mfa",
          label: t("branchUsers.resetMfa"),
          icon: ShieldCheck,
          onSelect: () => onResetMfa(user),
        },
        {
          key: "delete",
          label: t("common.delete"),
          icon: Trash2,
          destructive: true,
          onSelect: () => onDelete(user),
        },
      ]}
      className={className}
    />
  )
}
