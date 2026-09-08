/**
 * Locale contract — the one place that knows which languages exist.
 *
 * Everything else (the proxy, the `[lang]` layout, the switcher in Settings)
 * imports from here, so adding a third language is a change to this file plus
 * one more JSON dictionary rather than a hunt through the app.
 *
 * This module is imported by the proxy, which runs on the edge runtime, so it
 * must stay free of React, `next/*` and Node built-ins.
 */

export const locales = ["en", "ar"] as const

export type Locale = (typeof locales)[number]

/**
 * What an un-prefixed URL becomes when the visitor has no stored preference
 * and `Accept-Language` names nothing we speak.
 */
export const defaultLocale: Locale = "en"

/**
 * Where the choice is remembered. `NEXT_LOCALE` is the name Next.js itself
 * used for built-in i18n routing, so browsers arriving from an older build —
 * and any tooling that knows the convention — keep their language.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE"

/** A year. The preference is not session state; it is how someone reads. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

/**
 * Writing direction, applied to `<html dir>`.
 *
 * One attribute is most of RTL support in this codebase: the styling is
 * written almost entirely in logical properties (`ms-`, `pe-`, `start-`), and
 * those resolve against `dir` rather than needing a mirrored stylesheet.
 */
export const localeDir: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
}

/**
 * How each language names itself, and what it is called in English.
 *
 * The switcher shows the endonym: someone who cannot read the current
 * language still has to be able to find their own in the list, and "العربية"
 * is legible to them where "Arabic" is not.
 */
export const localeNames: Record<Locale, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  ar: { native: "العربية", english: "Arabic" },
}

/**
 * The BCP 47 tag handed to `Intl` — **not** what goes in `<html lang>`, which
 * stays the bare `en` / `ar`.
 *
 * The `-u-nu-latn` extension on Arabic is deliberate. `ar-IQ` defaults to
 * Eastern Arabic numerals (١٢٣), and this is a data product: a table of
 * IDs, phone numbers and page counts reads in Latin digits in both languages,
 * and `tabular-nums` only aligns a column when every row uses one set. So the
 * month names translate and the digits do not.
 */
export const localeTag: Record<Locale, string> = {
  en: "en-GB",
  ar: "ar-IQ-u-nu-latn",
}
