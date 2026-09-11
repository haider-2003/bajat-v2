import { notFound } from "next/navigation"

/**
 * Catch-all that turns an unmatched URL into the 404 page.
 *
 * Next only hands an unmatched URL to a `not-found.tsx` that sits at the very
 * root of `app/` — and this app has none, because its root layout lives one
 * segment down in `app/[lang]`. So `/en/anything-misspelt` was falling
 * through to the framework's bare "This page could not be found" screen,
 * outside the theme, the fonts and the dictionary.
 *
 * `global-not-found.tsx` is the framework's answer for exactly this layout
 * (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md),
 * but it is experimental and, by design, renders outside the root layout —
 * every one of those things would have to be wired up a second time.
 *
 * This is the boring alternative. Anything under a locale that no real route
 * claims lands here, and `notFound()` hands it to the sibling
 * `not-found.tsx`, which renders *inside* the `[lang]` layout with everything
 * already in place. Real routes are always matched first, so adding one
 * never has to touch this file.
 */
export default function MissingPage() {
  notFound()
}
