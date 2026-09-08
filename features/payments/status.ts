import type { Translator } from "@/i18n/translate"
import { humanize } from "@/features/permissions/utils"
import { formatText } from "@/utils/format"

/**
 * How a payment's status is toned.
 *
 * ### There is no closed list, so this is a tone map and not a status enum
 *
 * `Payment.status` is the *provider's* vocabulary, not ours
 * (docs/CRUD-MIGRATION-REFERENCE.md §1.13) — it arrives as a free string and
 * the set can change without this app being redeployed. So an unrecognised
 * status is a normal outcome here, not a bug: it gets the neutral tone and its
 * own words, rather than a crash on `meta.tone` or a badge reading "Unknown"
 * over a status the provider was perfectly clear about.
 *
 * Matching is on a lowercased, punctuation-collapsed key so the same status
 * spelled `PAID`, `paid` and `Paid` lands in one bucket — providers are not
 * consistent about case, and three badges in three colours for one status is
 * worse than no colour at all.
 */

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

/**
 * The statuses seen in practice, grouped by what the reader should do about
 * them: green is settled, amber is waiting, red needs attention.
 */
const TONES: Record<string, Tone> = {
  paid: "success",
  completed: "success",
  captured: "success",
  succeeded: "success",
  settled: "success",

  pending: "warning",
  processing: "warning",
  authorized: "warning",
  awaiting_payment: "warning",

  failed: "danger",
  declined: "danger",
  cancelled: "danger",
  canceled: "danger",
  expired: "danger",
  refunded: "info",
  reversed: "info",
}

/** `"Awaiting Payment"` and `"awaiting-payment"` both key as `awaiting_payment`. */
function key(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

/**
 * A label and a tone for any status string, recognised or not.
 *
 * The label passes the provider's own wording through, only title-cased — a
 * client dictionary cannot localise a string it has never seen, and inventing
 * a translation for an unknown status would be a guess printed as fact.
 */
export function paymentStatusMeta(
  t: Translator,
  status: string | null | undefined
): { label: string; tone: Tone } {
  if (!status?.trim()) {
    return { label: t("payments.unpaid"), tone: "neutral" }
  }
  return {
    label: humanize(key(status).replace(/_/g, "-")),
    tone: TONES[key(status)] ?? "neutral",
  }
}

/** Kept beside the tone map so a caller can render a status without a `t`. */
export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return formatText(null)
  return humanize(key(status).replace(/_/g, "-"))
}
