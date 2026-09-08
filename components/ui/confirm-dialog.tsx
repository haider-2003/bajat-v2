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
import { useT } from "@/i18n/context"
import type { ApiErrorBody } from "@/types/api"
import { cn } from "@/lib/utils"

/**
 * The confirmation every destructive row action goes through — DESIGN.md §13.
 *
 * ### It restates the row rather than asking a bare "are you sure"
 *
 * `terms` is the point of this component. A dialog that says "Delete this
 * node?" is answered by clicking the button that was already clicked; one that
 * names the node, its colour and its organization is answered by *reading*.
 * On a table of similar rows the restated fields are the only thing that
 * distinguishes the row that is about to go from the one beside it, which is
 * the failure mode a confirmation exists to catch.
 *
 * ### The error lives here, not in a toast
 *
 * A delete that fails must leave the dialog open with the reason in it: a
 * toast over a closed dialog reads as "done" first and "failed" second, and by
 * then the row is gone from the screen and the reader has nothing to retry
 * against.
 *
 * Server wording passes through untranslated — a client dictionary cannot
 * localise a string it has never seen. Only the two messages this app writes
 * itself are translated.
 */

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

export type ConfirmTerm = {
  label: string
  value: string
  /** Renders across both columns — for a long value like a URL. */
  wide?: boolean
}

/** An Axios rejection, reduced to one line somebody can act on. */
export function readApiError(
  error: unknown,
  fallback: string,
  offline: string
): string {
  if (!axios.isAxiosError(error)) return fallback
  const body = error.response?.data as ApiErrorBody | undefined
  const first = Object.values(body?.errors ?? {})[0]?.[0]
  return first ?? body?.message ?? (error.response ? fallback : offline)
}

/** One `label / value` pair in the restated row. */
function Term({ label, value, wide }: ConfirmTerm) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-[11px] font-medium tracking-[0.04em] text-text-placeholder uppercase">
        {label}
      </dt>
      <dd title={value} className="mt-1 truncate text-[13px] text-text">
        {value}
      </dd>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  terms,
  note,
  confirmLabel,
  pendingLabel,
  /** `false` swaps §7.2's destructive fill for the primary — for a non-delete. */
  destructive = true,
  onConfirm,
  pending = false,
  error,
  errorFallback,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** The row, restated. Rendered as a two-column definition list. */
  terms?: ConfirmTerm[]
  /** One line under the terms, for a consequence the title cannot carry. */
  note?: string
  confirmLabel: string
  pendingLabel: string
  destructive?: boolean
  onConfirm: () => void
  pending?: boolean
  error?: unknown
  /** Shown when the server sends no message of its own. */
  errorFallback: string
}) {
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent size="sm">
        <DialogCloseButton disabled={pending} />

        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {terms && terms.length > 0 && (
            <div className="rounded-lg border border-border bg-background-subtle p-3">
              <dl className="grid grid-cols-2 gap-3">
                {terms.map((term) => (
                  <Term key={term.label} {...term} />
                ))}
              </dl>
            </div>
          )}

          {note && (
            <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
              {note}
            </p>
          )}

          {error != null && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
            >
              <AlertCircle
                className="mt-px size-4 shrink-0 text-danger"
                strokeWidth={1.5}
              />
              <p className="text-[13px] text-danger">
                {readApiError(
                  error,
                  errorFallback,
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
                disabled={pending}
              >
                {t("common.cancel")}
              </Button>
            }
          />
          {/* §7.2's destructive variant — the only red button in the flow, and
              it is the one that does the irreversible thing. */}
          <Button
            variant={destructive ? "destructive" : "default"}
            type="button"
            className={ACTION}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending && (
              <Loader2
                data-icon="inline-start"
                className="animate-spin"
                strokeWidth={1.75}
              />
            )}
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
