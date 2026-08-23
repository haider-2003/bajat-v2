"use client"

import type { Table as TanTable } from "@tanstack/react-table"
import { CalendarDays, CalendarPlus } from "lucide-react"

import {
  AvatarStack,
  GradientOrb,
  SegmentedMeter,
  SoftBadge,
  StatusDot,
} from "@/components/ui/data-bits"
import { cn } from "@/lib/utils"

import type { Features } from "@/lib/table-features"
import {
  PRIORITY_META,
  STATUS_META,
  currencyFmt,
  formatDate,
  type MemberRequest,
} from "./shared"

/**
 * Card view — DESIGN.md §8.12.
 *
 * Also the responsive fallback: below `lg` the table collapses to this rather
 * than squeezing eleven columns. Grid uses auto-fit so it reflows without
 * media queries (§18.5).
 */
export function CardView({ table }: { table: TanTable<Features, MemberRequest> }) {
  const rows = table.getRowModel().rows

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-16 text-center">
        <p className="text-base font-semibold text-text">
          No requests match these filters
        </p>
        <p className="mx-auto mt-2 max-w-[320px] text-[13px] text-text-muted">
          Try clearing a filter or widening the search.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {rows.map((row) => {
        const req = row.original
        const status = STATUS_META[req.status]
        const priority = PRIORITY_META[req.priority]
        const selected = row.getIsSelected()

        return (
          <button
            key={req.id}
            type="button"
            onClick={() => row.toggleSelected(!selected)}
            aria-pressed={selected}
            className={cn(
              "flex flex-col gap-3 rounded-lg border bg-surface p-5 text-left",
              "transition-colors duration-120",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-border-strong bg-selected"
                : "border-border hover:border-border-strong"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <GradientOrb seed={req.avatar} size={32} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-text">
                    {req.memberName}
                  </span>
                  <span className="truncate text-xs text-text-muted">
                    {req.memberEmail}
                  </span>
                </span>
              </div>
              <SoftBadge tone={priority.tone} bordered>
                {priority.label}
              </SoftBadge>
            </div>

            <div className="flex items-center gap-2">
              <StatusDot tone={status.tone} />
              <SoftBadge tone={status.tone}>{status.label}</SoftBadge>
              <span className="ml-auto font-mono text-xs font-medium tracking-[0.02em] text-text-muted">
                {req.id}
              </span>
            </div>

            <div className="border-t border-border-subtle pt-3">
              <SegmentedMeter value={req.progress} tone={status.tone} />
            </div>

            {/* Key/value pairs, per the stacked-card spec (§8.12). */}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-text-muted">Template</dt>
                <dd className="truncate text-text-secondary">{req.template}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-text-muted">Branch</dt>
                <dd className="truncate text-text-secondary">{req.branch}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-text-muted">Due date</dt>
                <dd className="truncate text-text-secondary">
                  {req.dueAt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3" strokeWidth={1.5} />
                      {formatDate(req.dueAt)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-text-placeholder">
                      <CalendarPlus className="size-3" strokeWidth={1.5} />
                      Add date
                    </span>
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-text-muted">Fee</dt>
                <dd className="truncate tabular-nums text-text-secondary">
                  {currencyFmt.format(req.amount)} IQD
                </dd>
              </div>
            </dl>

            <div className="flex items-center justify-between border-t border-border-subtle pt-3">
              <span className="text-xs text-text-muted">Reviewers</span>
              <AvatarStack seeds={req.reviewers} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
