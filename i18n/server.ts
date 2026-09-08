/**
 * Translations for Server Components.
 *
 * `lang` is a **root param** — every route in this app lives under
 * `app/[lang]`, so the segment sits above the root layout and Next exposes a
 * getter for it. That is what lets a server-side helper read the locale
 * without the page it was called from having to pass `params` down (see
 * node_modules/next/dist/docs/01-app/02-guides/internationalization.md,
 * "Sharing the locale across your app").
 *
 * These do not work in Client Components, Server Actions or Route Handlers.
 * Client code reads the locale from `<I18nProvider>` instead — see
 * ./context.tsx.
 */

import { lang } from "next/root-params"
import { notFound } from "next/navigation"

import { defaultLocale, isLocale, type Locale } from "./config"
import { getDictionary } from "./dictionaries"
import { createTranslator, type Dictionary, type Translator } from "./translate"

/**
 * The locale of the request being rendered.
 *
 * The proxy only ever routes to a real locale, so an unknown value here means
 * someone typed `/de/members` by hand — a 404, not a silent fall back to
 * English on a URL that promised German.
 */
export async function getLocale(): Promise<Locale> {
  const value = await lang()
  if (value === undefined) return defaultLocale
  if (!isLocale(value)) notFound()
  return value
}

export async function getServerDictionary(): Promise<Dictionary> {
  return getDictionary(await getLocale())
}

/**
 * `const t = await getTranslations()` — then `t("nav.settings")`, exactly as a
 * client component would call it.
 */
export async function getTranslations(): Promise<Translator> {
  const locale = await getLocale()
  return createTranslator(await getDictionary(locale), locale)
}
