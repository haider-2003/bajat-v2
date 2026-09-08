"use client"

import * as React from "react"

import { defaultLocale, localeDir, type Locale } from "./config"
import { createTranslator, type Dictionary, type Translator } from "./translate"

/**
 * Translations for Client Components.
 *
 * Almost every screen in this app is a client component — the tables, the
 * filters, the dialogs and the photo editor all hold state — so the dictionary
 * cannot live on the server alone. `app/[lang]/layout.tsx` loads it once per
 * request and hands it to this provider, which is the only copy the client
 * ever holds.
 *
 * ### Why the whole dictionary, rather than per-screen slices
 *
 * Splitting it by feature would save a few kilobytes and cost a category of
 * bug: a shared component (`TableView`, `Pagination`, `FilterSheet`) has no
 * idea which screen mounted it, so it would have to be told which slice it is
 * allowed to read. One object means any component can ask for any string.
 *
 * ### Why context and not a module-level store
 *
 * The locale is per-request data. A module singleton is per-process, which is
 * the same object for two users being rendered concurrently on the server.
 */

type I18nValue = {
  locale: Locale
  /** `"rtl"` under Arabic. Mirrors `<html dir>`; handy for JS-side layout. */
  dir: "ltr" | "rtl"
  dict: Dictionary
  t: Translator
}

const I18nContext = React.createContext<I18nValue | null>(null)

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale
  dict: Dictionary
  children: React.ReactNode
}) {
  const value = React.useMemo<I18nValue>(
    () => ({
      locale,
      dir: localeDir[locale],
      dict,
      t: createTranslator(dict, locale),
    }),
    [locale, dict]
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n(): I18nValue {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>")
  return ctx
}

/**
 * `const t = useT()` — the call every client component makes.
 *
 * Same signature as the server's `await getTranslations()`, so a component can
 * cross the boundary without its strings changing.
 */
export function useT(): Translator {
  return useI18n().t
}

/** The active locale on its own, for components that only need to branch. */
export function useLocale(): Locale {
  return React.useContext(I18nContext)?.locale ?? defaultLocale
}

/** `"rtl"` / `"ltr"`, for the few places CSS logical properties cannot reach. */
export function useDir(): "ltr" | "rtl" {
  return React.useContext(I18nContext)?.dir ?? "ltr"
}
