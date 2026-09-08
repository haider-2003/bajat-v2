import { isLocale, locales, type Locale } from "./config"

/**
 * Path helpers with no React in them.
 *
 * They live apart from ./navigation.tsx because that file is `"use client"`,
 * and the server-side `LocaleLink` needs the same `localizeHref`. A client
 * module cannot be imported from a server component, so the shared half is
 * here and both sides re-use it.
 */

/** `/en/members` → `/members`. A bare or unknown-prefixed path is unchanged. */
export function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/"
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1)
    }
  }
  return pathname
}

/** The locale a path is already prefixed with, if any. */
export function localeOf(pathname: string): Locale | null {
  const first = pathname.split("/")[1]
  return isLocale(first) ? first : null
}

function isExternal(href: string): boolean {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("//") ||
    href.startsWith("#")
  )
}

/** `/members` → `/ar/members`. Idempotent, so double-prefixing is impossible. */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || isExternal(href)) return href
  const stripped = stripLocale(href)
  return stripped === "/" ? `/${locale}` : `/${locale}${stripped}`
}
