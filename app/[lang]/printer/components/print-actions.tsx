"use client"

import { AlertCircle, CheckCheck, Printer } from "lucide-react"

import { RowActions } from "@/components/table/row-actions"
import { useChangeIdStatus } from "@/features/ids/api"
import { nextPrintStep } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"

/**
 * The one thing an operator *does* to a card: move it one step along.
 *
 * ### Looking at the card is not in here any more
 *
 * This used to be two ghost icon buttons — an eye and a step — which was both
 * a control nobody could name without hovering it and a vocabulary no other
 * screen in the app used. Previewing a card is now what clicking its row does
 * (`components/table/table-view.tsx`), so what is left is the queue verb, and
 * it renders in the same `RowActions` shell as every other screen's.
 *
 * The step keeps its own button rather than following preview onto the row,
 * because marking twenty cards printed should not be twenty dialogs. The
 * preview is for checking artwork before spending stock; this is for working
 * through a queue.
 *
 * It disappears at `PRINTED` — `nextPrintStep` returns null — rather than
 * sitting there disabled, because a finished job is not a blocked one. With no
 * verbs left, so does the whole control: an empty bordered box in the last
 * column would read as a button that stopped working.
 *
 * ### One mutation per card, deliberately
 *
 * A single hook shared across the table would put every row into the pending
 * state on any click, and the operator could not tell which card was moving.
 *
 * There is no toast system in this app, so a failure is reported *in place*:
 * the segment turns danger-toned, keeps the message on its tooltip, and
 * clicking again retries. Silently doing nothing is the one thing it must not
 * do — the row would look moved until the next refetch put it back.
 */
export function PrintActions({
  card,
  className,
}: {
  card: IDCard
  className?: string
}) {
  const t = useT()
  const change = useChangeIdStatus()
  const step = nextPrintStep(card.status)

  if (!step) return null

  // Resolved once: it is used as a label, as an accessible name and as half of
  // the failure title, and three `t()` calls for one string is three chances
  // for them to drift apart.
  const stepLabel = t(step.labelKey)
  const failed = change.isError

  return (
    <RowActions
      label={t("printer.cardNumber", { id: card.id })}
      primary={{
        label: failed ? t("printer.stepFailed", { step: stepLabel }) : stepLabel,
        icon: failed
          ? AlertCircle
          : step.status === "PRINTING"
            ? Printer
            : CheckCheck,
        pending: change.isPending,
        tone: failed ? "danger" : "default",
        onSelect: () => change.mutate({ id: card.id, status: step.status }),
      }}
      className={className}
    />
  )
}
