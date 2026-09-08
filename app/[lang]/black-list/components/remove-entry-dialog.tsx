"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDeleteBlackList } from "@/features/black-list/api"
import type { BlackList } from "@/features/black-list/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { ApiErrorBody } from "@/types/api"
import { formatPhone, formatText } from "@/utils/format"

/**
 * Remove from the black list — `DELETE /blacklist/{id}`.
 *
 * ### Why the one action on this screen is confirmed
 *
 * Removing a block is not "deleting a row", it is **unblocking a number**, and
 * the consequence lands somewhere the person clicking cannot see: the next
 * identity request from that number goes through. There is also no undo — the
 * endpoint has no restore, and re-adding it produces a new entry with a new
 * date, so the record of when it was first barred is gone for good.
 *
 * So the dialog restates the entry rather than asking a bare "are you sure":
 * the number is what is actually being unblocked, and on a list of similar
 * names it is the only field that distinguishes one row from the next.
 */

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

/**
 * An Axios rejection, reduced to one line somebody can act on.
 *
 * `first` and `body.message` are the **server's** wording and pass through
 * untranslated — a client dictionary cannot localise a string it has never
 * seen. Only the two messages this app writes itself are translated, which is
 * why `offline` is a parameter rather than a literal.
 */
function readError(
  error: unknown,
  fallback: string,
  offline: string
): string {
  if (!axios.isAxiosError(error)) return fallback
  const body = error.response?.data as ApiErrorBody | undefined
  const first = Object.values(body?.errors ?? {})[0]?.[0]
  return first ?? body?.message ?? (error.response ? fallback : offline)
}

/** One `label / value` pair. */
function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-[0.04em] text-text-placeholder uppercase">
        {label}
      </dt>
      <dd title={value} className="mt-1 truncate text-[13px] text-text">
        {value}
      </dd>
    </div>
  )
}

export function RemoveEntryDialog({
  entry,
  open,
  onOpenChange,
}: {
  /** `null` between openings — nothing renders. */
  entry: BlackList | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteBlackList()
  const submitting = remove.isPending
  const { reset } = remove

  // A failure from the last row must not greet the next one.
  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!entry) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
    >
      <DialogContent size="sm">
        <DialogCloseButton disabled={submitting} />

        <DialogHeader>
          <DialogTitle>{t("blackList.unblockTitle")}</DialogTitle>
          <DialogDescription>
            {t("blackList.unblockDescription")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="rounded-lg border border-border bg-background-subtle p-3">
            <dl className="grid grid-cols-2 gap-3">
              <Term
                label={t("members.columns.name")}
                value={formatText(entry.name)}
              />
              {/* The field the block actually keys on, so it is the one worth
                  reading twice on a list of similar names. */}
              <Term label={t("blackList.number")} value={formatPhone(entry.phone)} />
              <Term
                label={t("filters.attributes.organization")}
                value={formatText(entry.organization?.name)}
              />
              <Term
                label={t("blackList.columns.blockedOn")}
                value={formatDate(entry.createdAt)}
              />
            </dl>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
            {t("blackList.unblockNote")}
          </p>

          {remove.isError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
            >
              <AlertCircle
                className="mt-px size-4 shrink-0 text-danger"
                strokeWidth={1.5}
              />
              <p className="text-[13px] text-danger">
                {readError(
                  remove.error,
                  t("blackList.removeFailed"),
                  t("common.cannotReachServer")
                )}
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="outline"
                type="button"
                className={ACTION}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
            }
          />
          {/* §7.2's destructive variant — the only red button in the flow, and
              it is the one that does the irreversible thing. */}
          <Button
            variant="destructive"
            type="button"
            className={ACTION}
            disabled={submitting}
            onClick={() =>
              remove.mutate(entry.id, {
                onSuccess: () => onOpenChange(false),
              })
            }
          >
            {submitting && (
              <Loader2
                data-icon="inline-start"
                className="animate-spin"
                strokeWidth={1.75}
              />
            )}
            {submitting ? t("blackList.removing") : t("blackList.removeAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
