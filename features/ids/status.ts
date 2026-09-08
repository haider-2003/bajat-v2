import type { TranslationKey, Translator } from "@/i18n/translate"
import { formatText } from "@/utils/format"

import { statusId, type StatusName } from "./types"

/**
 * How an identity's status is labelled and toned.
 *
 * Presentation, but *this entity's* presentation — the printer queue, the
 * delivery screen and the issuance list all need the same ten labels and the
 * same ten tones, so it belongs with the entity rather than with any one
 * screen (the same reasoning as features/members-requests/status.ts).
 *
 * The tone union is written out rather than imported from `data-bits`: a
 * feature module describing an API resource should not depend on a component,
 * and the two are checked against each other at the call site anyway.
 */
export const STATUS_META: Record<
  StatusName,
  {
    /**
     * A dictionary key, not a label. A module constant is evaluated once per
     * process, so a literal here would be fixed to whichever language happened
     * to render first and then shown to everyone. Resolve it with `t()`, or
     * use `statusMeta()` below, which does that and also survives a status the
     * backend has invented since this list was written.
     */
    labelKey: TranslationKey
    tone: "neutral" | "info" | "success" | "warning" | "danger" | "accent"
  }
> = {
  PENDING: { labelKey: "status.ids.pending", tone: "neutral" },
  PAID: { labelKey: "status.ids.paid", tone: "info" },
  APPROVED: { labelKey: "status.ids.approved", tone: "info" },
  REJECTED: { labelKey: "status.ids.rejected", tone: "danger" },
  // Warning, not neutral: this is the queue's *inbox*. A card sitting here is
  // work nobody has started, which is the one state the printer screen exists
  // to make visible.
  WAITING_TO_PRINT: { labelKey: "status.ids.waitingToPrint", tone: "warning" },
  PRINTING: { labelKey: "status.ids.printing", tone: "accent" },
  PRINTED: { labelKey: "status.ids.printed", tone: "success" },
  DELIVERY_IN_PROGRESS: { labelKey: "status.ids.outForDelivery", tone: "info" },
  DELIVERED: { labelKey: "status.ids.delivered", tone: "success" },
  RETURNED: { labelKey: "status.ids.returned", tone: "danger" },
}

/**
 * Status metadata that never returns undefined.
 *
 * The backend can add a status before the frontend knows about it, and an
 * unrecognised one should still render a readable label rather than crash on
 * `meta.tone`. `WAITING_TO_PRINT` becomes "Waiting to print" on the way
 * through, so even the fallback reads like a label.
 */
export function statusMeta(
  t: Translator,
  status: StatusName | string | null | undefined
) {
  if (status && status in STATUS_META) {
    const meta = STATUS_META[status as StatusName]
    return { label: t(meta.labelKey), tone: meta.tone }
  }
  // An untranslated status is still better than a blank badge: the raw name,
  // de-shouted, is at least the thing the backend called it.
  return {
    label: formatText(
      typeof status === "string" ? status.toLowerCase().replace(/_/g, " ") : null
    ),
    tone: "neutral" as const,
  }
}

/**
 * The three statuses the printer queue is about.
 *
 * A card enters at `WAITING_TO_PRINT` once it is approved and paid for, and
 * leaves the queue's concern at `PRINTED` — delivery owns it after that. Cards
 * that never got this far (`PENDING`, `REJECTED`) are somebody else's screen.
 */
export const PRINT_QUEUE_STATUSES: StatusName[] = [
  "WAITING_TO_PRINT",
  "PRINTING",
  "PRINTED",
]

/** The same three as the numbers the API filters on — `statuses[]=4&5&6`. */
export const PRINT_QUEUE_IDS = PRINT_QUEUE_STATUSES.map(statusId)

/**
 * The one status change the printer screen offers, given where a card is.
 *
 * Deliberately a *step*, not a picker of all ten. An operator at a card
 * printer moves work forward one stage; letting them set `REJECTED` from here
 * would be offering a decision this screen has no context for. `PRINTED` is
 * the end of the line — returning `null` is what makes the button disappear
 * rather than sit there disabled.
 */
export function nextPrintStep(
  status: StatusName | string | null | undefined
): { status: StatusName; labelKey: TranslationKey } | null {
  if (status === "WAITING_TO_PRINT") {
    return { status: "PRINTING", labelKey: "printer.markAsPrinting" }
  }
  if (status === "PRINTING") {
    return { status: "PRINTED", labelKey: "printer.markAsPrinted" }
  }
  return null
}
