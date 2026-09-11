"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  FileArchive,
  Hash,
  LayoutTemplate,
  Tag,
} from "lucide-react"

import {
  DateCell,
  HeadCell,
  IdCell,
  TextCell,
} from "@/components/table/cells"
import { EmptyCell, SoftBadge } from "@/components/ui/data-bits"
import { exportStatusMeta } from "@/features/templates/display"
import type { TemplateExport } from "@/features/templates/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { ExportActions } from "./export-actions"

/**
 * Column definitions for Export History — DESIGN.md §8.3 / §8.6.
 *
 * ### Status is rendered
 *
 * The reference client returned `status` and never read it, so a failed job
 * looked exactly like a queued one (docs/IDS-FLOW-EXPORTS-ROUTES.md §9.9).
 * `exportStatusMeta` tones whatever the server sends; `file` is still what
 * the action reads.
 *
 * ### The file column says what there is, not where it is
 *
 * A pre-signed storage URL is 200 characters of nothing a reader can use;
 * the column shows the file's name, and the action beside it is the way to
 * get it. The full URL is in the record sheet, selectable, for the cases
 * where the link itself is wanted.
 */
export function createColumns(t: Translator): ColumnDef<Features, TemplateExport, unknown>[] {
  return [
    {
      accessorKey: "id",
      header: () => <HeadCell icon={Hash}>{t("exports.columns.export")}</HeadCell>,
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 88,
      meta: { priority: 80, label: t("exports.columns.export") },
    },
    {
      id: "template",
      accessorFn: (row) => row.template?.title ?? "",
      header: () => (
        <HeadCell icon={LayoutTemplate}>{t("exports.columns.template")}</HeadCell>
      ),
      // What the export is *of* — the row's identity (§8.6).
      cell: ({ row }) => <TextCell value={row.original.template?.title} emphasis="primary" />,
      size: 240,
      meta: { priority: 100, label: t("exports.columns.template") },
    },
    {
      id: "status",
      accessorFn: (row) => (row.status == null ? "" : String(row.status)),
      header: () => <HeadCell icon={Tag}>{t("exports.columns.status")}</HeadCell>,
      cell: ({ row }) => {
        const meta = exportStatusMeta(t, row.original.status, !!row.original.file?.trim())
        // The raw code rides along on hover: the backend sends a number with
        // no published meaning, and the label is inferred from `file`.
        return (
          <span title={meta.raw ?? undefined}>
            <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
          </span>
        )
      },
      size: 140,
      meta: { priority: 95, label: t("exports.columns.status") },
    },
    {
      id: "file",
      accessorFn: (row) => row.file ?? "",
      header: () => <HeadCell icon={FileArchive}>{t("exports.columns.file")}</HeadCell>,
      cell: ({ row }) => {
        const file = row.original.file?.trim()
        if (!file) return <EmptyCell icon={FileArchive} label={t("exports.notReadyHint")} />
        return <TextCell value={fileNameOf(file)} emphasis="quiet" />
      },
      size: 220,
      enableSorting: false,
      meta: { priority: 70, label: t("exports.columns.file") },
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
        <HeadCell icon={CalendarPlus}>{t("exports.columns.created")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 60, label: t("exports.columns.created") },
    },
    {
      accessorKey: "updatedAt",
      header: () => (
        <HeadCell icon={CalendarClock}>{t("filters.attributes.updated")}</HeadCell>
      ),
      // When the job last moved — for a queued export, how long it has sat.
      cell: ({ row }) => <DateCell value={row.original.updatedAt} />,
      size: 190,
      meta: { priority: 40, label: t("filters.attributes.updated") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ExportActions row={row.original} />
        </div>
      ),
      size: 150,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}

/** The last path segment of a storage URL, minus its query string. */
export function fileNameOf(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")
    return name || url
  } catch {
    return url
  }
}
