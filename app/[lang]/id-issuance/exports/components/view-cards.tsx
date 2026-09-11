"use client"

import type { Table as TanTable } from "@tanstack/react-table"
import { FileArchive } from "lucide-react"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import { exportStatusMeta } from "@/features/templates/display"
import type { TemplateExport } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatText } from "@/utils/format"

import { fileNameOf } from "./columns"
import { ExportActions } from "./export-actions"

/**
 * Card view — DESIGN.md §8.12 and §9. The responsive fallback below `lg`.
 *
 * A summary of fields, like every card view that is not a picture of a card:
 * the template, the status, and the verb.
 */
export function CardView({
  table,
  emptyTitle,
  onOpen,
}: {
  table: TanTable<Features, TemplateExport>
  emptyTitle: string
  onOpen: (row: TemplateExport) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const rows = table.getRowModel().rows.map((row) => row.original)

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {rows.map((row) => {
        const file = row.file?.trim()
        const meta = exportStatusMeta(t, row.status, !!file)
        return (
          <article
            key={row.id}
            className="flex flex-col rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="min-w-0 rounded-sm text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <h3 className="truncate text-sm font-medium text-text">
                  {formatText(row.template?.title)}
                </h3>
                <p className="mt-1 truncate text-[13px] text-text-muted">
                  {formatText(row.organization?.name)}
                </p>
              </button>
              <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
            </div>

            <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
              <Detail
                label={t("exports.columns.file")}
                value={file ? fileNameOf(file) : t("exports.notReadyHint")}
                icon={file ? FileArchive : undefined}
              />
              <Detail label={t("exports.columns.created")} value={formatDate(row.createdAt)} />
            </dl>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
              <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
                #{row.id}
              </span>
              <ExportActions row={row} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
}) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd
        title={value}
        className="inline-flex min-w-0 items-center gap-1.5 truncate text-[13px] text-text-secondary"
      >
        {Icon && <Icon className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.5} />}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  )
}
