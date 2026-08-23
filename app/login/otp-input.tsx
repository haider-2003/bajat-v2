"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Six-digit code input — DESIGN.md §10.1.
 *
 * Each digit is its own 44x52 box carrying the standard input treatment
 * (8px radius, 1px border, accent border + 3px ring on focus). The mono face
 * and tabular figures keep the digits optically aligned (§3.1).
 *
 * Presentation only: typing moves focus and paste fans out across the boxes,
 * because a code field that does not do that is not really reviewable — but
 * nothing is submitted or validated.
 */

const LENGTH = 6

export function OtpInput({
  value,
  onChange,
  invalid,
  autoFocus,
}: {
  value: string
  onChange: (next: string) => void
  invalid?: boolean
  autoFocus?: boolean
}) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([])
  const digits = value.padEnd(LENGTH).slice(0, LENGTH).split("")

  const setAt = (i: number, char: string) => {
    const next = value.padEnd(LENGTH).split("")
    next[i] = char
    onChange(next.join("").trimEnd())
  }

  const handleChange = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, "")
    if (!only) return setAt(i, " ")

    if (only.length > 1) {
      // Paste or fast typing: spread across the remaining boxes.
      const next = value.padEnd(LENGTH).split("")
      for (let k = 0; k < only.length && i + k < LENGTH; k++) {
        next[i + k] = only[k]
      }
      onChange(next.join("").trimEnd())
      refs.current[Math.min(i + only.length, LENGTH - 1)]?.focus()
      return
    }

    setAt(i, only)
    refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i]?.trim() && i > 0) {
      refs.current[i - 1]?.focus()
    }
    if (e.key === "ArrowLeft") refs.current[i - 1]?.focus()
    if (e.key === "ArrowRight") refs.current[i + 1]?.focus()
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Verification code">
      {Array.from({ length: LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={digits[i]?.trim() ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus && i === 0}
          className={cn(
            "h-13 w-full min-w-0 rounded-lg border text-center",
            "font-mono text-lg font-semibold tabular-nums text-text",
            "bg-surface transition-colors duration-120 outline-none",
            "dark:bg-surface-sunken",
            invalid
              ? "border-danger focus-visible:ring-3 focus-visible:ring-danger/15"
              : cn(
                  "hover:border-border-strong",
                  // Focus matches §10.1: solid accent edge *and* a soft ring.
                  "focus-visible:border-accent-violet focus-visible:ring-3 focus-visible:ring-ring/45",
                  // A filled box holds a stronger edge than an empty one, so
                  // progress through the code is legible at a glance.
                  digits[i]?.trim() ? "border-border-strong" : "border-input"
                )
          )}
        />
      ))}
    </div>
  )
}
