"use client"

import * as React from "react"
import NextLink from "next/link"
import { usePathname, useRouter } from "next/navigation"

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  defaultLocale,
  locales,
  type Locale,
} from "./config"
import { useLocale } from "./context"
import { localeOf, localizeHref, stripLocale } from "./href"

/**
 * Locale-aware routing, for **Client Components**.
 *
 * Every route lives under `/[lang]`, so a bare `/members` is not a real URL —
 * it is `/en/members` or `/ar/members`. Rather than spell the prefix into each
 * call site, the app keeps writing bare paths and these helpers add it.
 *
 * The path arithmetic itself lives in ./href.ts, which has no React in it, so
 * the server-side `LocaleLink` (./link.tsx) can share exactly the same rules.
 *
 * Two consequences worth knowing:
 *
 *  - `usePathname()` returns the **prefixed** path. Anything comparing it to a
 *    nav href (`pathname === item.href`) must use `useLocalePathname()`, which
 *    strips the prefix back off, or every nav item reads as inactive.
 *  - Absolute URLs, `mailto:`, `tel:` and in-page anchors are passed through
 *    untouched — prefixing those would break them.
 */

/**
 * The current path with the locale removed — what nav highlighting compares
 * against, and what the language switcher re-prefixes.
 */
export function useLocalePathname(): string {
  return stripLocale(usePathname())
}

/**
 * `next/link` with the locale already on it.
 *
 * A drop-in replacement: change the import and nothing at the call site moves.
 * `href` objects are supported by localizing `pathname`, which is the only
 * part of the object a prefix belongs on.
 */
export function Link({
  href,
  ...props
}: Omit<React.ComponentProps<typeof NextLink>, "href"> & {
  href: string | { pathname: string; query?: Record<string, string> }
}) {
  const locale = useLocale()
  const localized =
    typeof href === "string"
      ? localizeHref(href, locale)
      : { ...href, pathname: localizeHref(href.pathname, locale) }

  return <NextLink href={localized} {...props} />
}

/**
 * `useRouter()` whose `push` / `replace` take bare paths.
 *
 * The other methods are passed through as-is: `back`, `forward` and `refresh`
 * have no path to localize.
 */
export function useLocaleRouter() {
  const router = useRouter()
  const locale = useLocale()

  return React.useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(localizeHref(href, locale), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(localizeHref(href, locale), options),
    }),
    [router, locale]
  )
}

/**
 * Switches language in place — same screen, same query string, other tongue.
 *
 * Two things have to happen together, and both matter:
 *
 *  1. The URL is rewritten to the other prefix. This is the actual switch.
 *  2. The choice is written to `NEXT_LOCALE`, which is what the proxy reads on
 *     the next visit to an un-prefixed URL. Without it, a reader who picked
 *     Arabic lands back on English every time they open the bare domain.
 *
 * `router.replace` rather than `push`: the same page in another language is
 * not a place you should be able to go "back" from into the language you just
 * left.
 */
export function useSwitchLocale() {
  const router = useRouter()
  const pathname = usePathname()

  return React.useCallback(
    (next: Locale) => {
      const bare = stripLocale(pathname)
      document.cookie = [
        `${LOCALE_COOKIE}=${next}`,
        "path=/",
        `max-age=${LOCALE_COOKIE_MAX_AGE}`,
        "samesite=lax",
      ].join("; ")

      const search = window.location.search
      const target = bare === "/" ? `/${next}` : `/${next}${bare}`
      router.replace(`${target}${search}`)
      // The dictionary is server data, so the tree has to be re-fetched for
      // the new one to arrive; `replace` alone would reuse the cached RSC
      // payload and leave the old language on screen.
      router.refresh()
    },
    [pathname, router]
  )
}

export { localeOf, localizeHref, stripLocale }
export { defaultLocale, locales, type Locale }
