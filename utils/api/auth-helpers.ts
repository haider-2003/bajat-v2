import type { InternalAxiosRequestConfig } from "axios"

import { defaultLocale, isLocale } from "@/i18n/config"

/**
 * Token read and 401 handling for the Axios interceptors.
 *
 * The token is read from `localStorage` on *every* request rather than from
 * React state, so non-component code (interceptors, plain fetch helpers) can
 * authenticate too. See docs/authentication.md §2.
 */

/** Short-lived token issued by `POST /auth/login`, valid only for `/auth/2fa/*`. */
export const TEMP_TOKEN_KEY = "temp_token"

/** The persisted auth store — written by zustand's `persist({ name: "auth" })`. */
export const AUTH_STORAGE_KEY = "auth"

/** The shape zustand's persist middleware writes. */
type PersistedAuth = {
  state?: { token?: string | null }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null // SSR-safe: no localStorage on the server

  // The temp token wins while it exists — it is what authorizes the
  // half-authenticated TOTP calls. It MUST be cleared on success, or every
  // later request would keep sending it instead of the real access token.
  const tempToken = window.localStorage.getItem(TEMP_TOKEN_KEY)
  if (tempToken) return tempToken

  const authStorage = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!authStorage) return null

  try {
    const { state } = JSON.parse(authStorage) as PersistedAuth
    return state?.token ?? null
  } catch {
    // Corrupted entry — treat as signed out rather than throwing inside an
    // interceptor, where the error would surface as an opaque request failure.
    return null
  }
}

export function addAuthorizationHeader(config: InternalAxiosRequestConfig) {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

export function clearAuthStorage(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.localStorage.removeItem(TEMP_TOKEN_KEY)
}

/**
 * Global 401 handler. Feature code never handles 401 itself.
 *
 * A hard redirect (not `router.push`) is deliberate: it tears down every
 * in-memory cache and store, so no stale authenticated state survives.
 */
export function handleUnauthorizedResponse(): void {
  if (typeof window === "undefined") return

  // No token means nobody was signed in, so a 401 is just an unauthenticated
  // call — there is no session to tear down, and bouncing would strand anyone
  // on a public page (or loop on /login itself).
  const hadToken = getAuthToken() !== null
  clearAuthStorage()
  if (!hadToken) return

  // Every route lives under `app/[lang]`, so the sign-in page is `/en/login`
  // — never a bare `/login`. Comparing against the unprefixed path meant the
  // guard never matched: a 401 raised *on the login page* bounced anyway, to a
  // URL the proxy then had to redirect again. Two full page loads, each one
  // re-running the intro splash.
  const currentLocale = window.location.pathname.split("/")[1]
  const locale = isLocale(currentLocale) ? currentLocale : defaultLocale
  const loginPath = `/${locale}/login`

  if (window.location.pathname !== loginPath) {
    // A full page load is the point: router.push() would keep the React tree
    // alive, and with it every cached query belonging to the signed-out user.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = loginPath
  }
}
