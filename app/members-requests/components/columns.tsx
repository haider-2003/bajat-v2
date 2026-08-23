"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  IdCard,
  MessageSquareText,
  Phone,
  User,
} from "lucide-react"

import {
  DateCell,
  HeadCell,
  IdCell,
  PhoneCell,
  TextCell,
} from "@/components/table/cells"
import { SoftBadge } from "@/components/ui/data-bits"
import { statusMeta } from "@/features/members-requests/status"
import type { MemberRequest } from "@/features/members-requests/types"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * Deliberately **not** shared. A column list maps one entity's fields to one
 * table's columns; the next screen's entity has different fields, so there is
 * nothing here another table could reuse. What every table does share is the
 * cell treatments, and those live in components/table/cells.tsx — this file is
 * a declaration of which fields appear, in what order, at what width.
 *
 * Every column maps to a field the API actually returns (docs/api-types.md
 * § members-requests). The prototype's template / branch / fee / progress /
 * reviewers columns are gone — no backing data exists for them.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export const columns: ColumnDef<Features, MemberRequest, unknown>[] = [
  {
    accessorKey: "id",
    header: () => <HeadCell icon={IdCard}>Request</HeadCell>,
    cell: ({ row }) => <IdCell value={row.original.id} />,
    size: 96,
    meta: { priority: 90, label: "Request" },
  },
  {
    accessorKey: "name",
    header: () => <HeadCell icon={User}>Applicant</HeadCell>,
    // The row's identity, so it carries the primary emphasis (§8.6).
    cell: ({ row }) => <TextCell value={row.original.name} emphasis="primary" />,
    size: 260,
    meta: { priority: 100, label: "Applicant" },
  },
  {
    accessorKey: "status",
    header: () => <HeadCell icon={CalendarDays}>Status</HeadCell>,
    // Flat soft badge for workflow status (§14.1).
    cell: ({ row }) => {
      const meta = statusMeta(row.original.status)
      return <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
    },
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
    size: 150,
    meta: { priority: 95, label: "Status" },
  },
  {
    accessorKey: "phone",
    header: () => <HeadCell icon={Phone}>Phone</HeadCell>,
    cell: ({ row }) => <PhoneCell value={row.original.phone} />,
    size: 180,
    meta: { priority: 65, label: "Phone" },
  },
  {
    id: "organization",
    accessorFn: (row) => row.organization?.name ?? "",
    header: () => <HeadCell icon={Building2}>Organization</HeadCell>,
    cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
    size: 200,
    meta: { priority: 60, label: "Organization" },
  },
  {
    accessorKey: "createdAt",
    header: () => <HeadCell icon={CalendarDays}>Submitted</HeadCell>,
    cell: ({ row }) => <DateCell value={row.original.createdAt} />,
    size: 190,
    meta: { priority: 70, label: "Submitted" },
  },
  {
    accessorKey: "joinDate",
    header: () => <HeadCell icon={CalendarDays}>Join date</HeadCell>,
    // Something the reviewer is expected to set, so an unset one is an
    // affordance rather than a dash (§8.6).
    cell: ({ row }) => (
      <DateCell
        value={row.original.joinDate}
        empty={{ icon: CalendarPlus, label: "Add date" }}
      />
    ),
    size: 190,
    meta: { priority: 50, label: "Join date" },
  },
  {
    accessorKey: "note",
    header: () => <HeadCell icon={MessageSquareText}>Note</HeadCell>,
    // Only rejections carry one, so most rows are empty by design.
    cell: ({ row }) => <TextCell value={row.original.note} emphasis="quiet" />,
    enableSorting: false,
    size: 200,
    meta: { priority: 30, label: "Note" },
  },
]
