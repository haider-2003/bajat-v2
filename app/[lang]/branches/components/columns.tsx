"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarDays,
  CircleDot,
  GitBranch,
  Hash,
  Network,
  Trash2,
} from "lucide-react"

import { DateCell, HeadCell, IdCell, TextCell } from "@/components/table/cells"
import { RowActions } from "@/components/table/row-actions"
import { CountChip, SoftBadge } from "@/components/ui/data-bits"
import { branchNodeIds, type Branch } from "@/features/branches/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * ### Every relation arrives twice
 *
 * A branch row carries both the scalar id and, sometimes, the expanded object
 * (features/branches/types.ts). The cells read through the helpers so a row that
 * sent only one half still renders.
 */
export function buildColumns(
  t: Translator,
  onEdit: (branch: Branch) => void,
  onDelete: (branch: Branch) => void
): ColumnDef<Features, Branch, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <HeadCell icon={GitBranch}>{t("branches.columns.name")}</HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.name} emphasis="primary" />,
      size: 240,
      meta: { priority: 110, label: t("branches.columns.name") },
    },
    {
      id: "parent",
      accessorFn: (row) => row.parent?.name ?? "",
      header: () => (
        <HeadCell icon={GitBranch}>{t("branches.columns.parent")}</HeadCell>
      ),
      cell: ({ row }) =>
        row.original.parent?.name ? (
          <TextCell value={row.original.parent.name} />
        ) : (
          <span className="text-[13px] text-text-placeholder">
            {t("branches.topLevel")}
          </span>
        ),
      size: 200,
      meta: { priority: 60, label: t("branches.columns.parent") },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>
          {t("filters.attributes.organization")}
        </HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 200,
      meta: { priority: 70, label: t("filters.attributes.organization") },
    },
    {
      id: "nodes",
      accessorFn: (row) => branchNodeIds(row).length,
      header: () => (
        <HeadCell icon={Network}>{t("branches.columns.nodes")}</HeadCell>
      ),
      cell: ({ row }) => {
        const count = branchNodeIds(row.original).length
        return (
          <CountChip>{t("branches.nodeCount", { count })}</CountChip>
        )
      },
      size: 120,
      meta: { priority: 50, label: t("branches.columns.nodes") },
    },
    {
      id: "status",
      accessorFn: (row) => (row.isEnabled ? "enabled" : "disabled"),
      header: () => (
        <HeadCell icon={CircleDot}>{t("branches.columns.status")}</HeadCell>
      ),
      cell: ({ row }) => (
        <SoftBadge tone={row.original.isEnabled ? "success" : "danger"}>
          {row.original.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
      ),
      size: 120,
      meta: { priority: 80, label: t("branches.columns.status") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("branches.columns.created")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 180,
      meta: { priority: 40, label: t("branches.columns.created") },
    },
    {
      accessorKey: "id",
      header: () => (
        <HeadCell icon={Hash}>{t("branches.columns.branchId")}</HeadCell>
      ),
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 96,
      meta: { priority: 30, label: t("branches.columns.branchId") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <BranchActions
            branch={row.original}
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

export function BranchActions({
  branch,
  onEdit,
  onDelete,
  className,
}: {
  branch: Branch
  onEdit: (branch: Branch) => void
  onDelete: (branch: Branch) => void
  className?: string
}) {
  const t = useT()

  return (
    <RowActions
      label={branch.name}
      onEdit={() => onEdit(branch)}
      items={[
        {
          key: "delete",
          label: t("common.delete"),
          icon: Trash2,
          destructive: true,
          onSelect: () => onDelete(branch),
        },
      ]}
      className={className}
    />
  )
}
