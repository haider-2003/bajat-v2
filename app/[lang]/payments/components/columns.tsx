"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  LayoutTemplate,
  User,
} from "lucide-react"

import { DateCell, HeadCell, TextCell } from "@/components/table/cells"
import { SoftBadge } from "@/components/ui/data-bits"
import { paymentStatusMeta } from "@/features/payments/status"
import type { Payment } from "@/features/payments/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { AmountCell } from "./amount-cell"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A constant factory rather than a plain constant only so the headers can be
 * translated; there are no row callbacks, because this table has no actions.
 * `/payment` exposes a list and a detail read and nothing else — money is
 * moved by the provider, and this is the record of what it did.
 *
 * ### The reference leads, not the member
 *
 * Every other list in this app is keyed by a person. This one is keyed by a
 * *charge*: two identity requests by the same member on the same day are two
 * rows, and the only field that tells them apart is the provider's reference —
 * which is also what support quotes back when a charge is disputed. So it
 * leads and never drops.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(t: Translator): ColumnDef<Features, Payment, unknown>[] {
  return [
    {
      accessorKey: "requestId",
      header: () => (
        <HeadCell icon={CreditCard}>{t("payments.columns.reference")}</HeadCell>
      ),
      // Mono and LTR: a provider reference is a token compared character by
      // character, and it stays Latin-ordered even on an Arabic page.
      cell: ({ row }) => (
        <span
          dir="ltr"
          title={row.original.requestId}
          className="block truncate font-mono text-[13px] tracking-[0.02em] text-text rtl:text-end"
        >
          {row.original.requestId}
        </span>
      ),
      size: 200,
      meta: { priority: 110, label: t("payments.columns.reference") },
    },
    {
      accessorKey: "amount",
      header: () => (
        <HeadCell icon={Banknote}>{t("payments.columns.amount")}</HeadCell>
      ),
      cell: ({ row }) => (
        <AmountCell amount={row.original.amount} currency={row.original.currency} />
      ),
      size: 150,
      meta: { priority: 100, label: t("payments.columns.amount") },
    },
    {
      id: "status",
      accessorFn: (row) => row.status ?? "",
      header: () => (
        <HeadCell icon={CalendarCheck}>{t("payments.columns.status")}</HeadCell>
      ),
      // §14.1's flat soft badge — this is a workflow status, not a priority.
      cell: function StatusCell({ row }) {
        const meta = paymentStatusMeta(t, row.original.status)
        return <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
      },
      size: 140,
      meta: { priority: 95, label: t("payments.columns.status") },
    },
    {
      id: "member",
      accessorFn: (row) => row.member?.name ?? "",
      header: () => <HeadCell icon={User}>{t("payments.columns.member")}</HeadCell>,
      cell: ({ row }) => <TextCell value={row.original.member?.name} />,
      size: 200,
      meta: { priority: 80, label: t("payments.columns.member") },
    },
    {
      id: "template",
      accessorFn: (row) => row.template?.title ?? "",
      header: () => (
        <HeadCell icon={LayoutTemplate}>{t("payments.columns.template")}</HeadCell>
      ),
      // What was being paid for. The price lives on the template, so a row
      // whose amount looks wrong is checked against this first.
      cell: ({ row }) => <TextCell value={row.original.template?.title} />,
      size: 200,
      meta: { priority: 70, label: t("payments.columns.template") },
    },
    {
      accessorKey: "paidAt",
      header: () => (
        <HeadCell icon={CalendarCheck}>{t("payments.columns.paidAt")}</HeadCell>
      ),
      // `null` until the provider confirms — a row can exist unpaid, and that
      // is the difference between a charge raised and money received. The dash
      // `DateCell` prints for a null is the honest rendering of it.
      cell: ({ row }) => <DateCell value={row.original.paidAt} />,
      size: 190,
      meta: { priority: 60, label: t("payments.columns.paidAt") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("payments.columns.created")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 40, label: t("payments.columns.created") },
    },
  ]
}
