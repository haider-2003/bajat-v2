"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarClock,
  CalendarRange,
  CircleDot,
  GitBranch,
  Hash,
  IdCard,
  LayoutTemplate,
  Wallet,
} from "lucide-react"

import { DateCell, HeadCell, IdCell, TextCell } from "@/components/table/cells"
import { SoftBadge } from "@/components/ui/data-bits"
import {
  templateIssued,
  templatePrice,
  templateStatus,
  templateValidity,
} from "@/features/templates/display"
import type { Template, TemplateScope } from "@/features/templates/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"
import { formatText } from "@/utils/format"

import { TemplateFace } from "./template-face"
import { TemplateActions, type TemplateActionHandlers } from "./template-actions"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant, because the actions cell needs callbacks
 * the screen owns: which template a dialog is open on is the screen's state,
 * not the row's. Memoize the result — a fresh array every render remounts
 * every cell.
 *
 * ### The design column carries a thumbnail
 *
 * A table of templates listed by title alone is a list of strings that all
 * start with the word "Card". The 48px front face in the first column is what
 * makes a row identifiable at a glance, and it is the same `TemplateFace` the
 * gallery uses, so the two views cannot disagree about what a template looks
 * like.
 *
 * ### The public tab has one column fewer
 *
 * "Issued" counts identities cut from a design, and nothing is ever cut from a
 * public blueprint — it is copied into an organization first
 * (docs/CARD-CREATE-ASSIGN-GALLERY.md §5.5). A column of zeros would not be
 * wrong, but it would invite the question "why is nobody using these", which
 * has the wrong premise. Omitted from the definition rather than hidden
 * through `columnVisibility`, so the View menu cannot bring it back.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(
  t: Translator,
  scope: TemplateScope,
  handlers: TemplateActionHandlers
): ColumnDef<Features, Template, unknown>[] {
  const issued: ColumnDef<Features, Template, unknown> = {
    id: "issued",
    accessorFn: (row) => row.identitiesCount ?? 0,
    header: () => <HeadCell icon={IdCard}>{t("templates.columns.issued")}</HeadCell>,
    // Right-aligned and tabular: a column of counts is compared down its own
    // edge, not read across (§8.6).
    cell: ({ row }) => (
      <span className="block text-end text-[13px] tabular-nums text-text-secondary">
        {templateIssued(row.original.identitiesCount)}
      </span>
    ),
    size: 110,
    meta: { priority: 80, label: t("templates.columns.issued") },
  }

  return [
    {
      accessorKey: "id",
      header: () => <HeadCell icon={Hash}>{t("templates.columns.id")}</HeadCell>,
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 76,
      meta: { priority: 40, label: t("templates.columns.id") },
    },
    {
      id: "design",
      accessorFn: (row) => row.title ?? "",
      header: () => <HeadCell icon={LayoutTemplate}>{t("templates.columns.design")}</HeadCell>,
      // The row's identity, so it carries the primary emphasis (§8.6).
      //
      // `my-2` is this column's alone: the shared `TableCell` is `py-0`, which
      // is right for a line of text but leaves a 30px thumbnail flush against
      // the one above it with only the hairline between them.
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => handlers.onPreview(row.original)}
          className="flex w-full min-w-0 items-center gap-3 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TemplateFace
            src={row.original.frontImage}
            alt=""
            className="my-2 w-12 shrink-0 border border-border"
          />
          <span className="min-w-0 flex-1">
            <span
              title={row.original.title}
              className="block truncate text-sm font-medium text-text"
            >
              {formatText(row.original.title)}
            </span>
            <span className="block truncate text-xs text-text-muted">
              {row.original.description?.trim() || t("templates.noDescription")}
            </span>
          </span>
        </button>
      ),
      size: 300,
      // The one column that must not drop: without it this is a list of prices.
      meta: { priority: 100, label: t("templates.columns.design") },
    },
    {
      id: "status",
      accessorFn: (row) => (row.isEnabled === 0 ? "disabled" : "enabled"),
      header: () => <HeadCell icon={CircleDot}>{t("common.status")}</HeadCell>,
      // Flat soft badge — this is workflow status, not priority (§14.1).
      cell: ({ row }) => {
        const status = templateStatus(t, row.original)
        return <SoftBadge tone={status.tone}>{status.label}</SoftBadge>
      },
      size: 120,
      meta: { priority: 90, label: t("common.status") },
    },
    ...(scope === "organization" ? [issued] : []),
    {
      id: "price",
      accessorFn: (row) => Number(row.price ?? 0),
      header: () => <HeadCell icon={Wallet}>{t("templates.columns.price")}</HeadCell>,
      cell: ({ row }) => (
        <span className="block text-end text-[13px] tabular-nums text-text-secondary">
          {templatePrice(t, row.original.price)}
        </span>
      ),
      size: 130,
      meta: { priority: 70, label: t("templates.columns.price") },
    },
    {
      id: "validity",
      accessorFn: (row) => row.identityDuration ?? 0,
      header: () => <HeadCell icon={CalendarRange}>{t("templates.columns.validity")}</HeadCell>,
      cell: ({ row }) => (
        <span className="text-[13px] text-text-secondary">
          {templateValidity(t, row.original.identityDuration)}
        </span>
      ),
      size: 140,
      meta: { priority: 60, label: t("templates.columns.validity") },
    },
    {
      id: "branch",
      accessorFn: (row) => (row.branchRequired ? "required" : ""),
      header: () => <HeadCell icon={GitBranch}>{t("templates.columns.branch")}</HeadCell>,
      // Only the exception is printed. "Not required" in every row but three is
      // a column of noise (§8.6).
      cell: ({ row }) =>
        row.original.branchRequired ? (
          <span className="text-[13px] text-text-secondary">
            {t("templates.required")}
          </span>
        ) : (
          <span className="text-[13px] text-text-placeholder">—</span>
        ),
      size: 120,
      meta: { priority: 20, label: t("templates.columns.branch") },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => <HeadCell icon={Building2}>{t("filters.attributes.organization")}</HeadCell>,
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 190,
      meta: { priority: 50, label: t("filters.attributes.organization") },
    },
    {
      accessorKey: "updatedAt",
      header: () => <HeadCell icon={CalendarClock}>{t("templates.columns.updated")}</HeadCell>,
      // `updatedAt`, not `createdAt`: a design is edited for years, so when it
      // was last changed is the useful date and when it was created is trivia.
      cell: ({ row }) => <DateCell value={row.original.updatedAt} />,
      size: 190,
      meta: { priority: 30, label: t("templates.columns.updated") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      // The group is `inline-flex`, so the cell does the aligning — a
      // `justify-end` on the group itself would only space its own segments.
      cell: ({ row }) => (
        <div className="flex justify-end">
          <TemplateActions
            template={row.original}
            scope={scope}
            handlers={handlers}
          />
        </div>
      ),
      size: 130,
      enableSorting: false,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}
