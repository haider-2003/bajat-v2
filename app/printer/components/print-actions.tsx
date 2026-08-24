"use client"

import { AlertCircle, CheckCheck, Eye, Loader2, Printer } from "lucide-react"

import { useChangeIdStatus } from "@/features/ids/api"
import { nextPrintStep } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { cn } from "@/lib/utils"

/**
 * The two things an operator does to one card: look at it, and move it one
 * step along.
 *
 * Shared by the table row and the gallery card, because they are the same two
 * actions on the same entity — only the surface around them differs.
 *
 * ### Why the step button is here and not only in the preview
 *
 * Marking twenty cards printed should not be twenty dialogs. The preview is for
 * checking artwork before spending stock; this is for working through a queue.
 *
 * It disappears at `PRINTED` — `nextPrintStep` returns null — rather than
 * sitting there disabled, because a finished job is not a blocked one.
 *
 * ### One mutation per card, deliberately
 *
 * A single hook shared across the table would put every row into the pending
 * state on any click, and the operator could not tell which card was moving.
 *
 * There is no toast system in this app, so a failure is reported *in place*:
 * the button turns danger-toned and keeps the message on its tooltip, and
 * clicking again retries. Silently doing nothing is the one thing it must not
 * do — the row would look moved until the next refetch put it back.
 */
export function PrintActions({
  card,
  onPreview,
  className,
}: {
  card: IDCard
  onPreview: (card: IDCard) => void
  className?: string
}) {
  const change = useChangeIdStatus()
  const step = nextPrintStep(card.status)

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={() => onPreview(card)}
        className={ACTION_BUTTON}
        title="Preview & print"
        aria-label={"Preview card #" + card.id}
      >
        <Eye className="size-4" strokeWidth={1.5} />
      </button>

      {step && (
        <button
          type="button"
          onClick={() => change.mutate({ id: card.id, status: step.status })}
          disabled={change.isPending}
          className={cn(
            ACTION_BUTTON,
            change.isError && "text-danger hover:bg-danger-bg hover:text-danger"
          )}
          title={change.isError ? step.label + " — failed, try again" : step.label}
          aria-label={step.label}
        >
          {change.isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
          ) : change.isError ? (
            <AlertCircle className="size-4" strokeWidth={1.5} />
          ) : step.status === "PRINTING" ? (
            <Printer className="size-4" strokeWidth={1.5} />
          ) : (
            <CheckCheck className="size-4" strokeWidth={1.5} />
          )}
        </button>
      )}
    </div>
  )
}

/** Ghost icon button, 28px — §7.1's icon footprint on §7.2's ghost variant. */
const ACTION_BUTTON = cn(
  "inline-flex size-7 items-center justify-center rounded-md text-text-muted",
  "transition-colors duration-120 outline-none",
  "hover:bg-[rgba(0,0,0,0.05)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.07)]",
  "focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50"
)
