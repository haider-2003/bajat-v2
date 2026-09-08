"use client"

import * as React from "react"
import { Check, Copy, Eye, EyeOff } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"
import { EMPTY_VALUE } from "@/utils/format"

/**
 * An API key's secret: masked, revealable, copyable.
 *
 * ### The backend returns it in full on every row
 *
 * That is `/access_key`'s contract, not a choice this client can make
 * (docs/CRUD-MIGRATION-REFERENCE.md §1.2) — the secret is in the list
 * response, so it is already in memory and in the network tab. What the UI
 * *can* decide is whether it is on screen by default, and it is not: a table
 * of live credentials is a table nobody can screen-share, screenshot for a
 * support thread, or open on a projector.
 *
 * So the resting state is a mask with the last four characters showing. Four
 * is enough to answer the only question asked of a key you already have —
 * "is this the one in my config?" — without printing the one you don't.
 *
 * ### Reveal is per row and resets on unmount
 *
 * Held in this component's state rather than the screen's, so paging or
 * filtering re-masks every row. A reveal that survived a refetch would be a
 * secret left on screen by a background update nobody asked for.
 */

/** How much of the tail stays visible. Enough to recognise, not to use. */
const VISIBLE_TAIL = 4

/** How long the copied confirmation stays up, in ms. */
const COPIED_MS = 1600

function mask(secret: string): string {
  if (secret.length <= VISIBLE_TAIL) return "•".repeat(secret.length)
  const tail = secret.slice(-VISIBLE_TAIL)
  // A fixed-width mask rather than one dot per character: the real length is
  // itself a hint about the secret, and a column of equal-length masks also
  // stops the cell width jumping between rows.
  return `${"•".repeat(12)}${tail}`
}

export function SecretCell({
  secret,
  name,
  className,
}: {
  secret: string | null | undefined
  /** Names the key in the accessible labels — "Reveal the secret for Kiosk". */
  name: string
  className?: string
}) {
  const t = useT()
  const [revealed, setRevealed] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Clears the confirmation, and cancels itself if the row unmounts first —
  // a `setState` after unmount on a table that repages constantly is a leak.
  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  if (!secret) {
    return <span className="text-[13px] text-text-placeholder">{EMPTY_VALUE}</span>
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
    } catch {
      // `navigator.clipboard` needs a secure context and a permission that can
      // be refused. Revealing the value is the fallback that always works —
      // it can then be selected by hand.
      setRevealed(true)
    }
  }

  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      {/* Mono, LTR and tabular: a secret is compared character by character,
          and it stays Latin-ordered even on an Arabic page. */}
      <code
        dir="ltr"
        className="min-w-0 flex-1 truncate font-mono text-[13px] tracking-[0.02em] text-text-secondary rtl:text-end"
      >
        {revealed ? secret : mask(secret)}
      </code>

      <IconButton
        label={
          revealed
            ? t("apiKeys.hideLabel", { name })
            : t("apiKeys.revealLabel", { name })
        }
        onClick={() => setRevealed((current) => !current)}
        icon={revealed ? EyeOff : Eye}
      />

      <IconButton
        label={t("apiKeys.copyLabel", { name })}
        onClick={copy}
        icon={copied ? Check : Copy}
        // The only tone on the row, and only for the moment after a copy.
        tone={copied ? "text-success" : undefined}
      />
    </span>
  )
}

/**
 * §15.5 allows a glyph alone only with both an accessible name and a tooltip.
 * Both are here.
 */
function IconButton({
  label,
  onClick,
  icon: Icon,
  tone,
}: {
  label: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  tone?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
              "transition-colors duration-120 outline-none",
              "hover:bg-[rgba(0,0,0,0.04)] hover:text-text",
              "focus-visible:ring-2 focus-visible:ring-ring",
              "dark:hover:bg-[rgba(255,255,255,0.06)]",
              tone ?? "text-text-muted"
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
