"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Building2, CalendarDays, Hash, Phone, User } from "lucide-react"

import {
  DateCell,
  HeadCell,
  IdCell,
  PhoneCell,
  TextCell,
} from "@/components/table/cells"
import type { BlackList } from "@/features/black-list/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { RemoveEntryButton } from "./entry-actions"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant, because the actions cell needs a callback
 * the screen owns: which entry is being removed is the screen's state, not the
 * row's. Memoize the result — a fresh array every render remounts every cell.
 *
 * Deliberately **not** shared with the other screens, for the reason spelled
 * out in components/table/cells.tsx: a column list maps one entity's fields to
 * one table's columns. What is shared is the cell treatments.
 *
 * ### The phone is the row, and it is not the second column
 *
 * On every other list the name identifies the row and takes the primary
 * emphasis. Here it does not: `name` is a label somebody typed, and the *phone*
 * is what the backend blocks on (docs/api-types.md § black-list). Two entries
 * reading "Ahmed Ali" are two different blocks, and the only cell that says
 * which is which is the number — so the number leads and carries the emphasis,
 * with the name beside it as the human-readable half.
 *
 * There is no status column: an entry that exists is a block in force. Removing
 * it is the only state change, and it takes the row with it.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(
  t: Translator,
  onRemove: (entry: BlackList) => void
): ColumnDef<Features, BlackList, unknown>[] {
  return [
    {
      accessorKey: "phone",
      header: () => (
        <HeadCell icon={Phone}>{t("blackList.columns.number")}</HeadCell>
      ),
      // What the block actually keys on, so it leads and never drops (§8.6).
      // Mono and tabular, so a column of near-identical numbers can be scanned
      // digit by digit rather than read.
      cell: ({ row }) => <PhoneCell value={row.original.phone} />,
      size: 200,
      meta: { priority: 110, label: t("blackList.columns.number") },
    },
    {
      accessorKey: "name",
      header: () => <HeadCell icon={User}>{t("members.columns.name")}</HeadCell>,
      cell: ({ row }) => (
        <TextCell value={row.original.name} emphasis="primary" />
      ),
      size: 240,
      meta: { priority: 100, label: t("members.columns.name") },
    },
    {
      id: "organization",
      // Sorting and the accessor need one string; the cell renders the rest.
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>{t("filters.attributes.organization")}</HeadCell>
      ),
      // Whose list this entry is on. A block is one tenant's, so the same
      // number can appear twice on this table under two organizations and
      // those are two separate blocks, not a duplicate.
      //
      // `organization` is documented as required. It is still read
      // defensively — a missing object here is a `.name` on undefined, which
      // takes the whole table down rather than dropping one cell.
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 220,
      meta: { priority: 70, label: t("filters.attributes.organization") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("blackList.columns.blockedOn")}</HeadCell>
      ),
      // No `empty` affordance: an entry always has a creation date, and there
      // is nothing here for a reviewer to fill in.
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 60, label: t("blackList.columns.blockedOn") },
    },
    {
      accessorKey: "id",
      header: () => <HeadCell icon={Hash}>{t("blackList.columns.entry")}</HeadCell>,
      // Last, and the first to drop: nothing on this screen is looked up by
      // entry id — it is here so a row can be quoted in a support thread.
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 88,
      meta: { priority: 30, label: t("blackList.columns.entry") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RemoveEntryButton entry={row.original} onRemove={onRemove} />
        </div>
      ),
      size: 110,
      enableSorting: false,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}
