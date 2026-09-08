"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * A node's colour: a row of presets, a native picker, and the hex itself.
 *
 * ### Why not `SwatchPicker`
 *
 * `components/ui/swatch-picker.tsx` picks from a *closed* set — it paints each
 * tile with that hue's §7.4 gradient tone, which only exists for the seven
 * accents the design system ships. A node's colour is free-form `#RRGGBB` the
 * backend stores verbatim, so a closed picker would either refuse colours the
 * API accepts or claim a tone it has no gradient for.
 *
 * ### Three ways in, because they answer different questions
 *
 * The presets are for "give me one that looks right and is not already taken"
 * — they are §2's own palette, so a node picked from them matches the app.
 * The native picker is for "I have a brand colour in mind". The text field is
 * for "the brand colour is #2F9E44 and I am pasting it".
 *
 * All three write the same state, and the text field is the one that holds it:
 * a value typed halfway (`#2F9`) has to survive the keystroke that follows,
 * which it would not if the field re-derived itself from a validated colour.
 */

/**
 * §2's accents, as hexes rather than tokens.
 *
 * Deliberately literal: this value is *sent to the backend* and stored on the
 * row, so it has to be a colour and not a reference to one. A `var(--info)`
 * here would be written into the database and render as nothing everywhere the
 * stylesheet is not — the print pipeline included.
 */
const PRESETS = [
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#0D9488",
  "#0891B2",
  "#525252",
] as const

/** The wire format: six digits, hash included. Short form is not accepted. */
export const HEX_PATTERN = /^#[0-9A-F]{6}$/i

/** Normalises what was typed onto the stored spelling, or `null` if it is not one. */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`
  // Uppercased so two nodes that are the same colour compare equal — the
  // backend stores what it is sent, and `#2f9e44` next to `#2F9E44` in a list
  // reads as two colours.
  return HEX_PATTERN.test(withHash) ? withHash.toUpperCase() : null
}

export function ColorField({
  value,
  onChange,
  disabled = false,
  id,
  ...aria
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
}) {
  const t = useT()

  /** What the native picker shows. It rejects anything that is not a full hex. */
  const picked = normalizeHex(value) ?? "#000000"

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        {/* The native input is the swatch: a `color` input renders as its own
            value, so wrapping it in a painted box would draw the colour twice
            and the two would disagree while the field is mid-edit. */}
        <label
          className={cn(
            "relative size-11 shrink-0 overflow-hidden rounded-lg border border-input md:size-9",
            "focus-within:border-accent-violet focus-within:ring-2 focus-within:ring-ring/45",
            disabled && "opacity-50"
          )}
        >
          <span className="sr-only">{t("nodes.form.colorLabel")}</span>
          <input
            type="color"
            value={picked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            // The control is the label's box; the input itself is oversized and
            // clipped so no browser's default padding shows as a white rim.
            className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0"
          />
        </label>

        <Input
          {...aria}
          id={id}
          dir="ltr"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#2F9E44"
          autoComplete="off"
          spellCheck={false}
          // Mono and uppercase, matching the table's colour column.
          className="h-11 font-mono text-base uppercase md:h-9 md:text-sm"
        />
      </div>

      {/* §2's palette. A radio group in behaviour but not in markup: these are
          shortcuts that write the field below, and the field is the value. */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const active = normalizeHex(value) === preset
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset)}
              aria-label={preset}
              aria-pressed={active}
              style={{ backgroundColor: preset }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                // The rim keeps a light preset visible on the surface.
                "ring-1 ring-inset ring-black/10",
                "transition-transform duration-120 outline-none",
                "motion-safe:hover:-translate-y-px",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {/* White clears AA on every preset here by construction. */}
              {active && (
                <Check className="size-3.5 text-white" strokeWidth={2.5} aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
