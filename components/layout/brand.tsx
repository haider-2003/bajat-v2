"use client"

import * as React from "react"

/**
 * Brand colour — DESIGN.md §2.1.
 *
 * §2.1 documents two primary strategies and says to pick one per product:
 *
 *   **A — Neutral-primary (recommended).** Solid actions are `#111` on light /
 *   `#FFF` on dark, and a single accent hue is reserved for focus, selection,
 *   links and active chart series.
 *   **B — Hue-primary.** Solid actions take the accent hue itself.
 *
 * This module makes that choice a preference instead of a build-time decision,
 * and lets the accent hue be swapped for any of the palette's documented pairs.
 * Both are two halves of one question — "what colour is this product?" — so
 * they live together.
 *
 * ### How it is applied
 *
 * Neither value is held in React state that components read. Each is written to
 * a `data-` attribute on `<html>`, and `globals.css` redefines the accent and
 * primary tokens under `[data-accent="…"]` / `[data-primary="accent"]`. So a
 * change costs one attribute write, every component that already consumes
 * `--accent-violet`, `--ring` or `--primary` follows automatically, and nothing
 * has to be re-plumbed to opt in.
 *
 * Defaults are the `:root` values, so `violet` and `neutral` deliberately have
 * no CSS block of their own — selecting them means falling back to what
 * globals.css already declares.
 */

/* ------------------------------------------------------------------ *
 * Palette
 * ------------------------------------------------------------------ */

export type Accent =
  | "violet"
  | "blue"
  | "cyan"
  | "green"
  | "orange"
  | "clay"
  | "pink"

/**
 * Every hue is a **pair**: a 600-level tone for light mode and a 400-level tone
 * for dark, which is the two-tier pattern §2.2/§2.3 already uses for status
 * colours — a hue dark enough to carry white text on white is far too dark to
 * read on `#0A0A0A`.
 *
 * Violet and blue are §2.1's own two strategies. Green and orange reuse the
 * documented `success`/`warning` pairs, and cyan extends chart-6 (`#06B6D4`) to
 * the same two tiers. Clay and pink are brand hues carried in at their exact
 * shipped values — Claude's `#D97757` and n8n's `#EA4B71` — with only their
 * dark-mode partner and tint derived. **Red is deliberately absent**: an accent
 * sharing the danger hue would make destructive confirmations unreadable as
 * warnings.
 *
 * `tile` paints the picker's swatch with the hue's real §7.4 tone, so a swatch
 * previews the material a solid control will actually be made of rather than
 * standing in for it with a flat dot. Those stops are darker than `tone` on
 * purpose — a solid face has to carry a white label at 4.5:1, which `tone` (a
 * ring and tint colour, judged at 3:1) does not. See the tone block in
 * globals.css.
 */
export const ACCENTS: readonly {
  value: Accent
  label: string
  /**
   * The hue as a `text-` colour, in both themes. Carried on `color` so the
   * picker can draw the selected ring (`ring-current`) from one declaration.
   */
  tone: string
  /** The hue's §7.4 tone, as local properties the swatch paints itself with. */
  tile: string
}[] = [
  {
    value: "violet",
    label: "Violet",
    tone: "text-[#7c3aed] dark:text-[#a78bfa]",
    tile: "[--sw-top:#6d28d9] [--sw-mid:#6524cb] [--sw-bot:#5d21bc] [--sw-rim:#381471]",
  },
  {
    value: "blue",
    label: "Blue",
    tone: "text-[#2563eb] dark:text-[#60a5fa]",
    tile: "[--sw-top:#1d4ed8] [--sw-mid:#1b49c9] [--sw-bot:#1943ba] [--sw-rim:#0f2870]",
  },
  {
    value: "cyan",
    label: "Cyan",
    tone: "text-[#0891b2] dark:text-[#22d3ee]",
    tile: "[--sw-top:#0e7490] [--sw-mid:#0d6c86] [--sw-bot:#0c647c] [--sw-rim:#073c4a]",
  },
  {
    value: "green",
    label: "Green",
    tone: "text-[#16a34a] dark:text-[#4ade80]",
    tile: "[--sw-top:#15803d] [--sw-mid:#147739] [--sw-bot:#126e34] [--sw-rim:#0b421f]",
  },
  {
    value: "orange",
    label: "Orange",
    tone: "text-[#ea580c] dark:text-[#fb923c]",
    tile: "[--sw-top:#c2410c] [--sw-mid:#b43c0b] [--sw-bot:#a7380a] [--sw-rim:#642206]",
  },
  {
    value: "clay",
    label: "Clay",
    tone: "text-[#d97757] dark:text-[#eaa48e]",
    tile: "[--sw-top:#b54c29] [--sw-mid:#a84726] [--sw-bot:#9c4123] [--sw-rim:#5e2715]",
  },
  {
    value: "pink",
    label: "Pink",
    tone: "text-[#ea4b71] dark:text-[#f588a2]",
    tile: "[--sw-top:#d51946] [--sw-mid:#c61741] [--sw-bot:#b7153c] [--sw-rim:#6e0d24]",
  },
]

const ACCENT_VALUES = ACCENTS.map((a) => a.value)

/** §2.1's strategy choice, named for what it changes rather than its letter. */
export type PrimaryStyle = "neutral" | "accent"

export const PRIMARY_STYLES: readonly PrimaryStyle[] = ["neutral", "accent"]

const DEFAULT_ACCENT: Accent = "violet"
const DEFAULT_PRIMARY: PrimaryStyle = "neutral"

const ACCENT_KEY = "bajat-accent"
const PRIMARY_KEY = "bajat-primary"

/* ------------------------------------------------------------------ *
 * Pre-paint application
 * ------------------------------------------------------------------ */

/**
 * Stamps both attributes before first paint, alongside `themeInitScript`.
 * Without it the first frame renders in violet/neutral and then snaps to the
 * stored choice — the same flash the theme script exists to prevent.
 *
 * Unknown values fall through to the defaults rather than being written, so a
 * hand-edited localStorage cannot leave the page on a selector that matches
 * nothing.
 */
export const brandInitScript = `
(function () {
  try {
    var el = document.documentElement;
    var accents = ${JSON.stringify(ACCENT_VALUES)};
    var a = localStorage.getItem(${JSON.stringify(ACCENT_KEY)});
    el.dataset.accent = accents.indexOf(a) === -1 ? ${JSON.stringify(DEFAULT_ACCENT)} : a;
    var p = localStorage.getItem(${JSON.stringify(PRIMARY_KEY)});
    el.dataset.primary = p === "accent" ? "accent" : ${JSON.stringify(DEFAULT_PRIMARY)};
  } catch (e) {}
})();
`

/* ------------------------------------------------------------------ *
 * Store
 *
 * A module-level store read through `useSyncExternalStore`, the same shape as
 * the control-style store: the value's home is localStorage plus a DOM
 * attribute, so there is no provider to be rendered outside of and no effect
 * mirroring one source of truth into another.
 * ------------------------------------------------------------------ */

type Brand = { accent: Accent; primary: PrimaryStyle }

const SERVER_SNAPSHOT = `${DEFAULT_ACCENT}:${DEFAULT_PRIMARY}`

let snapshot: string | null = null
const listeners = new Set<() => void>()

function read(key: string, fallback: string, allowed: readonly string[]): string {
  try {
    const saved = localStorage.getItem(key)
    return saved && allowed.includes(saved) ? saved : fallback
  } catch {
    // localStorage throws in some private-browsing modes.
    return fallback
  }
}

/** `${accent}:${primary}` — a primitive, so getSnapshot stays referentially stable. */
function getSnapshot(): string {
  if (snapshot === null) {
    snapshot = `${read(ACCENT_KEY, DEFAULT_ACCENT, ACCENT_VALUES)}:${read(
      PRIMARY_KEY,
      DEFAULT_PRIMARY,
      PRIMARY_STYLES
    )}`
  }
  return snapshot
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Another tab may change the preference.
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The choice won't persist; the session still honours it.
  }
}

export function useBrand(): Brand & {
  setAccent: (accent: Accent) => void
  setPrimary: (primary: PrimaryStyle) => void
} {
  const value = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT
  )
  const [accent, primary] = value.split(":") as [Accent, PrimaryStyle]

  const setAccent = React.useCallback((next: Accent) => {
    write(ACCENT_KEY, next)
    document.documentElement.dataset.accent = next
    snapshot = null
    for (const l of listeners) l()
  }, [])

  const setPrimary = React.useCallback((next: PrimaryStyle) => {
    write(PRIMARY_KEY, next)
    document.documentElement.dataset.primary = next
    snapshot = null
    for (const l of listeners) l()
  }, [])

  return { accent, primary, setAccent, setPrimary }
}
