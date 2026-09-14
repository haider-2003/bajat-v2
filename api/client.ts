import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios"
import { decamelizeKeys } from "xcase"

import { addAuthorizationHeader, handleUnauthorizedResponse } from "@/utils/api/auth-helpers"
import { transformRequestKeys, transformResponseKeys } from "@/utils/api/key-conversion"

/**
 * The single shared Axios instance. Everything the app sends goes through here.
 * See docs/network-layer.md §2.
 *
 * Components do not import this for normal CRUD — they import hooks from
 * `features/<feature>/api.ts`, which sit on top of the API factory. Reach for
 * `api` directly only for non-REST endpoints, binaries, and public calls.
 */

const PRODUCTION_API_BASE_URL = "https://identities.g4t.io/api/dashboard/v1/"

/**
 * Overridable so staging/local backends do not need a code change. The default
 * is the production dashboard API.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a key that exists but is
 * blank in the build environment inlines as `""`, and `??` would pass that
 * straight through. Axios treats a falsy `baseURL` as "no base" and leaves the
 * relative endpoint path untouched, so the browser resolves it against the
 * current page — `auth/send_otp` posts to `/<lang>/auth/send_otp` on our own
 * origin instead of the API. Blank has to count as unset.
 */
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()

export const API_BASE_URL = configuredApiBaseUrl || PRODUCTION_API_BASE_URL

const baseConfig: AxiosRequestConfig = {
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
}

const api: AxiosInstance = axios.create(baseConfig)

// ─── Request ────────────────────────────────────────────────────────────────
// camelCase → snake_case on the body and the query string, then the token.
api.interceptors.request.use((config) => {
  if (config.data) {
    config.data = transformRequestKeys(config.data, {
      skipConversion: config.options?.skipRequestKeyConversion,
      preserveNestedFormDataKeys: config.options?.preserveNestedFormDataKeys,
    })
  }

  if (config.params) {
    config.params = decamelizeKeys(config.params)
  }

  return addAuthorizationHeader(config)
})

// ─── Response ───────────────────────────────────────────────────────────────
// snake_case → camelCase, and a global 401 → logout.
api.interceptors.response.use(
  (response) => {
    // Never rewrite bytes: a blob or arraybuffer is a file, not a JSON body.
    const isBinaryResponse =
      response.config.responseType === "blob" ||
      response.config.responseType === "arraybuffer"

    if (!isBinaryResponse) {
      response.data = transformResponseKeys(
        response.data,
        response.config.options?.skipResponseKeyConversion,
      )
    }

    return response
  },
  (error) => {
    // 401 is handled once, here — feature code never handles it.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      handleUnauthorizedResponse()
    }
    return Promise.reject(error)
  },
)

export default api
