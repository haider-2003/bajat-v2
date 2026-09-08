"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarDays,
  CircleDot,
  Globe,
  Hash,
  Trash2,
  UserPlus,
} from "lucide-react"

import { DateCell, HeadCell, IdCell, TextCell } from "@/components/table/cells"
import { RowActions } from "@/components/table/row-actions"
import { SoftBadge } from "@/components/ui/data-bits"
import type { Organization } from "@/features/organizations/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant: the action cell needs callbacks the screen
 * owns, and the headers are translated. Memoize the result.
 *
 * ### Two switches, two columns
 *
 * `isEnabled` turns the whole tenant off — close to a delete. `isJoinRequestsEnabled`
 * turns off only the public join form (features/organizations/types.ts). They
 * read alike and do not mean alike, so they get separate columns rather than one
 * "Status" that folds two answers into one.
 */
export function buildColumns(
  t: Translator,
  onEdit: (organization: Organization) => void,
  onDelete: (organization: Organization) => void
): ColumnDef<Features, Organization, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <HeadCell icon={Building2}>{t("organizations.columns.name")}</HeadCell>
      ),
      cell: ({ row }) => (
        <TextCell value={row.original.name} emphasis="primary" />
      ),
      size: 280,
      meta: { priority: 110, label: t("organizations.columns.name") },
    },
    {
      accessorKey: "website",
      header: () => (
        <HeadCell icon={Globe}>{t("organizations.columns.website")}</HeadCell>
      ),
      cell: ({ row }) => {
        const website = row.original.website?.trim()
        if (!website) return <TextCell value={null} />
        return (
          <a
            href={website}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="block truncate text-sm text-accent-violet underline-offset-4 hover:underline rtl:text-end"
          >
            {website.replace(/^https?:\/\//, "")}
          </a>
        )
      },
      size: 220,
      meta: { priority: 50, label: t("organizations.columns.website") },
    },
    {
      id: "joinRequests",
      accessorFn: (row) => (row.isJoinRequestsEnabled ? "open" : "closed"),
      header: () => (
        <HeadCell icon={UserPlus}>
          {t("organizations.columns.joinRequests")}
        </HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.isJoinRequestsEnabled ? "success" : "neutral"}>
          {row.original.isJoinRequestsEnabled
            ? t("organizations.joinOpen")
            : t("organizations.joinClosed")}
        </SoftBadge>
      ),
      size: 130,
      meta: { priority: 60, label: t("organizations.columns.joinRequests") },
    },
    {
      id: "status",
      accessorFn: (row) => (row.isEnabled ? "enabled" : "disabled"),
      header: () => (
        <HeadCell icon={CircleDot}>{t("organizations.columns.status")}</HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.isEnabled ? "success" : "danger"}>
          {row.original.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
      ),
      size: 120,
      meta: { priority: 80, label: t("organizations.columns.status") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>
          {t("organizations.columns.created")}
        </HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 40, label: t("organizations.columns.created") },
    },
    {
      accessorKey: "id",
      header: () => (
        <HeadCell icon={Hash}>{t("organizations.columns.orgId")}</HeadCell>
      ),
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 96,
      meta: { priority: 30, label: t("organizations.columns.orgId") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <OrganizationActions
            organization={row.original}
            onEdit={onEdit}
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

export function OrganizationActions({
  organization,
  onEdit,
  onDelete,
  className,
}: {
  organization: Organization
  onEdit: (organization: Organization) => void
  onDelete: (organization: Organization) => void
  className?: string
}) {
  const t = useT()

  return (
    <RowActions
      label={organization.name}
      onEdit={() => onEdit(organization)}
      items={[
        {
          key: "delete",
          label: t("common.delete"),
          icon: Trash2,
          destructive: true,
          onSelect: () => onDelete(organization),
        },
      ]}
      className={className}
    />
  )
}
