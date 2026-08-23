"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  MessageSquareLock,
  ShieldCheck,
  Smartphone,
} from "lucide-react"

import { BajatMark } from "@/components/brand/bajat-mark"
import { signIn } from "@/lib/prototype-session"
import { Checkbox } from "@/components/ui/checkbox"
import { Input, InputGroup, InputGroupAddon } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { OtpInput } from "./otp-input"
import { PremiumButton } from "./premium-button"

/**
 * Bajat sign-in — three steps: credentials → SMS code → authenticator app.
 *
 * UI ONLY. Nothing is submitted, validated, or persisted; the step buttons
 * just move between screens so each state can be reviewed. Follows
 * DESIGN.md §10 (inputs 36px/8px radius, labels above at 13/500, 16px field
 * gap) and §20.2 (36px primary action, solid black / white).
 */

type Step = "credentials" | "otp" | "authenticator"

const STEPS: Step[] = ["credentials", "otp", "authenticator"]

/* ------------------------------------------------------------------ *
 * Field wrapper — label above, 6px gap, optional helper (§10.10)
 * ------------------------------------------------------------------ */

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-text-secondary"
        >
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
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

function Credentials({ onNext }: { onNext: () => void }) {
  const [show, setShow] = React.useState(false)

  return (
    <>
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-text">
          Sign in
        </h1>
        <p className="text-[13px] text-text-muted">
          Use the phone number registered with your organization.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        <Field label="Phone number" htmlFor="phone">
          {/* Country code is welded to the field, not a chip beside it:
              one control, so one border and one focus ring (§10.11). */}
          <InputGroup>
            <InputGroupAddon>
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
            />
          </InputGroup>
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={
            <Link
              href="/forgot-password"
              className="text-[13px] font-medium text-text-secondary underline-offset-4 hover:text-text hover:underline"
            >
              Forgot?
            </Link>
          }
        >
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              placeholder="••••••••••••"
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className={cn(
                "absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md",
                "text-text-muted transition-colors hover:bg-muted hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {show ? (
                <EyeOff className="size-4" strokeWidth={1.5} />
              ) : (
                <Eye className="size-4" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </Field>

        <label className="group/field-label flex w-fit cursor-pointer items-center gap-2 pt-0.5">
          <Checkbox defaultChecked />
          <span className="text-[13px] text-text-secondary">
            Keep me signed in
          </span>
        </label>
      </div>

      <PremiumButton className="mt-7 w-full" onClick={onNext}>
        Continue
      </PremiumButton>
    </>
  )
}

function Otp({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [code, setCode] = React.useState("")

  return (
    <>
      <StepIcon icon={MessageSquareLock} />

      <header className="mt-5 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-text">
          Verify your phone
        </h1>
        <p className="text-[13px] leading-relaxed text-text-muted">
          We sent a 6-digit code to{" "}
          <span className="font-mono text-text">+964 770 ••• 4567</span>.
        </p>
      </header>

      <div className="mt-8">
        <OtpInput value={code} onChange={setCode} autoFocus />
        <p className="mt-3 text-xs text-text-muted">
          Didn&apos;t get it?{" "}
          <button
            type="button"
            className="font-medium text-text underline-offset-4 hover:underline"
          >
            Resend code
          </button>{" "}
          <span className="text-text-placeholder">· available in 0:42</span>
        </p>
      </div>

      <PremiumButton className="mt-7 w-full" onClick={onNext}>
        Verify
      </PremiumButton>
      <BackLink onClick={onBack}>Use a different number</BackLink>
    </>
  )
}

function Authenticator({
  onDone,
  onBack,
}: {
  onDone: () => void
  onBack: () => void
}) {
  const [code, setCode] = React.useState("")

  return (
    <>
      <StepIcon icon={ShieldCheck} tone="accent" />

      <header className="mt-5 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-text">
          Two-factor authentication
        </h1>
        <p className="text-[13px] leading-relaxed text-text-muted">
          Enter the current code from your authenticator app.
        </p>
      </header>

      <div className="mt-8">
        <OtpInput value={code} onChange={setCode} autoFocus />

        {/* Helper card — §9.1 card metrics at a compact scale */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-background-subtle p-3">
          <Smartphone
            className="mt-0.5 size-4 shrink-0 text-text-muted"
            strokeWidth={1.5}
          />
          <p className="text-xs leading-relaxed text-text-muted">
            Open Google Authenticator, Authy, or your organization&apos;s app and
            use the code listed under{" "}
            <span className="font-medium text-text-secondary">Bajat</span>.
          </p>
        </div>
      </div>

      <PremiumButton className="mt-7 w-full" onClick={onDone}>
        Sign in
      </PremiumButton>

      <PremiumButton
        variant="soft"
        icon={KeyRound}
        className="mt-2.5 w-full"
        onClick={onDone}
      >
        Use a recovery code
      </PremiumButton>

      <BackLink onClick={onBack}>Back</BackLink>
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
      <ArrowLeft className="size-3.5" strokeWidth={1.5} />
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * Shell
 * ------------------------------------------------------------------ */

export function LoginForm() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>("credentials")

  // No auth yet: finishing the flow just flips the prototype flag and hands
  // over to the dashboard, so the whole app can be clicked through.
  const finish = React.useCallback(() => {
    signIn()
    router.push("/")
  }, [router])

  return (
    <div className="flex min-h-svh flex-col px-6 py-8 sm:px-10 lg:px-14">
      {/* Wordmark — only on small screens; the brand panel carries it on lg+ */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <BajatMark className="size-6 text-text" />
        <span className="text-base font-semibold tracking-[-0.01em] text-text">
          Bajat
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
            <Credentials onNext={() => setStep("otp")} />
          )}
          {step === "otp" && (
            <Otp
              onNext={() => setStep("authenticator")}
              onBack={() => setStep("credentials")}
            />
          )}
          {step === "authenticator" && (
            <Authenticator onDone={finish} onBack={() => setStep("otp")} />
          )}

          <div className="mt-10 flex items-center justify-between">
            <StepDots step={step} />
            <span className="text-xs text-text-placeholder">
              Step {STEPS.indexOf(step) + 1} of {STEPS.length}
            </span>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-placeholder">
        <span>© 2026 Bajat</span>
        <div className="flex items-center gap-4">
          <Link href="/support" className="hover:text-text-secondary">
            Support
          </Link>
          <Link href="/privacy" className="hover:text-text-secondary">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  )
}
