"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  IdCard,
  LayoutTemplate,
  Phone,
  Printer,
  QrCode,
  User,
} from "lucide-react"

import {
  DateCell,
  HeadCell,
  IdCell,
  PhoneCell,
  TextCell,
} from "@/components/table/cells"
import { QrCell } from "@/components/table/qr-cell"
import { SoftBadge } from "@/components/ui/data-bits"
import { identityName, identityPhone } from "@/features/ids/fields"
import { statusMeta } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { PrintActions } from "./print-actions"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant, so the header strings are translated at
 * call time. Memoize the result — a fresh array every render remounts every
 * cell.
 *
 * Nothing here takes a preview callback any more: opening a card is what
 * clicking its row does (`components/table/table-view.tsx`), which is the
 * screen's state to hold, not a prop threaded through a column list.
 *
 * Every column maps to something a live `/identity` row actually carries
 * (docs/api-types.md § ids). The cardholder's name is *derived*, not read: list
 * rows have no top-level `name`, and a column that read `card.name` would print
 * a column of dashes over rows that plainly have names on them. See
 * features/ids/fields.ts.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(
  t: Translator
): ColumnDef<Features, IDCard, unknown>[] {
  return [
    {
      id: "qr",
      accessorFn: (row) => row.uniqueKey ?? "",
      header: () => <HeadCell icon={QrCode}>QR Code</HeadCell>,
      // First, because it is the column the operator works from: the queue is
      // cleared by scanning down the left edge, not by reading it.
      //
      // Drawn in the browser from `uniqueKey` — the API has no QR endpoint and
      // sends no QR image. See components/table/qr-cell.tsx for the encoding
      // rules, which existing printed cards depend on.
      //
      // `my-2` is this column's alone: the shared `TableCell` is `py-0`, which
      // is right for a line of text but leaves a 60px code flush against the
      // one above it with only the hairline between them. Margin rather than
      // padding so the focus ring still hugs the code.
      cell: ({ row }) => (
        <QrCell value={row.original.uniqueKey} size={60} className="my-2" />
      ),
      size: 80,
      // A code is not text, so there is nothing useful to sort or filter on.
      enableSorting: false,
      // The one column that must not drop: without it this is a list, not a
      // print queue.
      meta: { priority: 110, label: t("printer.columns.qrCode") },
    },
    {
      accessorKey: "id",
      header: () => <HeadCell icon={IdCard}>{t("printer.columns.card")}</HeadCell>,
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 88,
      meta: { priority: 90, label: t("printer.columns.card") },
    },
    {
      id: "cardholder",
      accessorFn: (row) => identityName(row) ?? "",
      header: () => (
        <HeadCell icon={User}>{t("printer.columns.cardholder")}</HeadCell>
      ),
      // The row's identity, so it carries the primary emphasis (§8.6).
      cell: ({ row }) => (
        <TextCell value={identityName(row.original)} emphasis="primary" />
      ),
      size: 220,
      meta: { priority: 100, label: t("printer.columns.cardholder") },
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: () => <HeadCell icon={Printer}>{t("common.status")}</HeadCell>,
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
      id: "organization",
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>{t("filters.attributes.organization")}</HeadCell>
      ),
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 200,
      meta: { priority: 70, label: t("filters.attributes.organization") },
    },
    {
      id: "template",
      accessorFn: (row) => row.template?.title ?? "",
      header: () => (
        <HeadCell icon={LayoutTemplate}>{t("templates.singular")}</HeadCell>
      ),
      // Which design is on the printer matters more on this screen than on any
      // other: it is what decides the stock in the tray.
      cell: ({ row }) => (
        <TextCell value={row.original.template?.title} emphasis="quiet" />
      ),
      size: 200,
      meta: { priority: 50, label: t("templates.singular") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarPlus}>{t("filters.attributes.created")}</HeadCell>
      ),
      // When the card was issued, which is not when it last moved — a job that
      // was created in June and last moved in June has been sitting here since
      // June, and it takes both columns side by side to see that.
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      // Below "Last moved": in a queue the age of a job is context, where the
      // date it last changed hands is the thing being worked from.
      meta: { priority: 30, label: t("filters.attributes.created") },
    },
    {
      accessorKey: "updatedAt",
      header: () => (
        <HeadCell icon={CalendarClock}>{t("printer.columns.lastMoved")}</HeadCell>
      ),
      // `updatedAt`, not `createdAt`: in a queue the useful date is when the
      // card last changed hands, which is how a stalled job is spotted.
      cell: ({ row }) => <DateCell value={row.original.updatedAt} />,
      size: 190,
      meta: { priority: 40, label: t("printer.columns.lastMoved") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      // A card at `PRINTED` has no verb left, so `PrintActions` renders
      // nothing — the cell is deliberately empty rather than holding a dead
      // control (§15.5).
      cell: ({ row }) => (
        <div className="flex justify-end">
          <PrintActions card={row.original} />
        </div>
      ),
      size: 150,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}
