import { NextResponse, type NextRequest } from "next/server"

import {
  LOCALE_COOKIE,
  defaultLocale,
  isLocale,
  locales,
  type Locale,
} from "@/i18n/config"

/**
 * Locale routing.
 *
 * ### Why this file is `proxy.ts` and not `middleware.ts`
 *
 * The `middleware` file convention is **deprecated in Next.js 16** and renamed
 * to `proxy` — same runtime, same `config.matcher`, same `NextRequest` /
 * `NextResponse`, only the file and the exported function name changed. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md.
 * Shipping a `middleware.ts` here would still run, on a deprecation warning,
 * until it doesn't.
 *
 * ### What it does
 *
 * Every route in this app lives under `app/[lang]`, so a URL without a locale
 * segment matches nothing. This puts one there:
 *
 *   1. `/ar/members` already names a locale — left alone.
 *   2. Otherwise the `NEXT_LOCALE` cookie decides, which is what the switcher
 *      in Settings writes. An explicit choice outranks the browser.
 *   3. Failing that, `Accept-Language` is negotiated against what we speak.
 *   4. Failing that, English — `defaultLocale`.
 *
 * The result is a **redirect**, not a rewrite: the locale needs to be in the
 * address bar so that a link someone copies carries the language they were
 * reading, and so `usePathname()` on the client agrees with the server.
 */

/**
 * Best supported match for an `Accept-Language` header.
 *
 * Hand-rolled rather than pulling in `negotiator` + `@formatjs/intl-localematcher`:
 * with two locales, the whole of the algorithm that matters is "sort by q, take
 * the first one whose primary subtag we speak". `ar-IQ`, `ar-EG` and bare `ar`
 * all have to land on Arabic, which is why the tag is cut at the first dash.
 */
function negotiate(header: string | null): Locale | null {
  if (!header) return null

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";")
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2)
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 }
    })
    // `*` means "anything", which tells us nothing about a preference.
    .filter((entry) => entry.tag && entry.tag !== "*" && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0]
    if (isLocale(primary)) return primary
  }
  return null
}

function resolveLocale(request: NextRequest): Locale {
  const stored = request.cookies.get(LOCALE_COOKIE)?.value
  if (isLocale(stored)) return stored
  return negotiate(request.headers.get("accept-language")) ?? defaultLocale
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
  if (hasLocale) return NextResponse.next()

  const locale = resolveLocale(request)

  // `nextUrl` is cloned rather than mutated in place so the search string and
  // the hash ride along untouched — a deep link into a filtered table has to
  // survive the redirect.
  const url = request.nextUrl.clone()
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`

  return NextResponse.redirect(url)
}

export const config = {
  /**
   * Everything except Next's own plumbing and anything that looks like a file.
   *
   * Without the file-extension escape a request for `/favicon.ico` would be
   * redirected to `/en/favicon.ico`, which does not exist — the doc's warning
   * about a matcher-less proxy blocking CSS, JS and images, one layer up.
   */
  matcher: ["/((?!_next/static|_next/image|api|.*\.[\w]+$).*)"],
}
