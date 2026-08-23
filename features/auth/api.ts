import { useMutation, useQuery } from "@tanstack/react-query"
import { isAxiosError } from "axios"

import api from "@/api/client"
import type {
  AuthErrorBody,
  LoginInput,
  LoginResponse,
  OTPInput,
  RecaptchaCheckResponse,
  TotpVerifyInput,
  TwoFactorSetupResponse,
} from "./types"

/**
 * Auth endpoints. See docs/authentication.md §3.
 *
 * These are not a REST resource, so they skip `createApiFactory` and sit
 * directly on the shared Axios instance as plain React Query hooks.
 */

/** Step 1 — sends the SMS. 429 means the resend was rate-limited. */
export const useSendOTP = () =>
  useMutation({
    mutationFn: async (body: OTPInput): Promise<void> => {
      await api.post("/auth/send_otp", body)
    },
  })

/**
 * Step 2 — exchanges the SMS code for a **temp** token, not a session.
 * The flow always continues to the TOTP step.
 */
export const useLogin = () =>
  useMutation({
    mutationFn: async (data: LoginInput): Promise<LoginResponse> => {
      const response = await api.post("/auth/login", data)
      return response.data
    },
  })

/** Whether the OTP step must show a captcha. Cheap, so it runs on page load. */
export const useRecaptchaCheck = () =>
  useQuery({
    queryKey: ["recaptcha-check"],
    queryFn: async (): Promise<RecaptchaCheckResponse> => {
      const response = await api.get("/auth/recaptcha_check")
      return response.data
    },
    staleTime: Infinity,
    retry: false,
  })

/**
 * Step 3a — the enrolment QR, fetched only when the user has no authenticator
 * yet. Authorized by the temp token, which `getAuthToken` prefers automatically.
 */
export const use2FASetup = (enabled: boolean) =>
  useQuery({
    queryKey: ["2fa-setup"],
    queryFn: async (): Promise<TwoFactorSetupResponse> => {
      const response = await api.get("/auth/2fa/setup")
      return response.data
    },
    enabled,
    staleTime: Infinity, // the QR does not need refreshing
  })

/** Step 3b — the only call that returns a real `accessToken`. */
export const use2FAEnable = () =>
  useMutation({
    mutationFn: async (data: TotpVerifyInput): Promise<LoginResponse> => {
      const response = await api.post("/auth/2fa/enable", data)
      return response.data
    },
  })

export const useLogout = () =>
  useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post("/auth/logout")
    },
  })

/**
 * Pulls a human-readable message out of a rejected request.
 *
 * Error bodies never pass through the camelizing response interceptor, so the
 * keys here are the backend's own snake_case.
 */
export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback

  // The request never reached the server: DNS, CORS, offline.
  if (!error.response) return "Can't reach the server. Check your connection."

  const body = error.response.data as AuthErrorBody | undefined

  const firstFieldError = body?.errors
    ? Object.values(body.errors).flat().find(Boolean)
    : undefined

  return firstFieldError ?? body?.message ?? fallback
}

/** True when a failed login is asking the user to solve a captcha. */
export function requiresRecaptcha(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  return (error.response?.data as AuthErrorBody | undefined)?.require_recaptcha === true
}
