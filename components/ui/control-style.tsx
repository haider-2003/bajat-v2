"use client"

import * as React from "react"

/**
 * TEMPORARY — the surface treatment A/B, shared app-wide.
 *
 * The material every solid control is made of: the sidebar's active nav chip,
 * the toolbar's filter buttons, the date picker, and every `Button` variant
 * that has a face. They switch together, at runtime, from Settings →
 * Appearance — the point being to judge a treatment against the whole screen
 * in both themes rather than one chip in isolation.
 *
 * `raised` is DESIGN.md §7.4's recipe over a light secondary face; `ink` is
 * that recipe on both halves — the login route's `PremiumButton` material.
 * `flat` is §7.2, what the nav shipped with (§5.4).
 *
 * All three carry the brand colour; they differ in the material, not in
 * whether they are allowed a hue. Flat tints the fill (§14.2), raised and ink
 * tone the §7.4 gradient.
 *
 * ### Two faces, not one
 *
 * `solid` is the primary action; `face` is everything else with a surface
 * (secondary, toolbar, the active nav chip). They are separate because a
 * primary button has to outrank the toolbar it sits in — under `raised` the
 * primary takes the tone and the toolbar stays light, and only under `ink` do
 * both become the tone.
 *
 * ### Why colour is not in here
 *
 * These strings used to hardcode `#ffffff → #f4f4f5` and `#2a2a2f → #131316`
 * into the gradients, which meant a control could be *either* styled or
 * coloured, never both: choosing an accent repainted a button with `--primary`
 * and it silently dropped out of the treatment.
 *
 * §7.4 already legislates the fix — "colour lives in **four custom
 * properties**, never in the shadow stack. A tone restates only these four
 * values, so every tone inherits an identical highlight, rim, lift, and press
 * feel." So the tone is `--pb-top/mid/bot/rim`, set in globals.css from the
 * accent and primary-strategy choices, and the recipes below reference those
 * and never a literal hue.
 *
 * ### Why the default is `raised`, not `flat`
 *
 * `flat` is a **white** face. That reads as a chip on the sidebar's grey rail,
 * which is the only place it was ever used — but the toolbar sits on the white
 * content panel, where a white face on a white ground is barely a control at
 * all. `raised` carries its own rim and lift, so it holds up on either ground.
 *
 * Every face is built from `box-shadow` (an inset rim rather than a border), so
 * switching never shifts a control's height or nudges a label by a pixel.
 *
 * Delete this file and the "Control style" row in Settings → Appearance once a
 * winner is picked, then fold the winning classes into the components that use
 * them.
 */

export type ControlStyle = "flat" | "raised" | "ink"

export const CONTROL_STYLES: ControlStyle[] = ["flat", "raised", "ink"]

export const DEFAULT_STYLE: ControlStyle = "raised"

/**
 * The §7.4 tone face — three gradient stops and a rim, every one of them a
 * custom property. This single string is the *only* place a solid control's
 * colour comes from, which is what lets the accent change without the
 * treatment falling apart.
 *
 * The label is a property too, and it is §7.4's #F7F7F8 on every tone. That is
 * a constraint on the *tone*, not the label: each one is darkened until white
 * clears 4.5:1 on all three of its stops, rather than the label flipping to
 * near-black on the paler hues. See the tone block in globals.css.
 */
const TONE_FACE =
  "bg-[linear-gradient(180deg,var(--pb-top)_0%,var(--pb-mid)_52%,var(--pb-bot)_100%)] text-[var(--pb-label)]"

/**
 * §7.4's depth layers at control scale: top highlight, contact shadow, soft
 * lift. Achromatic, so it composes over any tone.
 *
 * ### No rim in light mode
 *
 * §7.4 calls the rim load-bearing — "defines the silhouette against a light
 * page" — and specifies it *always darker than the bottom stop*. At button
 * scale on a saturated tone that is a near-black outline: pink's rim is
 * `#6E0D24`, which is what it looks like drawn 1px around a `#C61741` face.
 * The tone is already high-contrast against a white panel, so the silhouette
 * needs no help and the rim was only adding a hard edge.
 *
 * Dark mode keeps it, because there `--pb-rim` is `rgba(255,255,255,0.12)` — a
 * *lightening* edge. On a near-black page shadows are invisible (§16.1) and
 * that edge is what separates the control from the ground.
 */
const TONE_DEPTH = [
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(12,12,16,0.32),0_4px_10px_-3px_rgba(12,12,16,0.26)]",
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(12,12,16,0.34),0_6px_16px_-4px_rgba(12,12,16,0.34)]",
  "dark:shadow-[inset_0_0_0_1px_var(--pb-rim),inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.5)]",
  "dark:hover:shadow-[inset_0_0_0_1px_var(--pb-rim),inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_rgba(0,0,0,0.55)]",
].join(" ")

/** The tone surface: face plus depth. Used by `solid`, and by `ink`'s `face`. */
const TONE_SURFACE = `${TONE_FACE} ${TONE_DEPTH}`

/**
 * §7.4's `soft` companion — the white secondary that belongs to the same
 * family. Neutral by design: this is the ground a tone has to *stand out
 * from*, so it takes surface tokens rather than the tone properties.
 */
const SOFT_SURFACE = [
  "bg-[linear-gradient(180deg,var(--soft-top)_0%,var(--soft-mid)_55%,var(--soft-bot)_100%)] text-text",
  "shadow-[inset_0_0_0_1px_var(--border),inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(12,12,16,0.07),0_3px_8px_-3px_rgba(12,12,16,0.10)]",
  "hover:shadow-[inset_0_0_0_1px_var(--border-strong),inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_-1px_rgba(12,12,16,0.10)]",
  "dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.055)_100%)]",
  "dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.10)]",
  "dark:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.10)]",
].join(" ")

/**
 * The three forms `flat` can take.
 *
 * All three are the *same* colour question answered by `--ctl-face-*` in
 * globals.css — which already resolves to §5.4's white chip under a neutral
 * primary and §14.2's accent tint under an accent one. What differs here is
 * only the **form**: where that colour lands. So a flat variant costs three
 * class strings and no new tokens, and every one of them tracks the accent.
 *
 *  - `tinted` — the pale fill (§14.2's accent badge). The quiet default.
 *  - `solid` — the fill the *primary* uses, so the whole toolbar carries the
 *    hue at full strength. Ink's loudness without ink's gradient and lift.
 *  - `outline` — no fill at all, hue label inside a hue hairline. §7.2's
 *    secondary button rendered in the brand colour instead of neutral.
 *
 * `outline` deliberately keeps no shadow: a shadow around a transparent face
 * reads as a floating rectangle rather than an outlined control.
 */
export type FlatVariant = "tinted" | "solid" | "outline"

export const FLAT_VARIANTS: FlatVariant[] = ["tinted", "solid", "outline"]

export const DEFAULT_FLAT: FlatVariant = "tinted"

const FLAT_FACES: Record<
  FlatVariant,
  { face: string; faceText: string; muted: string }
> = {
  tinted: {
    face: [
      "bg-[var(--ctl-face-bg)] text-[var(--ctl-face-fg)]",
      "shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-[var(--ctl-face-rim)]",
      "dark:shadow-none",
    ].join(" "),
    faceText: "text-[var(--ctl-face-fg)]",
    muted: "text-[var(--ctl-face-muted)]",
  },
  solid: {
    face: "bg-primary text-primary-foreground hover:bg-primary/90",
    faceText: "text-primary-foreground",
    muted: "text-primary-foreground/70",
  },
  outline: {
    face: [
      "bg-transparent text-[var(--ctl-face-fg)] ring-1 ring-[var(--ctl-face-rim)]",
      "hover:bg-[var(--ctl-face-bg)]",
    ].join(" "),
    faceText: "text-[var(--ctl-face-fg)]",
    muted: "text-[var(--ctl-face-muted)]",
  },
}

export type ControlSurface = {
    /**
     * The primary action's material. Carries the brand tone, so it follows
     * both the accent hue and the primary strategy.
     */
    solid: string
    /**
     * Everything else with a surface — secondary buttons, toolbar controls,
     * the active nav chip.
     */
    face: string
    /**
     * Just the label colour `face` carries, with none of its fill.
     *
     * The sidebar's travelling highlight paints `face` on an element of its
     * own, behind the rows, so the row it lands on needs the matching text
     * colour without a second background stacked under the first.
     */
    faceText: string
    /**
     * The muted half of a two-tone label (§6.6) on `face`.
     *
     * On a *tone* this is the label itself, not a dimmed version of it. §6.6
     * mutes the attribute half against a white toolbar, where the step from
     * `--text` to `--text-secondary` is a legible hierarchy. On a saturated
     * face the same step just reads as washed-out text — the labels on a row
     * of coloured filter buttons looked grey rather than white. Weight and
     * position carry the hierarchy there instead.
     */
    muted: string
  /** The same, on `solid`. */
  solidMuted: string
}

export const CONTROL_SURFACE: Record<ControlStyle, ControlSurface> = {
  // §7.2 as written: a flat fill, no gradient, no lift.
  //
  // Both halves still take colour — the fill *is* the colour here, which is
  // the only place a hue can live once the gradient and shadow are gone. The
  // primary rides `--primary`; the face is one of the three forms below.
  // Flat means flat, not colourless.
  flat: {
    solid: "bg-primary text-primary-foreground hover:bg-primary/90",
    ...FLAT_FACES[DEFAULT_FLAT],
    solidMuted: "text-primary-foreground/65",
  },
  // The tone for the primary, §7.4's `soft` companion for everything else —
  // so a primary button still reads as the loudest thing in a toolbar.
  raised: {
    solid: TONE_SURFACE,
    face: SOFT_SURFACE,
    faceText: "text-text",
    muted: "text-text-secondary",
    solidMuted: "text-[var(--pb-label)]",
  },
  // The tone on both halves: every solid control is made of the same material.
  ink: {
    solid: TONE_SURFACE,
    face: TONE_SURFACE,
    faceText: "text-[var(--pb-label)]",
    muted: "text-[var(--pb-label)]",
    solidMuted: "text-[var(--pb-label)]",
  },
}

/* ------------------------------------------------------------------ *
 * The store
 *
 * A module-level store read through `useSyncExternalStore` rather than a
 * context provider. Two reasons:
 *
 *  - **No provider to be outside of.** A context would hand any component
 *    rendered above it — or in a portal, or on the login route — a silent
 *    default, and a toggle that appears to do nothing is the worst failure
 *    mode for a comparison tool.
 *  - **No hydration mismatch.** The server snapshot is the default; the
 *    browser snapshot reads `localStorage`. React reconciles the difference
 *    itself instead of the two disagreeing over markup.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "bajat-control-style"

let currentStyle: ControlStyle | null = null
const listeners = new Set<() => void>()

function readStyle(): ControlStyle {
  if (currentStyle) return currentStyle
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ControlStyle | null
    currentStyle = saved && CONTROL_STYLES.includes(saved) ? saved : DEFAULT_STYLE
  } catch {
    currentStyle = DEFAULT_STYLE
  }
  return currentStyle
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function setControlStyle(next: ControlStyle) {
  currentStyle = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // The choice simply won't persist.
  }
  for (const listener of listeners) listener()
}

/** The current treatment, and the setter behind the Appearance row. */
export function useControlStyle() {
  const style = React.useSyncExternalStore(
    subscribe,
    readStyle,
    () => DEFAULT_STYLE
  )
  return { style, setStyle: setControlStyle }
}

/* ------------------------------------------------------------------ *
 * Flat's form — a second store, same shape
 *
 * Kept separate from the style rather than flattened into five styles
 * (`flat-tinted`, `flat-solid`, …) because it is a different question: the
 * style picks the *material*, this picks the form flat takes. Folding them
 * together would also throw away the choice every time you looked at ink and
 * came back.
 * ------------------------------------------------------------------ */

const FLAT_KEY = "bajat-flat-variant"

let currentFlat: FlatVariant | null = null
const flatListeners = new Set<() => void>()

function readFlat(): FlatVariant {
  if (currentFlat) return currentFlat
  try {
    const saved = localStorage.getItem(FLAT_KEY) as FlatVariant | null
    currentFlat = saved && FLAT_VARIANTS.includes(saved) ? saved : DEFAULT_FLAT
  } catch {
    currentFlat = DEFAULT_FLAT
  }
  return currentFlat
}

function subscribeFlat(onChange: () => void) {
  flatListeners.add(onChange)
  return () => {
    flatListeners.delete(onChange)
  }
}

function setFlatVariant(next: FlatVariant) {
  currentFlat = next
  try {
    localStorage.setItem(FLAT_KEY, next)
  } catch {
    // The choice simply won't persist.
  }
  for (const listener of flatListeners) listener()
}

/** Flat's form, and the setter behind the Appearance sub-row. */
export function useFlatVariant() {
  const variant = React.useSyncExternalStore(
    subscribeFlat,
    readFlat,
    () => DEFAULT_FLAT
  )
  return { variant, setVariant: setFlatVariant }
}

/**
 * The classes for the current treatment — the common case of the hooks above.
 *
 * `flat` is the one style whose face is not fixed, so it is resolved here
 * rather than in the table. Every other style ignores the flat variant, which
 * is why the sub-row only appears when flat is selected.
 */
export function useControlSurface(): ControlSurface {
  const { style } = useControlStyle()
  const { variant } = useFlatVariant()

  return React.useMemo(
    () =>
      style === "flat"
        ? { ...CONTROL_SURFACE.flat, ...FLAT_FACES[variant] }
        : CONTROL_SURFACE[style],
    [style, variant]
  )
}
