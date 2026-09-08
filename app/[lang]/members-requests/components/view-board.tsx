"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { CountChip, StatusDot } from "@/components/ui/data-bits"

import type { Features } from "@/lib/table-features"
import { STATUS_META, STATUS_ORDER } from "@/features/members-requests/status"
import type { MemberRequest } from "@/features/members-requests/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatPhone, formatText } from "@/utils/format"

/**
 * Board view — one column per status.
 *
 * Cards follow §9.1 (12px radius, 1px border, 20px padding, no resting
 * shadow) and the column header reuses the grouped-table band from §8.4:
 * status dot, name at 14px/600, neutral count chip.
 *
 * Each card carries **three** lines and nothing else. The status badge that
 * used to sit on every card is gone — the column it is sitting in already says
 * "Pending", so repeating it on each card was noise, not information.
 */

function RequestCard({ request }: { request: MemberRequest }) {
  const formatDate = useFormatDate()

  return (
    <article className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-5">
      <h3 className="truncate text-sm font-medium text-text">
        {formatText(request.name)}
      </h3>

      {/* `dir="ltr"`: a phone number is a Latin digit string whose `+964`
          prefix must stay in front of it, whatever the paragraph direction. */}
      <p
        dir="ltr"
        className="truncate font-mono text-[13px] tabular-nums text-text-secondary rtl:text-end"
      >
        {formatPhone(request.phone)}
      </p>

      <p className="truncate text-[13px] text-text-muted">
        {formatText(request.organization?.name)}
      </p>

      {/* Identity + date, demoted to a single quiet line (§1.2). */}
      <p className="mt-2 flex items-center gap-2 text-xs text-text-placeholder">
        <span className="font-mono tracking-[0.02em]">#{request.id}</span>
        <span aria-hidden>·</span>
        <span className="truncate">{formatDate(request.createdAt)}</span>
      </p>
    </article>
  )
}

function Column({
  label,
  tone,
  requests,
}: {
  label: string
  tone?: "info" | "success" | "danger"
  requests: MemberRequest[]
}) {
  return (
    <section className="flex w-[300px] shrink-0 flex-col">
      <header className="mb-3 flex h-11 items-center gap-2 rounded-md bg-background-subtle px-3">
        <StatusDot tone={tone} />
        <h2 className="text-sm font-semibold text-text">{label}</h2>
        <CountChip>{requests.length}</CountChip>
      </header>

      {/* 16px between cards, per §9.1. */}
      <div className="flex flex-col gap-4">
        {requests.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}

        {requests.length === 0 && <EmptyColumn />}
      </div>
    </section>
  )
}

/** The one string a column owns; split out so `Column` stays presentational. */
function EmptyColumn() {
  const t = useT()
  return (
    <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-[13px] text-text-placeholder">
      {t("requests.boardEmptyColumn")}
    </p>
  )
}

export function BoardView({ table }: { table: TanTable<Features, MemberRequest> }) {
  const t = useT()
  const requests = table.getRowModel().rows.map((row) => row.original)

  // A row carrying a status this screen doesn't know would match no column and
  // disappear from the board. Collect those instead of dropping them silently;
  // the column only appears when such rows actually exist.
  const unknown = requests.filter((r) => !STATUS_ORDER.includes(r.status))

  return (
    // Board scrolls horizontally inside itself, never the page (§18.0 rule 2).
    <div className="overflow-x-auto pb-2 scrollbar-quiet">
      <div className="flex min-w-max gap-4">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            label={t(STATUS_META[status].labelKey)}
            tone={STATUS_META[status].tone}
            requests={requests.filter((r) => r.status === status)}
          />
        ))}

        {unknown.length > 0 && (
          <Column label={t("requests.boardOther")} requests={unknown} />
        )}
      </div>
    </div>
  )
}
