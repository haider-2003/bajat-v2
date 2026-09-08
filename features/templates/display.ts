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
