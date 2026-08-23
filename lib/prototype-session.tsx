"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * Prototype sign-in gate.
 *
 * There is no auth yet. This is a stand-in so the app can be clicked through
 * end to end: the login screen is the default entry, and finishing it unlocks
 * the dashboard for the rest of the tab.
 *
 * Deliberately `sessionStorage`, not `localStorage` — the flag dies with the
 * tab, so a fresh tab always lands back on login and the sign-in flow stays
 * easy to re-test. Replace all of this the moment real auth lands; nothing
 * here is a security boundary, it is a navigation convenience.
 */

const KEY = "bajat-signed-in"

export function isSignedIn() {
  try {
    return sessionStorage.getItem(KEY) === "1"
  } catch {
    // Private mode: fail open, since this gates nothing that matters.
    return true
  }
}

export function signIn() {
  try {
    sessionStorage.setItem(KEY, "1")
  } catch {
    // Not persisting just means the next navigation bounces to login again.
  }
}

export function signOut() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

/**
 * Wraps the dashboard shell. Renders nothing until the check has run, so an
 * unauthenticated visitor never sees a frame of dashboard before the redirect.
 * The placeholder carries the page background so the swap is not a white flash.
 *
 * Read through `useSyncExternalStore` rather than mirrored into state via an
 * effect: `sessionStorage` is invisible to the server, so the server snapshot
 * is always `false` and SSR agrees with the first client render, which then
 * re-renders with the real value. Same pattern as `theme-provider`.
 */
const store = {
  // sessionStorage is per-tab and fires no cross-tab events, so there is
  // nothing to subscribe to; the value is re-read whenever the gate mounts.
  subscribe: () => () => {},
  get: () => isSignedIn(),
  getServer: () => false,
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const signedIn = React.useSyncExternalStore(
    store.subscribe,
    store.get,
    store.getServer
  )

  React.useEffect(() => {
    if (!signedIn) router.replace("/login")
  }, [signedIn, router])

  if (!signedIn) return <div className="h-svh bg-background" />
  return <>{children}</>
}
