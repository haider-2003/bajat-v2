"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarDays,
  Hash,
  Palette,
  Trash2,
  Workflow,
} from "lucide-react"

import { DateCell, HeadCell, IdCell, TextCell } from "@/components/table/cells"
import { RowActions } from "@/components/table/row-actions"
import type { Node } from "@/features/nodes/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { NodeChip } from "@/components/nodes/node-swatch"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant, because the action cell needs callbacks
 * the screen owns: which node is being edited or deleted is the screen's
 * state, not the row's. Memoize the result — a fresh array every render
 * remounts every cell.
 *
 * ### The colour *is* the name, and also has its own column
 *
 * The name is drawn as a tinted chip in the node's own colour, because that is
 * how the node is recognised everywhere else in the app — on the board, in the
 * branch picker. A plain name here would be a different-looking thing to the
 * same node one screen over. See `node-swatch.tsx` for why the colour is
 * corrected against the theme rather than painted as typed.
 *
 * The separate Colour column is not a duplicate of it: it carries the *hex*,
 * which is what someone checks when two nodes look alike on the board and they
 * need to know whether that is two shades or one. It is also the first column
 * worth dropping, and its priority says so.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(
  t: Translator,
  onEdit: (node: Node) => void,
  onDelete: (node: Node) => void
): ColumnDef<Features, Node, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => <HeadCell icon={Workflow}>{t("nodes.columns.name")}</HeadCell>,
      // What identifies the row, so it leads and never drops (§8.6).
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center">
          <NodeChip color={row.original.color} name={row.original.name} />
        </span>
      ),
      size: 280,
      meta: { priority: 110, label: t("nodes.columns.name") },
    },
    {
      accessorKey: "color",
      header: () => <HeadCell icon={Palette}>{t("nodes.columns.color")}</HeadCell>,
      // Mono and uppercase: a hex is compared character by character, not read.
      cell: ({ row }) => (
        <span
          dir="ltr"
          className="font-mono text-[13px] tracking-[0.02em] text-text-secondary uppercase rtl:text-end"
        >
          {row.original.color}
        </span>
      ),
      size: 130,
      meta: { priority: 40, label: t("nodes.columns.color") },
    },
    {
      id: "organization",
      // Sorting and the accessor need one string; the cell renders the rest.
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>{t("filters.attributes.organization")}</HeadCell>
      ),
      // Only ever populated for a platform admin — an org-scoped token sees one
      // organization, so the column would repeat the same name down the page.
      // The screen hides it in that case rather than the cell rendering dashes.
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 220,
      meta: { priority: 70, label: t("filters.attributes.organization") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("nodes.columns.created")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 60, label: t("nodes.columns.created") },
    },
    {
      accessorKey: "id",
      header: () => <HeadCell icon={Hash}>{t("nodes.columns.node")}</HeadCell>,
      // Last, and the first to drop: nothing on this screen is looked up by
      // node id — it is here so a row can be quoted in a support thread.
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 88,
      meta: { priority: 30, label: t("nodes.columns.node") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <NodeActions node={row.original} onEdit={onEdit} onDelete={onDelete} />
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
 * set that could drift from this one. It is a component rather than a call
 * inside the cell renderer because it reads the translator from context, and
 * a cell renderer is not a component — hooks called there run on whichever
 * render happens to reach them.
 */
export function NodeActions({
  node,
  onEdit,
  onDelete,
  className,
}: {
  node: Node
  onEdit: (node: Node) => void
  onDelete: (node: Node) => void
  className?: string
}) {
  const t = useT()

  return (
    <RowActions
      label={node.name}
      onEdit={() => onEdit(node)}
      items={[
        {
          key: "delete",
          label: t("common.delete"),
          icon: Trash2,
          destructive: true,
          onSelect: () => onDelete(node),
        },
      ]}
      className={className}
    />
  )
}
