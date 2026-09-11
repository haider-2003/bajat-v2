"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

import api from "@/api/client"
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
import { TemplateQueryKeys } from "@/features/templates/api"
import type { Template, TemplateScope } from "@/features/templates/types"
import { readPageInfo } from "@/utils/api/pagination"
import { cn } from "@/lib/utils"

/**
 * A debug control that deletes every template on the current tab.
 *
 * ### It is not part of the product
 *
 * Its single call site is wrapped in `process.env.NODE_ENV !== "production"`,
 * which Next inlines at build time, so the branch is gone from a production
 * build and the button cannot render there — not hidden behind a flag or a
 * grant somebody could flip. (Whether the module's *bytes* also leave the
 * bundle is up to tree-shaking; nothing here runs at import time, so they
 * should, but the guarantee worth relying on is that it never renders.)
 *
 * That is also why the strings here are hardcoded English instead of going
 * through `t()`. The dictionaries are the product's, this is not product, and
 * a dev-only tool has no business adding weight to every shipped translation.
 *
 * ### It talks to whatever `NEXT_PUBLIC_API_BASE_URL` points at
 *
 * There is no local backend in this repo. Unset, `api/client.ts` falls back to
 * the **production** dashboard API, which is what a bare `next dev` gets. There
 * is nothing this component can do about that — it is worth knowing before
 * pressing the button.
 *
 * ### Two phases, because paging shifts under a delete
 *
 * Every id is collected first, then deleted. Deleting while paging would walk
 * a list that renumbers itself after each removal and would reliably skip rows:
 * delete page 1, and what was page 2 is now page 1, but the cursor has already
 * moved past it.
 */

/** Big enough that a few hundred templates is a handful of requests. */
const COLLECT_PAGE_SIZE = 100

/** A stop, so a mis-typed filter cannot spin forever against a broken pager. */
const MAX_PAGES = 200

/**
 * Parallel deletes in flight. Sequential is too slow to be the debug tool that
 * was asked for; unbounded is a few hundred simultaneous sockets and a server
 * that starts refusing them, which reads as random failures.
 */
const CONCURRENCY = 8

type Phase =
  | { step: "idle" }
  | { step: "collecting"; found: number }
  | { step: "confirm"; ids: number[] }
  | { step: "deleting"; done: number; total: number; failed: number }
  | { step: "done"; deleted: number; failed: string[] }

/** Every template id on one tab, walked page by page. */
async function collectIds(
  scope: TemplateScope,
  onProgress: (found: number) => void
): Promise<number[]> {
  const ids: number[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await api.get<{ data: Template[] }>("/template", {
      params: { page, per_page: COLLECT_PAGE_SIZE, type: scope },
    })

    const rows = response.data?.data ?? []
    for (const row of rows) {
      if (typeof row?.id === "number") ids.push(row.id)
    }
    onProgress(ids.length)

    // Either the pager says where the end is, or a short page says it for us.
    const { lastPage } = readPageInfo(response.data)
    if (rows.length < COLLECT_PAGE_SIZE) break
    if (lastPage !== undefined && page >= lastPage) break
  }

  return ids
}

/**
 * `worker` over `items`, `limit` at a time.
 *
 * Workers pull from a shared cursor rather than being handed a fixed slice, so
 * one slow delete does not leave its whole slice waiting behind it.
 */
async function pool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        await worker(items[index])
      }
    }
  )
  await Promise.all(runners)
}

export function DebugWipeTemplates({ scope }: { scope: TemplateScope }) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = React.useState<Phase>({ step: "idle" })
  // Read by the delete loop between items, so Stop takes effect on the next
  // one rather than having to cancel requests already in flight.
  const cancelled = React.useRef(false)

  const busy = phase.step === "collecting" || phase.step === "deleting"
  const label = scope === "global" ? "public" : "organization"

  const close = () => {
    if (busy) return
    cancelled.current = false
    setPhase({ step: "idle" })
  }

  const start = async () => {
    cancelled.current = false
    setPhase({ step: "collecting", found: 0 })
    try {
      const ids = await collectIds(scope, (found) =>
        setPhase({ step: "collecting", found })
      )
      setPhase({ step: "confirm", ids })
    } catch (error) {
      setPhase({
        step: "done",
        deleted: 0,
        failed: [
          axios.isAxiosError(error)
            ? `Could not list templates: ${error.response?.status ?? error.message}`
            : "Could not list templates",
        ],
      })
    }
  }

  const wipe = async (ids: number[]) => {
    const failed: string[] = []
    let done = 0

    setPhase({ step: "deleting", done: 0, total: ids.length, failed: 0 })

    await pool(ids, CONCURRENCY, async (id) => {
      if (cancelled.current) return
      try {
        await api.delete(`/template/${id}`)
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        failed.push(`#${id}${status ? ` (${status})` : ""}`)
      }
      done += 1
      setPhase({
        step: "deleting",
        done,
        total: ids.length,
        failed: failed.length,
      })
    })

    // One invalidation at the end, not one per delete: the list would refetch
    // on every row and each refetch would race the next delete.
    await queryClient.invalidateQueries({ queryKey: TemplateQueryKeys.all() })
    setPhase({ step: "done", deleted: done - failed.length, failed })
  }

  return (
    <>
      <Button
        variant="destructive"
        size="lg"
        onClick={start}
        disabled={busy}
        // Dashed, so it does not read as one of the screen's real controls.
        className={cn(
          "border border-dashed border-destructive/50",
          "h-9 shrink-0 font-mono text-[11px] tracking-tight uppercase"
        )}
        title={`Delete every template on the ${label} tab`}
      >
        {phase.step === "collecting" ? (
          <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
        ) : (
          <Trash2 data-icon="inline-start" strokeWidth={1.75} />
        )}
        debug: wipe {label}
      </Button>

      <Dialog open={phase.step !== "idle"} onOpenChange={(next) => !next && close()}>
        <DialogContent size="sm">
          <DialogCloseButton disabled={busy} />

          <DialogHeader>
            <DialogTitle>
              {phase.step === "done" ? "Wipe finished" : `Wipe ${label} templates`}
            </DialogTitle>
            <DialogDescription>
              {phase.step === "collecting" && `Listing templates… ${phase.found} found.`}
              {phase.step === "confirm" &&
                (phase.ids.length === 0
                  ? `Nothing to delete — the ${label} tab is already empty.`
                  : `${phase.ids.length} templates will be deleted permanently, ${CONCURRENCY} at a time.`)}
              {phase.step === "deleting" &&
                `Deleting ${phase.done} of ${phase.total}…`}
              {phase.step === "done" &&
                `${phase.deleted} deleted${phase.failed.length ? `, ${phase.failed.length} failed` : ""}.`}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {phase.step === "confirm" && phase.ids.length > 0 && (
              <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-danger">
                <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span>
                  This cannot be undone, and it runs against whatever{" "}
                  <code className="font-mono text-[12px]">NEXT_PUBLIC_API_BASE_URL</code>{" "}
                  points at — the production API when it is unset.
                </span>
              </p>
            )}

            {phase.step === "deleting" && (
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-background-subtle"
                role="progressbar"
                aria-valuenow={phase.done}
                aria-valuemin={0}
                aria-valuemax={phase.total}
              >
                <div
                  className="h-full bg-destructive transition-[width] duration-150"
                  style={{
                    width: `${phase.total ? (phase.done / phase.total) * 100 : 0}%`,
                  }}
                />
              </div>
            )}

            {phase.step === "done" && phase.failed.length > 0 && (
              <div className="rounded-lg border border-border bg-background-subtle p-3">
                <p className="mb-1.5 text-[12px] font-medium text-text-secondary">
                  Failed
                </p>
                <p dir="ltr" className="font-mono text-[11.5px] break-all text-danger">
                  {phase.failed.join(" · ")}
                </p>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            {phase.step === "deleting" ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  cancelled.current = true
                }}
              >
                Stop
              </Button>
            ) : (
              <DialogClose
                render={
                  <Button variant="outline" type="button" disabled={busy}>
                    {phase.step === "done" ? "Close" : "Cancel"}
                  </Button>
                }
              />
            )}

            {phase.step === "confirm" && phase.ids.length > 0 && (
              <Button
                variant="destructive"
                type="button"
                onClick={() => void wipe(phase.ids)}
              >
                <Trash2 data-icon="inline-start" strokeWidth={1.75} />
                Delete {phase.ids.length}
              </Button>
            )}

            {phase.step === "deleting" && (
              <Button variant="destructive" type="button" disabled>
                <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
                {phase.done} / {phase.total}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
