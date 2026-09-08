import type { TranslationKey, Translator } from "@/i18n/translate"
import { formatText } from "@/utils/format"

import type { MemberStatus } from "./types"

/**
 * How a member request's status is labelled and toned.
 *
 * This is presentation, but it is *this entity's* presentation — every screen
 * that shows a member request needs the same three labels and the same three
 * tones, so it belongs with the entity rather than with any one screen.
 *
 * Everything here is derived from the API's three real statuses
 * (docs/api-types.md § members-requests); the six-status flow this screen was
 * prototyped against does not exist on the backend.
 */
export const STATUS_META: Record<
  MemberStatus,
  {
    /** A dictionary key — see the note in features/ids/status.ts. */
    labelKey: TranslationKey
    tone: "info" | "success" | "danger"
  }
> = {
  pending: { labelKey: "status.requests.pending", tone: "info" },
  approved: { labelKey: "status.requests.approved", tone: "success" },
  rejected: { labelKey: "status.requests.rejected", tone: "danger" },
}

/** Order used when grouping by status (DESIGN.md §8.4). */
export const STATUS_ORDER: MemberStatus[] = ["pending", "approved", "rejected"]

/**
 * Status metadata that never returns undefined.
 *
 * An unrecognised status still gets a readable label rather than crashing on
 * `meta.tone` — the backend can add one before the frontend knows about it.
 */
export function statusMeta(
  t: Translator,
  status: MemberStatus | string | null | undefined
) {
  if (status && status in STATUS_META) {
    const meta = STATUS_META[status as MemberStatus]
    return { label: t(meta.labelKey), tone: meta.tone }
  }
  return {
    label: formatText(typeof status === "string" ? status : null),
    tone: "info" as const,
  }
}
