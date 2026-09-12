"use client"

import * as React from "react"

/**
 * `useState` that survives leaving the screen and coming back.
 *
 * A list screen's filters, sort, page and page size are work someone has
 * *done*: narrowing 4,000 cards to the eleven that matter, then paging to the
 * second. Opening one of those rows and pressing Back threw all of it away,
 * because every one of those values was plain component state and the
 * component unmounts on navigation.
 *
 * ```ts
 * const [statusFilter, setStatusFilter] = useStickyState<string[]>(
 *   `${LIST_KEY}:status`,
 *   []
 * )
 * ```
 *
 * ### Why storage rather than the query string
 *
 * Putting the state in the URL is the other way to do this, and it is the one
 * that survives a shared link — but it only restores on *browser* Back. Every
 * detail screen here goes back through a plain `<Link href="/id-issuance/requests">`
 * (request-detail.tsx), which pushes the bare path and would arrive with an
 * empty query. Storage restores regardless of how the screen is re-entered:
 * the browser's Back, a Back button in the page, a sidebar link, or a reload.
 *
 * ### Why `sessionStorage` rather than `localStorage`
 *
 * This is the state of one task in one tab, not a preference. A filter set
 * that outlived the browser session would have someone open the app tomorrow
 * to a list quietly narrowed by yesterday's question — the applied-filter
 * chips say so, but only if you read them before concluding the rows are
 * missing. The view toggle beside it *is* a preference and rightly stays in
 * `localStorage`.
 *
 * ### Read during render, not in an effect
 *
 * The stored value is read in the initialiser, so the first render is already
 * the restored one. Restoring in an effect instead would paint the unfiltered
 * list for a frame and — worse — fire a request for it, so every return from
 * a detail page would cost a wasted round trip before the real one.
 *
 * The cost is that the first client render can differ from the prerendered
 * HTML, which is exactly what the view-mode initialiser in these same
 * components has always done; React re-renders the subtree and moves on.
 *
 * Pass `undefined` as the key to opt out entirely — it then behaves as plain
 * `useState`, which is what lets `useListQuery` take an optional key without
 * calling hooks conditionally.
 */
export function useStickyState<T>(
  key: string | undefined,
  initial: T,
  options?: {
    /**
     * A value that outranks anything stored, for state that can also arrive
     * in the URL: `/organizations/users?organizationId=3` is a fresh
     * instruction from whoever built the link, and it should win over
     * whatever this tab happened to be filtered by before.
     *
     * `undefined` — the default — means storage wins. Call sites whose seed
     * is an empty string when absent should pass `seed || undefined`, so
     * "no parameter" does not read as "filter by nothing".
     */
    seed?: T
  }
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const seed = options?.seed
  const [value, setValue] = React.useState<T>(() => {
    const stored = read<T>(key)
    // `??` and not `||`: a stored `""`, `0` or `false` is a real value.
    return seed ?? stored ?? initial
  })

  // Writing in an effect rather than inside the setter keeps this a drop-in
  // for `useState` — functional updates included, since the value that lands
  // is whatever React settled on, not what the caller passed.
  React.useEffect(() => {
    if (key === undefined) return
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private mode, disabled storage, or over quota. The screen still works;
      // it just will not remember.
    }
  }, [key, value])

  return [value, setValue]
}

/** The stored value, or `undefined` when there is nothing usable to restore. */
function read<T>(key: string | undefined): T | undefined {
  // `typeof window` rather than a `try` alone: on the server there is no
  // `sessionStorage` to reach for at all.
  if (key === undefined || typeof window === "undefined") return undefined
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    // Unreadable storage, or a value left by an older shape of this screen.
    return undefined
  }
}
