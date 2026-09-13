"use client"

import * as React from "react"
import axios from "axios"
import { CloudOff, RefreshCw, ServerOff, WifiOff } from "lucide-react"

import { IdCardFill } from "@/components/brand/id-card-fill"
import { IdCardSignal } from "@/components/brand/id-card-signal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useOnline } from "@/hooks/use-online"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"
import type { ApiErrorBody } from "@/types/api"

/**
 * The states a screen is in before it has its data — DESIGN.md §8.11.
 *
 * Shared for the same reason `TableView` is and `columns.tsx` is not: the
 * skeleton, the waiting block and the failure block are chrome. Every screen
 * in this product waits the same way and fails the same way, and the only
 * screen-specific thing in any of them is the noun — which is why `title` is
 * a required prop on the failure rather than a default nobody would notice
 * was wrong.
 */

/** The table's own shape, greyed out — never a spinner (§8.11). */
export function LoadingRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="h-10 border-b border-border bg-background-subtle" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex h-12 items-center gap-3 border-b border-border px-5 last:border-b-0"
        >
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="ms-auto h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      ))}
    </div>
  )
}

/**
 * The ground the illustrations stand on: a dot grid faded to nothing before
 * it reaches an edge — the flow canvas's "infinite surface" (§1.7), the same
 * one the 404 uses. The box is taller than the card so the grid has room to
 * fade, and so the card has room to move without meeting an edge.
 */
function DotGround({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex h-40 w-full max-w-96 items-center justify-center sm:h-44">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 inset-y-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in oklab, var(--border-strong) 70%, transparent) 1px, transparent 1.5px)",
          backgroundSize: "20px 20px",
          backgroundPosition: "center",
          maskImage:
            "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 75%)",
        }}
      />
      {children}
    </div>
  )
}

/**
 * A whole area waiting on its first answer — the flow canvas, a record
 * before it arrives.
 *
 * Not for tables: a list keeps its shape with `LoadingRows` (§8.11), and an
 * illustration where rows are about to appear is a layout shift with a
 * picture in it. Here there is no shape to keep, so the area waits the way
 * it fails — the card on its dot grid, this time being written — with one
 * muted line under it and nothing else: a wait should be quieter than a
 * failure, which has a headline and a button because it needs a decision.
 */
export function LoadingState({
  label,
  className,
}: {
  /** e.g. "Loading this template's flow…". Defaults to a plain "Loading…". */
  label?: string
  className?: string
}) {
  const t = useT()

  return (
    <div
      role="status"
      aria-busy
      className={cn(
        "rounded-lg border border-border bg-surface px-6 py-12 text-center sm:py-14",
        className
      )}
    >
      <DotGround>
        <IdCardFill className="relative" />
      </DotGround>
      <p className="mt-6 text-[13px] text-text-muted">{label ?? t("common.loading")}</p>
    </div>
  )
}

/**
 * What kind of failure this is, read off the error and the browser.
 *
 * Four answers, because they call for four different next moves: no
 * network (wait — it retries itself), a request that got no reply (check
 * the connection, try again), a server that fell over (a retry usually
 * clears it), and a server that answered no (retrying will not help; say
 * what it said). Everything the caller does not tell us collapses to "no
 * reply", which is the most common of the four and the most honest guess.
 */
type Failure =
  | { kind: "offline" }
  | { kind: "unreachable" }
  | { kind: "server"; status: number }
  | { kind: "rejected"; status: number; message?: string }

function classify(error: unknown, online: boolean): Failure {
  if (!online) return { kind: "offline" }
  if (axios.isAxiosError(error) && error.response) {
    const { status, data } = error.response
    if (status >= 500) return { kind: "server", status }
    const body = data as ApiErrorBody | undefined
    return { kind: "rejected", status, message: body?.message }
  }
  return { kind: "unreachable" }
}

const COMPACT_ICON = {
  offline: WifiOff,
  unreachable: CloudOff,
  server: ServerOff,
  rejected: ServerOff,
} as const

/**
 * The request failed and there is nothing on screen to fall back to.
 *
 * Laid out like the 404 — the same card, on the same dot grid, then an
 * overline naming the kind of failure, the screen's own headline, a hint
 * that says what to do about *this* kind, and one button. The illustration
 * is the only thing that moves. Pass the query's `error` so the overline
 * and the hint can be specific; without it the block still reads correctly,
 * just as the generic "no reply".
 *
 * `compact` is for a rail or a panel beside a screen that may be showing
 * the full block already: same copy and the same retry, a small glyph in
 * place of the illustration, so two failures never animate side by side.
 *
 * Going offline is the one failure whose fix the page can watch happen, so
 * that one retries itself the moment the browser is back online.
 *
 * A screen that already has rows should *not* use this — it shows a strip
 * above them instead, so the table and its pager stay put rather than
 * vanishing and making the click look like it did nothing.
 */
export function LoadFailed({
  title,
  onRetry,
  retrying,
  error,
  size = "default",
  className,
}: {
  /** e.g. "Couldn't load the print queue". */
  title: string
  onRetry: () => void
  retrying: boolean
  /** The query's `error`, to name the failure. Optional but worth passing. */
  error?: unknown
  size?: "default" | "compact"
  className?: string
}) {
  const t = useT()
  const online = useOnline()
  const failure = classify(error, online)

  // Retry by itself once the connection is back. The ref remembers that we
  // *were* offline, so a block that mounted online never fires this on its
  // first render, and one that mounted offline fires it exactly once.
  const wasOffline = React.useRef(!online)
  React.useEffect(() => {
    if (!online) {
      wasOffline.current = true
      return
    }
    if (!wasOffline.current) return
    wasOffline.current = false
    onRetry()
  }, [online, onRetry])

  const overline =
    failure.kind === "offline"
      ? t("table.failureOffline")
      : failure.kind === "unreachable"
        ? t("table.failureUnreachable")
        : t("table.failureStatus", { status: failure.status })

  const hint =
    failure.kind === "offline"
      ? t("table.loadFailedOffline")
      : failure.kind === "unreachable"
        ? t("table.loadFailedHint")
        : failure.kind === "server"
          ? t("table.loadFailedServer")
          : (failure.message ?? t("common.serverRejected"))

  if (size === "compact") {
    const Icon = COMPACT_ICON[failure.kind]
    return (
      <div
        role="status"
        className={cn(
          "rounded-lg border border-border bg-surface px-3 py-5 text-center",
          className
        )}
      >
        <Icon className="mx-auto size-5 text-text-muted" strokeWidth={1.5} aria-hidden />
        <p className="mt-2.5 text-[13px] font-medium text-text">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{hint}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw
            data-icon="inline-start"
            className={cn(retrying && "animate-spin")}
            strokeWidth={1.75}
          />
          {t("common.retry")}
        </Button>
      </div>
    )
  }

  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-border bg-surface px-6 py-12 text-center sm:py-14",
        className
      )}
    >
      <DotGround>
        <IdCardSignal className="relative" />
      </DotGround>

      {/* Overline (§3.3 `--text-overline`): what kind of failure — the one
          place uppercase is allowed outside sidebar section labels. */}
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {overline}
      </p>
      <p className="mt-2 text-base font-semibold tracking-[-0.01em] text-balance text-text sm:text-lg">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-[1.55] text-pretty text-text-muted">
        {hint}
      </p>

      {/* Outline, not primary: the screen's own primary action (create,
          issue, export) is usually still in the header above this block,
          and a retry should not compete with it (§20.12). */}
      <Button
        variant="outline"
        className="mt-6"
        onClick={onRetry}
        disabled={retrying}
      >
        <RefreshCw
          data-icon="inline-start"
          className={cn(retrying && "animate-spin")}
          strokeWidth={1.75}
        />
        {t("common.tryAgain")}
      </Button>
    </div>
  )
}
