"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuthStore } from "@/features/auth/store"

/**
 * Client-side route guard. See docs/authentication.md §5.
 *
 * There is no server-side session, so protection lives here: the persisted
 * store is consulted after rehydration and anything unauthenticated is sent to
 * /login.
 */

/** Public paths. `[id]` marks a dynamic segment and matches any single value. */
const PUBLIC_ROUTES = ["/login", "/ids-templates-forms/[id]"]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (!route.includes("[")) return route === pathname
    const pattern = `^${route.replace(/\[[^\]]+\]/g, "[^/]+")}$`
    return new RegExp(pattern).test(pathname)
  })
}

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthed)
  const token = useAuthStore((s) => s.token)
  const router = useRouter()
  const pathname = usePathname()

  // The persisted store is empty on the first paint, so an un-gated check
  // would bounce an authenticated user straight back to /login. Waiting on
  // zustand's own rehydration signal — rather than guessing with an effect
  // tick — means the verdict is never passed on an empty store. Read through
  // `useSyncExternalStore` so the server snapshot is always false and SSR
  // agrees with the first client render (same pattern as theme-provider).
  const isHydrated = React.useSyncExternalStore(
    (onChange) => useAuthStore.persist.onFinishHydration(onChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false
  )

  React.useEffect(() => {
    if (!isHydrated) return
    if (isPublicRoute(pathname)) return
    if (!isAuthed || !token) router.replace("/login")
  }, [isAuthed, token, pathname, router, isHydrated])

  // Carries the page background so the wait is not a white flash.
  if (!isHydrated) return <div className="h-svh bg-background" />
  if (isPublicRoute(pathname)) return <>{children}</>
  if (isAuthed && token) return <>{children}</>

  // Rendering nothing while the redirect above runs.
  return <div className="h-svh bg-background" />
}
