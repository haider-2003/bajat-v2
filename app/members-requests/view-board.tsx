"use client"

import type { Table as TanTable } from "@tanstack/react-table"
import { CalendarDays } from "lucide-react"

import {
  AvatarStack,
  CountChip,
  GradientOrb,
  SoftBadge,
  StatusDot,
} from "@/components/ui/data-bits"

import type { Features } from "@/lib/table-features"
import {
  PRIORITY_META,
  STATUS_META,
  STATUS_ORDER,
  currencyFmt,
  formatDate,
  type MemberRequest,
} from "./shared"

/**
 * Board view — one column per status.
 *
 * Cards follow §9.1 (12px radius, 1px border, no resting shadow) and the
 * column header reuses the grouped-table band from §8.4: status dot, name at
 * 14px/600, neutral count chip.
 */
export function BoardView({ table }: { table: TanTable<Features, MemberRequest> }) {
  const rows = table.getRowModel().rows

  return (
    // Board scrolls horizontally inside itself, never the page (§18.0 rule 2).
    <div className="overflow-x-auto pb-2 scrollbar-quiet">
      <div className="flex min-w-max gap-4">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status]
          const items = rows.filter((r) => r.original.status === status)

          return (
            <section key={status} className="flex w-[300px] shrink-0 flex-col">
              <header className="mb-3 flex h-11 items-center gap-2 rounded-md bg-background-subtle px-3">
                <StatusDot tone={meta.tone} />
                <h2 className="text-sm font-semibold text-text">{meta.label}</h2>
                <CountChip>{items.length}</CountChip>
              </header>

              <div className="flex flex-col gap-2">
                {items.map((row) => {
                  const req = row.original
                  const priority = PRIORITY_META[req.priority]
                  const selected = row.getIsSelected()

                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => row.toggleSelected(!selected)}
                      aria-pressed={selected}
                      className={[
                        "flex flex-col gap-2.5 rounded-lg border bg-surface p-4 text-left",
                        "transition-colors duration-120",
                        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-border-strong bg-selected"
                          : "border-border hover:border-border-strong",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium tracking-[0.02em] text-text-muted">
                          {req.id}
                        </span>
                        <SoftBadge tone={priority.tone} bordered>
                          {priority.label}
                        </SoftBadge>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <GradientOrb seed={req.avatar} />
                        <span className="truncate text-sm font-medium text-text">
                          {req.memberName}
                        </span>
                      </div>

                      <p className="truncate text-[13px] text-text-muted">
                        {req.template} · {req.branch}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                          <CalendarDays className="size-3.5" strokeWidth={1.5} />
                          {req.dueAt ? formatDate(req.dueAt) : "No due date"}
                        </span>
                        <AvatarStack seeds={req.reviewers} max={3} />
                      </div>

                      <div className="border-t border-border-subtle pt-2 text-xs tabular-nums text-text-secondary">
                        {currencyFmt.format(req.amount)} IQD
                      </div>
                    </button>
                  )
                })}

                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[13px] text-text-placeholder">
                    Nothing here
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
