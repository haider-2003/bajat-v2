import type { User } from "@/features/users/types"

/** Request/response shapes for the sign-in flow. See docs/authentication.md §3. */

export type OTPInput = {
  phone: string
}

export type LoginInput = {
  phone: string
  otp: string
  captchaToken: string | null
}

/**
 * Both login steps return this shape, but only one token each:
 * `/auth/login` gives `tempToken`, `/auth/2fa/enable` gives `accessToken`.
 */
export type LoginResponse = {
  accessToken?: string
  tempToken?: string
  tokenType?: string
  expiresIn?: number
  user: User
}

export type TwoFactorSetupResponse = {
  secret: string
  /** Raw SVG markup, not a data URL — inline it or base64-encode it yourself. */
  qrCode: string
}

export type TotpVerifyInput = {
  otp: string
}

export type RecaptchaCheckResponse = {
  recaptchaRequired: boolean
}

/**
 * The error body auth endpoints return. `require_recaptcha` is deliberately
 * snake_case: it is read off a *rejected* response, which never passes through
 * the camelizing interceptor.
 */
export type AuthErrorBody = {
  message?: string
  errors?: Record<string, string[]>
  require_recaptcha?: boolean
}
