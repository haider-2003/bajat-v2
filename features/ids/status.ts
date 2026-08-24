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
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "accent" }
> = {
  PENDING: { label: "Pending", tone: "neutral" },
  PAID: { label: "Paid", tone: "info" },
  APPROVED: { label: "Approved", tone: "info" },
  REJECTED: { label: "Rejected", tone: "danger" },
  // Warning, not neutral: this is the queue's *inbox*. A card sitting here is
  // work nobody has started, which is the one state the printer screen exists
  // to make visible.
  WAITING_TO_PRINT: { label: "Waiting to print", tone: "warning" },
  PRINTING: { label: "Printing", tone: "accent" },
  PRINTED: { label: "Printed", tone: "success" },
  DELIVERY_IN_PROGRESS: { label: "Out for delivery", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  RETURNED: { label: "Returned", tone: "danger" },
}

/**
 * Status metadata that never returns undefined.
 *
 * The backend can add a status before the frontend knows about it, and an
 * unrecognised one should still render a readable label rather than crash on
 * `meta.tone`. `WAITING_TO_PRINT` becomes "Waiting to print" on the way
 * through, so even the fallback reads like a label.
 */
export function statusMeta(status: StatusName | string | null | undefined) {
  if (status && status in STATUS_META) {
    return STATUS_META[status as StatusName]
  }
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
): { status: StatusName; label: string } | null {
  if (status === "WAITING_TO_PRINT") {
    return { status: "PRINTING", label: "Mark as printing" }
  }
  if (status === "PRINTING") {
    return { status: "PRINTED", label: "Mark as printed" }
  }
  return null
}
