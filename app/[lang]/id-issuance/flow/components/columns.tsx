"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarPlus,
  IdCard,
  LayoutTemplate,
  Phone,
  User,
  Workflow,
} from "lucide-react"

import { NodeChip } from "@/components/nodes/node-swatch"
import {
  DateCell,
  HeadCell,
  IdCell,
  PhoneCell,
  TextCell,
} from "@/components/table/cells"
import { EmptyCell } from "@/components/ui/data-bits"
import { identityName, identityPhone } from "@/features/ids/fields"
import type { IDCard } from "@/features/ids/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { FlowActions, type FlowActionHandlers } from "./flow-actions"

/**
 * Column definitions for the ID Flow inbox — DESIGN.md §8.3 / §8.6.
 *
 * ### The stage column is the screen
 *
 * `GET /identity/node` rows carry a `node` — the approval step the card is
 * parked at — and that, not `status`, is what this list is about
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §3.1). The status column is deliberately
 * absent: a card here is by definition waiting on a person, and its place on
 * the global ladder is the ledger's question, not the reviewer's.
 *
 * The stage is drawn as a `NodeChip` so it reads as the same object it is on
 * the Nodes screen and in the flow builder. A row whose `node` did not come
 * back gets an empty cell rather than a blank chip: the server sent the row,
 * so it *is* at one of the caller's nodes; it just did not say which.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(
  t: Translator,
  handlers: FlowActionHandlers
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
      cell: ({ row }) => (
        <TextCell value={identityName(row.original)} emphasis="primary" />
      ),
      size: 220,
      meta: { priority: 100, label: t("ids.columns.cardholder") },
    },
    {
      id: "node",
      accessorFn: (row) => row.node?.name ?? "",
      header: () => <HeadCell icon={Workflow}>{t("idsFlow.columns.stage")}</HeadCell>,
      cell: ({ row }) => {
        const node = row.original.node
        if (!node?.name) {
          return <EmptyCell icon={Workflow} label={t("idsFlow.stageUnknown")} />
        }
        return <NodeChip color={node.color} name={node.name} />
      },
      size: 180,
      // Second only to the name: it is the reason the row is on this screen.
      meta: { priority: 98, label: t("idsFlow.columns.stage") },
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
      // Which flow the card is walking: the stage means nothing without it.
      cell: ({ row }) => (
        <TextCell value={row.original.template?.title} emphasis="quiet" />
      ),
      size: 200,
      meta: { priority: 80, label: t("templates.singular") },
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
      // How long it has been waiting, which is the question an inbox is
      // sorted by in the reader's head even when the server will not.
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 40, label: t("ids.columns.issued") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <FlowActions card={row.original} handlers={handlers} />
        </div>
      ),
      size: 130,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}
