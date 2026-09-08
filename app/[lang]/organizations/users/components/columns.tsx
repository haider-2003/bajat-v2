"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarDays,
  CircleDot,
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
import type { OrganizationUser } from "@/features/organization-users/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * Roles and nodes are the two grants that make the account able to do anything
 * (features/organization-users/types.ts). The cells name the first and count the
 * rest so a row on eight roles does not push the dates off screen — the full set
 * is on the card and in the editor.
 */
export function buildColumns(
  t: Translator,
  onEdit: (user: OrganizationUser) => void,
  onResetMfa: (user: OrganizationUser) => void,
  onDelete: (user: OrganizationUser) => void
): ColumnDef<Features, OrganizationUser, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <HeadCell icon={User}>{t("organizationUsers.columns.name")}</HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.name} emphasis="primary" />,
      size: 220,
      meta: { priority: 110, label: t("organizationUsers.columns.name") },
    },
    {
      accessorKey: "phone",
      header: () => (
        <HeadCell icon={Phone}>{t("organizationUsers.columns.phone")}</HeadCell>
      ),
      cell: ({ row }) => <PhoneCell value={row.original.phone} />,
      size: 180,
      meta: { priority: 90, label: t("organizationUsers.columns.phone") },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>
          {t("organizationUsers.columns.organization")}
        </HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 200,
      meta: {
        priority: 70,
        label: t("organizationUsers.columns.organization"),
      },
    },
    {
      id: "roles",
      accessorFn: (row) => row.roles?.[0]?.name ?? "",
      header: () => (
        <HeadCell icon={KeyRound}>
          {t("organizationUsers.columns.roles")}
        </HeadCell>
      ),
      cell: ({ row }) => <ListCell items={row.original.roles?.map((r) => r.name)} />,
      size: 200,
      meta: { priority: 60, label: t("organizationUsers.columns.roles") },
    },
    {
      id: "nodes",
      accessorFn: (row) => row.nodes?.[0]?.name ?? "",
      header: () => (
        <HeadCell icon={Network}>
          {t("organizationUsers.columns.nodes")}
        </HeadCell>
      ),
      cell: ({ row }) => <ListCell items={row.original.nodes?.map((n) => n.name)} />,
      size: 190,
      meta: { priority: 50, label: t("organizationUsers.columns.nodes") },
    },
    {
      id: "twoFactor",
      accessorFn: (row) => (row.tfaEnabled ? "on" : "off"),
      header: () => (
        <HeadCell icon={ShieldCheck}>
          {t("organizationUsers.columns.twoFactor")}
        </HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.tfaEnabled ? "success" : "neutral"}>
          {row.original.tfaEnabled
            ? t("organizationUsers.tfaEnrolled")
            : t("organizationUsers.tfaNotEnrolled")}
        </SoftBadge>
      ),
      size: 130,
      meta: { priority: 40, label: t("organizationUsers.columns.twoFactor") },
    },
    {
      id: "status",
      accessorFn: (row) => (row.isEnabled ? "enabled" : "disabled"),
      header: () => (
        <HeadCell icon={CircleDot}>
          {t("organizationUsers.columns.status")}
        </HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.isEnabled ? "success" : "danger"}>
          {row.original.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
      ),
      size: 120,
      meta: { priority: 80, label: t("organizationUsers.columns.status") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>
          {t("organizationUsers.columns.created")}
        </HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 170,
      meta: { priority: 30, label: t("organizationUsers.columns.created") },
    },
    {
      accessorKey: "id",
      header: () => (
        <HeadCell icon={Hash}>{t("organizationUsers.columns.userId")}</HeadCell>
      ),
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 96,
      meta: { priority: 20, label: t("organizationUsers.columns.userId") },
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

/** The first item by name, plus a count chip for the rest. */
export function ListCell({ items }: { items?: string[] }) {
  const list = items ?? []
  if (list.length === 0) {
    return <TextCell value={null} />
  }
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
  user: OrganizationUser
  onEdit: (user: OrganizationUser) => void
  onResetMfa: (user: OrganizationUser) => void
  onDelete: (user: OrganizationUser) => void
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
          label: t("organizationUsers.resetMfa"),
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
