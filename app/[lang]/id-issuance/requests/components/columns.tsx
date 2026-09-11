"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  IdCard,
  LayoutTemplate,
  Phone,
  Tag,
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
import { identityName, identityPhone } from "@/features/ids/fields"
import { statusMeta } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { RequestActions, type RequestActionHandlers } from "./request-actions"

/**
 * Column definitions for the Requests ledger — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant, so the header strings are translated at
 * call time. Memoize the result — a fresh array every render remounts every
 * cell.
 *
 * ### The ledger leads with status
 *
 * The printer's columns lead with the QR code because a queue is cleared by
 * scanning down its left edge. This is not a queue, it is the record of every
 * card ever issued, and the question asked of it is "where is this one" — so
 * after the id and the name, the status is the column that answers it, and
 * the artwork is not here at all (it is one click away on the row).
 *
 * The cardholder's name is *derived*, not read: list rows have no top-level
 * `name` (features/ids/fields.ts).
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(
  t: Translator,
  handlers: RequestActionHandlers
): ColumnDef<Features, IDCard, unknown>[] {
  return [
    {
      accessorKey: "id",
      header: () => <HeadCell icon={IdCard}>{t("ids.columns.card")}</HeadCell>,
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 88,
      meta: { priority: 90, label: t("ids.columns.card") },
    },
    {
      id: "cardholder",
      accessorFn: (row) => identityName(row) ?? "",
      header: () => <HeadCell icon={User}>{t("ids.columns.cardholder")}</HeadCell>,
      // The row's identity, so it carries the primary emphasis (§8.6).
      cell: ({ row }) => (
        <TextCell value={identityName(row.original)} emphasis="primary" />
      ),
      size: 220,
      meta: { priority: 100, label: t("ids.columns.cardholder") },
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: () => <HeadCell icon={Tag}>{t("common.status")}</HeadCell>,
      // Flat soft badge for workflow status (§14.1).
      cell: ({ row }) => {
        const meta = statusMeta(t, row.original.status)
        return <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
      },
      size: 160,
      meta: { priority: 95, label: t("common.status") },
    },
    {
      id: "phone",
      accessorFn: (row) => identityPhone(row) ?? "",
      header: () => <HeadCell icon={Phone}>{t("members.columns.phone")}</HeadCell>,
      cell: ({ row }) => <PhoneCell value={identityPhone(row.original)} />,
      size: 170,
      meta: { priority: 60, label: t("members.columns.phone") },
    },
    {
      id: "template",
      accessorFn: (row) => row.template?.title ?? "",
      header: () => (
        <HeadCell icon={LayoutTemplate}>{t("templates.singular")}</HeadCell>
      ),
      cell: ({ row }) => (
        <TextCell value={row.original.template?.title} emphasis="quiet" />
      ),
      size: 200,
      meta: { priority: 70, label: t("templates.singular") },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>{t("filters.attributes.organization")}</HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 200,
      meta: { priority: 50, label: t("filters.attributes.organization") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarPlus}>{t("ids.columns.issued")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 40, label: t("ids.columns.issued") },
    },
    {
      accessorKey: "updatedAt",
      header: () => (
        <HeadCell icon={CalendarClock}>{t("filters.attributes.updated")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.updatedAt} />,
      size: 190,
      meta: { priority: 30, label: t("filters.attributes.updated") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RequestActions card={row.original} handlers={handlers} />
        </div>
      ),
      size: 120,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}
