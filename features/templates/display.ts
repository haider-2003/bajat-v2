import type { Translator } from "@/i18n/translate"
import { EMPTY_VALUE } from "@/utils/format"

import type { Template } from "./types"

/**
 * How a template's issuance terms read on screen.
 *
 * Presentation, but *this entity's* presentation — the gallery, the table and
 * the dialogs all have to agree on what `identityDuration: 0` means and what a
 * price of `"5000"` looks like, and a second copy of either is a second place
 * for them to drift. Same reasoning as features/ids/status.ts.
 *
 * Every helper here takes a possibly-thin row (see the note on `Template`) and
 * always returns something renderable.
 */

/**
 * Enabled / disabled, as the badge reads it.
 *
 * Takes the translator rather than calling a hook, because these are plain
 * functions called from column definitions and `useMemo` bodies where a hook
 * cannot go. Every caller already holds a `t`.
 */
export function templateStatus(
  t: Translator,
  template: Template
): {
  label: string
  tone: "success" | "neutral"
  enabled: boolean
} {
  // `isEnabled` is a *number*, so `=== 1` rather than a truthiness test — and
  // an absent one (a thin embedded copy) is not evidence of "disabled".
  const enabled = template.isEnabled !== 0
  return enabled
    ? { label: t("templates.enabled"), tone: "success", enabled: true }
    : { label: t("templates.disabled"), tone: "neutral", enabled: false }
}

/**
 * Latin grouped digits in both languages — see the note on `localeTag` in
 * i18n/config.ts. A price column has to stay column-aligned, and the currency
 * name is translated around it rather than the digits being re-scripted.
 */
const priceFmt = new Intl.NumberFormat("en-US")

/**
 * `"5000"` → `5,000 IQD`. Free templates say so in words.
 *
 * The value arrives as a **string** (docs/api-types.md § gotcha 6), and one
 * that is not a number — `""`, `null`, a stray label — is returned as a dash
 * rather than as `NaN IQD`.
 */
export function templatePrice(
  t: Translator,
  price: string | null | undefined
): string {
  if (price === null || price === undefined || String(price).trim() === "") {
    return EMPTY_VALUE
  }
  const amount = Number(price)
  if (!Number.isFinite(amount)) return EMPTY_VALUE
  if (amount === 0) return t("templates.free")
  return t("templates.priceIqd", { amount: priceFmt.format(amount) })
}

/**
 * Months until an issued card expires, in words.
 *
 * **`0` is not missing — it means the card never expires**
 * (docs/photo-editor-spec.md §15). Reading it as falsy is the bug this helper
 * exists to prevent: a permanent card would print as a dash.
 */
export function templateValidity(
  t: Translator,
  months: number | null | undefined
): string {
  if (months === null || months === undefined || !Number.isFinite(months)) {
    return EMPTY_VALUE
  }
  if (months <= 0) return t("templates.neverExpires")
  // Plural forms rather than a hand-written `=== 1` branch: English has two,
  // Arabic has six, and the dictionary picks the right one through
  // `Intl.PluralRules`. See `PluralForms` in i18n/translate.ts.
  if (months % 12 === 0) {
    const years = months / 12
    return t("templates.years", { count: years })
  }
  return t("templates.months", { count: months })
}

const countFmt = new Intl.NumberFormat("en-US")

/** How many identities have been cut from this design. Unknown reads as a dash. */
export function templateIssued(count: number | null | undefined): string {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return EMPTY_VALUE
  }
  return countFmt.format(count)
}

/** Which faces this template has artwork for. */
export function templateFaces(template: Template): ("front" | "back")[] {
  const faces: ("front" | "back")[] = []
  if (template.frontImage) faces.push("front")
  if (template.backImage) faces.push("back")
  return faces
}

/**
 * How an export job's `status` reads — a label and a tone that never come
 * back undefined, whatever the field holds.
 *
 * The backend has not published the vocabulary for this field, and in
 * practice it sends a **number** (a bare status code), not the string the
 * doc implied — the reference client never rendered it at all, so a failed
 * job looked exactly like a pending one (docs/IDS-FLOW-EXPORTS-ROUTES.md
 * §9.9). So:
 *
 *  - a word is matched loosely — `done`, `completed`, `finished` all read as
 *    finished; `failed`, `error` as failed; and so on;
 *  - a number, or anything unrecognised, is decided from `file` instead —
 *    the one fact the screen acts on — and the raw value is returned as
 *    `raw` so a cell can keep it on hover for whoever eventually maps the
 *    codes.
 *
 * A row whose status says "done" and whose `file` is empty is still not
 * downloadable, and the action reads `file`, not this.
 */
export function exportStatusMeta(
  t: Translator,
  status: string | number | boolean | null | undefined,
  hasFile: boolean
): {
  label: string
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "accent"
  /** The value as it arrived, for a tooltip. `null` when there was none. */
  raw: string | null
} {
  const raw = status === null || status === undefined ? null : String(status)
  const word = typeof status === "string" ? status.trim().toLowerCase() : ""

  if (/^(done|completed?|finished|success(ful)?|ready)$/.test(word)) {
    return { label: t("exports.status.ready"), tone: "success", raw }
  }
  if (/^(fail(ed|ure)?|error)$/.test(word)) {
    return { label: t("exports.status.failed"), tone: "danger", raw }
  }
  if (/^(processing|running|in[_ -]?progress|started)$/.test(word)) {
    return { label: t("exports.status.processing"), tone: "accent", raw }
  }
  if (/^(pending|queued|waiting|new)$/.test(word)) {
    return { label: t("exports.status.queued"), tone: "warning", raw }
  }

  // A word this list does not know still gets a badge with its own name on
  // it, de-shouted, rather than nothing.
  if (word && !/^[\d.]+$/.test(word)) {
    return {
      label: word.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      tone: "neutral",
      raw,
    }
  }

  // A code, or no status at all: the file is the only evidence there is.
  return hasFile
    ? { label: t("exports.status.ready"), tone: "success", raw }
    : { label: t("exports.status.queued"), tone: "warning", raw }
}
