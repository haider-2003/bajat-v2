"use client"

import * as React from "react"
import {
  ArrowLeft,
  KeyRound,
  MessageSquareLock,
  ShieldCheck,
  Smartphone,
} from "lucide-react"

import { BajatMark } from "@/components/brand/bajat-mark"
import {
  getAuthErrorMessage,
  requiresRecaptcha,
  use2FAEnable,
  use2FASetup,
  useLogin,
  useSendOTP,
} from "@/features/auth/api"
import { useAuthStore } from "@/features/auth/store"
import type { User } from "@/features/users/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Input, InputGroup, InputGroupAddon } from "@/components/ui/input"
import { useT } from "@/i18n/context"
import { Link, useLocaleRouter } from "@/i18n/navigation"
import { TEMP_TOKEN_KEY } from "@/utils/api/auth-helpers"
import { cn } from "@/lib/utils"

import { LocaleToggle } from "./locale-toggle"

import { OtpInput } from "./otp-input"
import { PremiumButton } from "./premium-button"

/**
 * Bajat sign-in — three steps: credentials → SMS code → authenticator app.
 *
 * Wired to the real endpoints per docs/authentication.md §2:
 *   send_otp  →  login (returns a *temp* token)  →  2fa/enable (returns the
 *   session token). TOTP is not optional; the flow always runs all three.
 *
 * Layout follows DESIGN.md §10 (inputs 36px/8px radius, labels above at
 * 13/500, 16px field gap) and §20.2 (36px primary action, solid black / white).
 */

type Step = "credentials" | "otp" | "authenticator"

const STEPS: Step[] = ["credentials", "otp", "authenticator"]

/** Seconds before "Resend code" becomes available again. */
const RESEND_COOLDOWN = 60

/* ------------------------------------------------------------------ *
 * Phone handling
 * ------------------------------------------------------------------ */

/**
 * The field collects the local part; the API wants a full number.
 *
 * A leading zero is dropped because "0770…" and "770…" are the same subscriber
 * and users type both. If the backend turns out to want a different shape
 * (a leading "+", or the bare local number), this is the only place to change.
 */
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "")
  return `964${digits}`
}

/** Iraqi mobile numbers are 10 local digits (7XX XXX XXXX). */
function isPhoneComplete(input: string): boolean {
  return input.replace(/\D/g, "").replace(/^0+/, "").length === 10
}

/** "7701234567" → "+964 770 ••• 4567" */
function maskPhone(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "")
  if (digits.length < 7) return `+964 ${digits}`
  return `+964 ${digits.slice(0, 3)} ••• ${digits.slice(-4)}`
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/* ------------------------------------------------------------------ *
 * Field wrapper — label above, 6px gap (§10.10)
 * ------------------------------------------------------------------ */

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-text-secondary"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Error line — renders only on failure, so the resting layout is unchanged
 * ------------------------------------------------------------------ */

function FormError({ children }: { children?: string | null }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-4 text-[13px] leading-relaxed text-danger">
      {children}
    </p>
  )
}

/* ------------------------------------------------------------------ *
 * Step progress — three dots, current one widened (§14.3 dots)
 * ------------------------------------------------------------------ */

function StepDots({ step }: { step: Step }) {
  const index = STEPS.indexOf(step)
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            i === index ? "w-6 bg-text" : "w-1.5 bg-border-strong"
          )}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Steps
 * ------------------------------------------------------------------ */

function Credentials({
  phone,
  onPhoneChange,
  onNext,
  pending,
  error,
}: {
  phone: string
  onPhoneChange: (next: string) => void
  onNext: () => void
  pending: boolean
  error: string | null
}) {
  const t = useT()

  return (
    <>
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-text">
          {t("auth.signIn")}
        </h1>
        <p className="text-[13px] text-text-muted">
          {t("auth.credentialsHint")}
        </p>
      </header>

      <div className="mt-8 space-y-4">
        <Field label={t("auth.phoneLabel")} htmlFor="phone">
          {/* Country code is welded to the field, not a chip beside it:
              one control, so one border and one focus ring (§10.11). */}
          <InputGroup>
            {/* `dir="ltr"`: "IRQ +964" is a Latin token pair whose order is
                part of the number. An RTL row would otherwise render it
                reversed, as "964+ IRQ". */}
            <InputGroupAddon dir="ltr">
              {/* No flag emoji: Windows renders regional-indicator pairs as
                  bare letters ("IQ"), which reads as a rendering bug. */}
              <span className="text-[11px] font-semibold tracking-[0.06em] text-text-placeholder">
                IRQ
              </span>
              <span className="font-mono text-[13px] text-text">+964</span>
            </InputGroupAddon>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="770 123 4567"
              autoComplete="tel"
              className="font-mono"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pending) onNext()
              }}
            />
          </InputGroup>
        </Field>

        {/* No password box: `POST /auth/login` takes `{ phone, otp }` and
            nothing else (docs/authentication.md §2). The field that used to
            sit here was never submitted. */}
        <label className="group/field-label flex w-fit cursor-pointer items-center gap-2 pt-0.5">
          <Checkbox defaultChecked />
          <span className="text-[13px] text-text-secondary">
            {t("auth.keepSignedIn")}
          </span>
        </label>
      </div>

      <FormError>{error}</FormError>

      <PremiumButton
        className="mt-7 w-full"
        onClick={onNext}
        disabled={pending || !isPhoneComplete(phone)}
      >
        {pending ? t("auth.sendingCode") : t("common.continue")}
      </PremiumButton>
    </>
  )
}

function Otp({
  phone,
  onSubmit,
  onBack,
  onResend,
  pending,
  resending,
  error,
  resendIn,
}: {
  phone: string
  onSubmit: (code: string) => void
  onBack: () => void
  onResend: () => void
  pending: boolean
  resending: boolean
  error: string | null
  resendIn: number
}) {
  const t = useT()
  const [code, setCode] = React.useState("")
  const complete = code.trim().length === 6

  return (
    <>
      <StepIcon icon={MessageSquareLock} />

      <header className="mt-5 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-text">
          {t("auth.otpTitle")}
        </h1>
        {/* The number is `dir="ltr"` on purpose: a phone number is a Latin
            digit string whose order is part of its meaning, and an RTL
            paragraph would otherwise reorder the `+964` prefix to the far
            side of it. */}
        <p className="text-[13px] leading-relaxed text-text-muted">
          {t("auth.otpSentTo")}{" "}
          <span dir="ltr" className="font-mono text-text">
            {maskPhone(phone)}
          </span>
        </p>
      </header>

      <div className="mt-8">
        <OtpInput
          value={code}
          onChange={setCode}
          invalid={!!error}
          autoFocus
        />
        <p className="mt-3 text-xs text-text-muted">
          {t("auth.otpNotReceived")}{" "}
          <button
            type="button"
            onClick={onResend}
            disabled={resendIn > 0 || resending}
            className="font-medium text-text underline-offset-4 hover:underline"
          >
            {t("auth.resendCode")}
          </button>{" "}
          <span className="text-text-placeholder">
            {resendIn > 0
              ? t("auth.resendIn", { time: formatCountdown(resendIn) })
              : t("auth.resendNow")}
          </span>
        </p>
      </div>

      <FormError>{error}</FormError>

      <PremiumButton
        className="mt-7 w-full"
        onClick={() => onSubmit(code)}
        disabled={pending || !complete}
      >
        {pending ? t("auth.verifying") : t("auth.verify")}
      </PremiumButton>
      <BackLink onClick={onBack}>{t("auth.useDifferentNumber")}</BackLink>
    </>
  )
}

function Authenticator({
  onSubmit,
  onBack,
  pending,
  error,
}: {
  onSubmit: (code: string) => void
  onBack: () => void
  pending: boolean
  error: string | null
}) {
  const t = useT()
  const [code, setCode] = React.useState("")
  const complete = code.trim().length === 6

  return (
    <>
      <StepIcon icon={ShieldCheck} tone="accent" />

      <header className="mt-5 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-text">
          {t("auth.totpTitle")}
        </h1>
        <p className="text-[13px] leading-relaxed text-text-muted">
          {t("auth.totpHint")}
        </p>
      </header>

      <div className="mt-8">
        <OtpInput
          value={code}
          onChange={setCode}
          invalid={!!error}
          autoFocus
        />

        {/* Helper card — §9.1 card metrics at a compact scale */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-background-subtle p-3">
          <Smartphone
            className="mt-0.5 size-4 shrink-0 text-text-muted"
            strokeWidth={1.5}
          />
          <p className="text-xs leading-relaxed text-text-muted">
            {t("auth.totpAppHint", { app: "Bajat" })}
          </p>
        </div>
      </div>

      <FormError>{error}</FormError>

      <PremiumButton
        className="mt-7 w-full"
        onClick={() => onSubmit(code)}
        disabled={pending || !complete}
      >
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </PremiumButton>

      {/* No recovery-code endpoint exists yet (docs/authentication.md §9 lists
          every auth route). Left in place, inert, until one does. */}
      <PremiumButton
        variant="soft"
        icon={KeyRound}
        className="mt-2.5 w-full"
      >
        {t("auth.useRecoveryCode")}
      </PremiumButton>

      <BackLink onClick={onBack}>{t("common.back")}</BackLink>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

function StepIcon({
  icon: Icon,
  tone = "neutral",
}: {
  icon: React.ElementType
  tone?: "neutral" | "accent"
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-lg border",
        tone === "accent"
          ? "border-accent-border bg-accent-soft text-accent-violet"
          : "border-border bg-background-subtle text-text-secondary"
      )}
    >
      <Icon className="size-5" strokeWidth={1.5} />
    </span>
  )
}

function BackLink({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium",
        "text-text-muted transition-colors hover:text-text",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      )}
    >
      {/* "Back" points against the reading direction, so it turns around. */}
      <ArrowLeft data-flip-rtl className="size-3.5" strokeWidth={1.5} />
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * Shell
 * ------------------------------------------------------------------ */

export function LoginForm() {
  const t = useT()
  const router = useLocaleRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [step, setStep] = React.useState<Step>("credentials")
  const [phone, setPhone] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [resendIn, setResendIn] = React.useState(0)

  // Held from the login response so it can be paired with the access token
  // that only arrives at the end of the TOTP step.
  const [user, setUser] = React.useState<User | null>(null)

  const sendOtp = useSendOTP()
  const login = useLogin()
  const enable2FA = use2FAEnable()

  // Provisions the enrolment secret for a user who has no authenticator yet.
  // The QR it returns has nowhere to render in this screen — see the note in
  // the handover; the request still has to happen for `2fa/enable` to succeed.
  use2FASetup(step === "authenticator" && user?.tfaEnabled === false)

  // Resend cooldown.
  React.useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const requestOtp = React.useCallback(
    (options?: { advance?: boolean }) => {
      setError(null)
      sendOtp.mutate(
        { phone: normalizePhone(phone) },
        {
          onSuccess: () => {
            setResendIn(RESEND_COOLDOWN)
            if (options?.advance) setStep("otp")
          },
          onError: (err) => {
            setError(
              getAuthErrorMessage(
                err,
                t("auth.errors.sendFailed"),
                t("auth.errors.offline")
              )
            )
          },
        }
      )
    },
    [phone, sendOtp, t]
  )

  const verifyOtp = React.useCallback(
    (code: string) => {
      setError(null)
      login.mutate(
        { phone: normalizePhone(phone), otp: code, captchaToken: null },
        {
          onSuccess: (data) => {
            // Not a session yet — this token authorizes the 2FA calls only.
            if (data.tempToken) {
              localStorage.setItem(TEMP_TOKEN_KEY, data.tempToken)
            }
            setUser(data.user)
            setStep("authenticator")
          },
          onError: (err) => {
            setError(
              requiresRecaptcha(err)
                ? t("auth.errors.captchaRequired")
                : getAuthErrorMessage(
                    err,
                    t("auth.errors.badCode"),
                    t("auth.errors.offline")
                  )
            )
          },
        }
      )
    },
    [phone, login, t]
  )

  const verifyTotp = React.useCallback(
    (code: string) => {
      setError(null)
      enable2FA.mutate(
        { otp: code },
        {
          onSuccess: (data) => {
            // The temp token MUST go first: `getAuthToken` prefers it, so
            // leaving it behind would shadow the real session token forever.
            localStorage.removeItem(TEMP_TOKEN_KEY)

            const account = data.user ?? user
            if (data.accessToken && account) {
              setAuth(account, data.accessToken)
              router.push("/")
            } else {
              setError(t("auth.errors.noSession"))
            }
          },
          onError: (err) => {
            setError(
              getAuthErrorMessage(
                err,
                t("auth.errors.badCode"),
                t("auth.errors.offline")
              )
            )
          },
        }
      )
    },
    [enable2FA, router, setAuth, user, t]
  )

  const goBack = React.useCallback((to: Step) => {
    setError(null)
    setStep(to)
  }, [])

  return (
    <div className="flex min-h-svh flex-col px-6 py-8 sm:px-10 lg:px-14">
      {/* Wordmark — only on small screens; the brand panel carries it on lg+ */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <BajatMark className="size-6 text-text" />
        <span className="text-base font-semibold tracking-[-0.01em] text-text">
          {t("app.name")}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-12">
        {/* Rises once on arrival, held until the splash clears so it is not
            spent behind the overlay. One pass, no loop — the form is the
            task, not the show. */}
        <div
          data-await-intro=""
          className="w-full max-w-[380px] animate-[intro-rise_620ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          {step === "credentials" && (
            <Credentials
              phone={phone}
              onPhoneChange={(next) => {
                setPhone(next)
                setError(null)
              }}
              onNext={() => requestOtp({ advance: true })}
              pending={sendOtp.isPending}
              error={error}
            />
          )}
          {step === "otp" && (
            <Otp
              phone={phone}
              onSubmit={verifyOtp}
              onBack={() => goBack("credentials")}
              onResend={() => requestOtp()}
              pending={login.isPending}
              resending={sendOtp.isPending}
              error={error}
              resendIn={resendIn}
            />
          )}
          {step === "authenticator" && (
            <Authenticator
              onSubmit={verifyTotp}
              onBack={() => goBack("otp")}
              pending={enable2FA.isPending}
              error={error}
            />
          )}

          <div className="mt-10 flex items-center justify-between">
            <StepDots step={step} />
            <span className="text-xs text-text-placeholder">
              {t("auth.stepOf", {
                step: STEPS.indexOf(step) + 1,
                total: STEPS.length,
              })}
            </span>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-placeholder">
        <span>{t("auth.copyright", { year: 2026, name: t("app.name") })}</span>
        <div className="flex items-center gap-4">
          {/* Sign-in is outside the app shell, so Settings — and with it the
              language switcher — is unreachable from here. Someone served the
              wrong language by `Accept-Language` would have no way to fix it
              before authenticating, which is exactly the wrong moment to be
              stuck. */}
          <LocaleToggle />
          <Link href="/support" className="hover:text-text-secondary">
            {t("auth.support")}
          </Link>
          <Link href="/privacy" className="hover:text-text-secondary">
            {t("auth.privacy")}
          </Link>
        </div>
      </footer>
    </div>
  )
}
