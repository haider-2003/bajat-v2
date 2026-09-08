"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  CalendarDays,
  CircleDot,
  Hash,
  KeyRound,
  Phone,
  ShieldCheck,
  Trash2,
  User as UserIcon,
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
import type { User } from "@/features/users/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * No organization column: a platform admin is not scoped to one
 * (features/users/api.ts). No nodes column either — an admin's reach is the
 * whole platform, not a subset of one org's workflow.
 */
export function buildColumns(
  t: Translator,
  onEdit: (user: User) => void,
  onResetMfa: (user: User) => void,
  onDelete: (user: User) => void
): ColumnDef<Features, User, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <HeadCell icon={UserIcon}>{t("admins.columns.name")}</HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.name} emphasis="primary" />,
      size: 240,
      meta: { priority: 110, label: t("admins.columns.name") },
    },
    {
      accessorKey: "phone",
      header: () => <HeadCell icon={Phone}>{t("admins.columns.phone")}</HeadCell>,
      cell: ({ row }) => <PhoneCell value={row.original.phone} />,
      size: 190,
      meta: { priority: 90, label: t("admins.columns.phone") },
    },
    {
      id: "roles",
      accessorFn: (row) => row.roles?.[0]?.name ?? "",
      header: () => (
        <HeadCell icon={KeyRound}>{t("admins.columns.roles")}</HeadCell>
      ),
      cell: ({ row }) => {
        const roles = row.original.roles ?? []
        if (roles.length === 0) return <TextCell value={null} />
        const [first, ...rest] = roles
        return (
          <div className="flex min-w-0 items-center gap-1.5">
            <TextCell value={first.name} />
            {rest.length > 0 && <CountChip>+{rest.length}</CountChip>}
          </div>
        )
      },
      size: 220,
      meta: { priority: 60, label: t("admins.columns.roles") },
    },
    {
      id: "twoFactor",
      accessorFn: (row) => (row.tfaEnabled ? "on" : "off"),
      header: () => (
        <HeadCell icon={ShieldCheck}>{t("admins.columns.twoFactor")}</HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.tfaEnabled ? "success" : "neutral"}>
          {row.original.tfaEnabled
            ? t("admins.tfaEnrolled")
            : t("admins.tfaNotEnrolled")}
        </SoftBadge>
      ),
      size: 130,
      meta: { priority: 40, label: t("admins.columns.twoFactor") },
    },
    {
      id: "status",
      accessorFn: (row) => (row.isEnabled ? "enabled" : "disabled"),
      header: () => (
        <HeadCell icon={CircleDot}>{t("admins.columns.status")}</HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.isEnabled ? "success" : "danger"}>
          {row.original.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
      ),
      size: 120,
      meta: { priority: 80, label: t("admins.columns.status") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("admins.columns.created")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 180,
      meta: { priority: 30, label: t("admins.columns.created") },
    },
    {
      accessorKey: "id",
      header: () => <HeadCell icon={Hash}>{t("admins.columns.userId")}</HeadCell>,
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 96,
      meta: { priority: 20, label: t("admins.columns.userId") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <AdminActions
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

export function AdminActions({
  user,
  onEdit,
  onResetMfa,
  onDelete,
  className,
}: {
  user: User
  onEdit: (user: User) => void
  onResetMfa: (user: User) => void
  onDelete: (user: User) => void
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
          label: t("admins.resetMfa"),
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
