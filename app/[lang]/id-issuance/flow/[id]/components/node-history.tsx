"use client"

import { Paperclip } from "lucide-react"

import { EmptyState } from "@/components/table/empty-state"
import type { NodeHistory } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatText } from "@/utils/format"

/**
 * The audit trail — `IDCard.nodeHistory[]`, docs/IDS-FLOW-EXPORTS-ROUTES.md §3.4.
 *
 * Every approval appends one record: who, when, the note, the ad-hoc fields
 * and the files they attached. A reviewer at node 2 reads what the reviewer
 * at node 1 wrote here before deciding, which is the whole reason the
 * approve dialog collects those things.
 *
 * ### Ordered by position, not by node
 *
 * A record does not say which node it was taken at — only its place in the
 * array and `createdAt` order it. So the trail is numbered, newest last, and
 * never labelled with a stage name it does not carry.
 *
 * ### Attachments open, they are not downloaded
 *
 * They are URLs on the storage host, of whatever type the reviewer uploaded
 * — a PDF, a scan, a photo. The image proxy only passes images, so a plain
 * `target="_blank"` link is the one thing that works for all of them.
 */
export function NodeHistoryTrail({ history }: { history: NodeHistory[] }) {
  const t = useT()
  const formatDate = useFormatDate()

  if (history.length === 0) {
    return (
      <div className="py-6">
        <EmptyState title={t("idsFlow.history.empty")} hint={t("idsFlow.history.emptyHint")} />
      </div>
    )
  }

  return (
    <ol className="relative flex flex-col gap-5 ps-6">
      {/* The rail the steps hang off. Inset from the number chips' centre. */}
      <span
        aria-hidden
        className="absolute inset-y-2 start-[11px] w-px bg-border"
      />
      {history.map((entry, index) => {
        const fields = (entry.fields ?? []).filter((field) => field?.key)
        const attachments = (entry.attachments ?? []).filter(Boolean)
        return (
          <li key={entry.id ?? index} className="relative">
            {/* Step number, sitting on the rail. */}
            <span
              aria-hidden
              className="absolute -start-6 top-0.5 inline-flex size-[22px] items-center justify-center rounded-full border border-border bg-surface font-mono text-[11px] font-medium text-text-muted"
            >
              {index + 1}
            </span>

            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[13px] font-medium text-text">
                {entry.user?.name?.trim() || t("idsFlow.history.unknownUser")}
              </span>
              <span className="text-xs text-text-placeholder">
                {formatDate(entry.createdAt)}
              </span>
            </div>

            {entry.notes?.trim() ? (
              <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-text-secondary">
                {entry.notes.trim()}
              </p>
            ) : (
              <p className="mt-1.5 text-[13px] text-text-placeholder">
                {t("idsFlow.history.noNotes")}
              </p>
            )}

            {fields.length > 0 && (
              <dl className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-border bg-background-subtle px-3 py-2.5 min-[480px]:grid-cols-2">
                {fields.map((field, i) => (
                  <div key={`${field.key}-${i}`} className="min-w-0">
                    <dt className="truncate text-[11px] font-medium text-text-muted">
                      {field.key}
                    </dt>
                    <dd title={field.value} className="truncate text-[13px] text-text">
                      {formatText(field.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {attachments.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {attachments.map((url, i) => (
                  <li key={`${url}-${i}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-secondary outline-none hover:border-border-strong hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Paperclip className="size-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{fileNameOf(url, i)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** The last path segment of a storage URL, minus its query — or a number. */
function fileNameOf(url: string, index: number): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")
    if (name) return name
  } catch {
    // Not a URL the browser can parse; fall through.
  }
  return `#${index + 1}`
}
