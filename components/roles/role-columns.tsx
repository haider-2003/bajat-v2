"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { CalendarDays, Hash, KeyRound, ShieldCheck, Trash2 } from "lucide-react"

import { DateCell, HeadCell, IdCell, TextCell } from "@/components/table/cells"
import { RowActions } from "@/components/table/row-actions"
import { CountChip } from "@/components/ui/data-bits"
import type { Role } from "@/features/roles/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions for the role list — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant: the action cell needs callbacks the screen
 * owns, and the headers are translated. Memoize the result — a fresh array
 * every render remounts every cell.
 *
 * ### No permission count column
 *
 * `GET /role` returns rows without their `permissions[]` (features/roles/types.ts)
 * — the editor re-reads `GET /role/{id}` for that. A count column would show a
 * dash on every row until each was opened, so the tree lives in the editor and
 * the list stays to name, date and id.
 */
export function buildRoleColumns(
  t: Translator,
  onEdit: (role: Role) => void,
  onDelete: (role: Role) => void
): ColumnDef<Features, Role, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <HeadCell icon={ShieldCheck}>{t("roles.columns.name")}</HeadCell>
      ),
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <TextCell value={row.original.name} emphasis="primary" />
          {row.original.permissions && (
            <CountChip>
              {t("roles.permissionCount", {
                count: row.original.permissions.length,
              })}
            </CountChip>
          )}
        </span>
      ),
      size: 320,
      meta: { priority: 110, label: t("roles.columns.name") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("roles.columns.created")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 200,
      meta: { priority: 60, label: t("roles.columns.created") },
    },
    {
      accessorKey: "id",
      header: () => <HeadCell icon={Hash}>{t("roles.columns.roleId")}</HeadCell>,
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 96,
      meta: { priority: 30, label: t("roles.columns.roleId") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RoleActions role={row.original} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ),
      size: 130,
      enableSorting: false,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}

/**
 * The row's verbs — Edit on the surface, Delete behind the overflow (§15.5).
 *
 * Exported so the card view renders the identical control rather than a second
 * set that could drift.
 */
export function RoleActions({
  role,
  onEdit,
  onDelete,
  className,
}: {
  role: Role
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
  className?: string
}) {
  const t = useT()

  return (
    <RowActions
      label={role.name}
      onEdit={() => onEdit(role)}
      items={[
        {
          key: "delete",
          label: t("common.delete"),
          icon: Trash2,
          destructive: true,
          onSelect: () => onDelete(role),
        },
      ]}
      className={className}
    />
  )
}

/** The glyph the list is titled with — kept here so the page and cards agree. */
export const roleIcon = KeyRound
