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
  | "indigo"
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
 * the same two tiers. Clay, pink and indigo are brand hues carried in at their
 * exact shipped values — Claude's `#D97757`, n8n's `#EA4B71` and Stripe's
 * `#635BFF` — with only their dark-mode partner and tint derived. **Red is
 * deliberately absent**: an accent sharing the danger hue would make
 * destructive confirmations unreadable as warnings.
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
    value: "indigo",
    label: "Indigo",
    tone: "text-[#635bff] dark:text-[#a5a0ff]",
    tile: "[--sw-top:#4f46d9] [--sw-mid:#4a41cb] [--sw-bot:#453cbd] [--sw-rim:#29237a]",
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

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

/**
 * A template is the whole palette in one choice.
 *
 * The two controls above each move one thing — a hue, a strategy. Neither
 * touches the *neutrals*, which is most of what a look actually is: the page,
 * the surfaces, the text ramp, the borders, the sidebar. A template moves
 * those, and picks an accent and a primary strategy to match.
 *
 * ### It is a preset, not a second system
 *
 * Selecting one writes `data-template` **and** the two preferences below, so
 * the accent and primary blocks in globals.css keep being the only place those
 * tokens are defined. `data-template` owns the neutral ramp and nothing else
 * (see the template block in globals.css for the full list of what it may
 * touch). Nothing overlaps, so nothing fights in the cascade.
 *
 * Because the knobs stay live, changing one by hand after picking a template
 * is allowed — the UI just stops claiming a template is active. That state is
 * derived, never stored: see `matchTemplate`.
 *
 * ### Colours only
 *
 * No template changes the font, the radius scale, spacing, status colours or
 * chart series. A template can repaint the app; it cannot move a control by a
 * pixel or make a danger badge stop looking dangerous.
 */
export type Template = "graphite" | "clay" | "ink" | "ledger"

/** The six colours a picker card needs to show what a template looks like. */
export type TemplatePreview = {
  /** The page ground. */
  page: string
  /** The sidebar rail. */
  rail: string
  /** A card / panel on the page. */
  surface: string
  /** Hairline borders. */
  line: string
  /** Primary text. */
  ink: string
  /** The face of a primary button — the tone, so it reflects the strategy. */
  button: string
}

export type TemplateDef = {
  value: Template
  label: string
  /** One line, shown under the card's label. */
  description: string
  accent: Accent
  primary: PrimaryStyle
  preview: { light: TemplatePreview; dark: TemplatePreview }
}

/**
 * `graphite` is the shipped design and deliberately has no CSS block —
 * selecting it means falling back to the `:root` / `.dark` ramps, which is
 * also what makes it a safe reset target.
 *
 * `clay` is claude.ai's warm palette, documented in
 * docs/CLAUDE-CHAT-DESIGN-SYSTEM.md. It pairs the cream ramp with the `clay`
 * accent at its shipped `#D97757` and Strategy B, because the orange button is
 * the signature of that look — a warm page under a black button reads as an
 * accident rather than a choice.
 *
 * `ink` is the opposite end: cool slate, borders at three times the usual
 * contrast, a white rail on a tinted page. It keeps Strategy A, because the
 * whole idea is that structure comes from outlines — a coloured button would
 * be competing with borders that are already loud.
 *
 * `ledger` is the Stripe dashboard's palette: neutrals with a blue cast and a
 * navy-black ink, under Strategy B so the indigo button — the reference's whole
 * signature — is the loudest thing on screen. It is the closest of the four to
 * what Bajat actually is, a quote and billing dashboard.
 *
 * The four are deliberately far apart — warm, neutral, hard, blue. Two
 * templates that read as similar in the picker make the feature look like noise
 * rather than choice, so a fifth has to earn its place (see docs/TEMPLATES.md
 * §4).
 */
export const TEMPLATES: readonly TemplateDef[] = [
  {
    value: "graphite",
    label: "Graphite",
    description: "The default. Neutral greys, black buttons, violet accent.",
    accent: "violet",
    primary: "neutral",
    preview: {
      light: {
        page: "#f4f4f5",
        rail: "#f4f4f5",
        surface: "#ffffff",
        line: "#eaeaea",
        ink: "#171717",
        button: "#111111",
      },
      dark: {
        page: "#0a0a0a",
        rail: "#0d0d0d",
        surface: "#161616",
        line: "#262626",
        ink: "#ededed",
        button: "#ffffff",
      },
    },
  },
  {
    value: "clay",
    label: "Clay",
    description: "Warm paper and clay — cream page, orange buttons.",
    accent: "clay",
    primary: "accent",
    preview: {
      light: {
        page: "#faf9f5",
        rail: "#f0eee6",
        surface: "#ffffff",
        line: "#e8e5db",
        ink: "#141413",
        button: "#b54c29",
      },
      dark: {
        page: "#262624",
        rail: "#1f1e1d",
        surface: "#30302e",
        line: "#3d3c39",
        ink: "#f5f4ee",
        button: "#eaa48e",
      },
    },
  },
  {
    value: "ink",
    label: "Ink",
    description: "High contrast. Strong borders, white sidebar, slate text.",
    accent: "blue",
    primary: "neutral",
    preview: {
      light: {
        page: "#eef2f6",
        rail: "#ffffff",
        surface: "#ffffff",
        line: "#cbd5e1",
        ink: "#0f172a",
        // Strategy A leaves `--primary` at the :root neutral, so the button
        // is #111 rather than the template's slate ink.
        button: "#111111",
      },
      dark: {
        page: "#0d1117",
        rail: "#161d27",
        surface: "#161d27",
        line: "#30363d",
        ink: "#e6edf3",
        button: "#ffffff",
      },
    },
  },
  {
    value: "ledger",
    label: "Ledger",
    description: "Finance blue. Tinted neutrals, navy ink, indigo buttons.",
    accent: "indigo",
    primary: "accent",
    preview: {
      light: {
        page: "#f6f8fa",
        rail: "#ffffff",
        surface: "#ffffff",
        line: "#e3e8ee",
        ink: "#1a1f36",
        button: "#4f46d9",
      },
      dark: {
        page: "#0f1116",
        rail: "#161922",
        surface: "#1c1f2a",
        line: "#2a2f3d",
        ink: "#e6e9f0",
        button: "#a5a0ff",
      },
    },
  },
]

const TEMPLATE_VALUES = TEMPLATES.map((t) => t.value)

/**
 * Which template the current settings actually add up to, or `null` for a
 * hand-mixed combination.
 *
 * Derived rather than stored, so the UI can never claim a template is active
 * after the accent has been changed out from under it.
 */
export function matchTemplate(
  template: Template,
  accent: Accent,
  primary: PrimaryStyle
): Template | null {
  const def = TEMPLATES.find((t) => t.value === template)
  return def && def.accent === accent && def.primary === primary
    ? def.value
    : null
}

const DEFAULT_ACCENT: Accent = "violet"
const DEFAULT_PRIMARY: PrimaryStyle = "neutral"
export const DEFAULT_TEMPLATE: Template = "graphite"

const ACCENT_KEY = "bajat-accent"
const PRIMARY_KEY = "bajat-primary"
const TEMPLATE_KEY = "bajat-template"

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
    var templates = ${JSON.stringify(TEMPLATE_VALUES)};
    var t = localStorage.getItem(${JSON.stringify(TEMPLATE_KEY)});
    el.dataset.template = templates.indexOf(t) === -1 ? ${JSON.stringify(DEFAULT_TEMPLATE)} : t;
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

type Brand = { accent: Accent; primary: PrimaryStyle; template: Template }

const SERVER_SNAPSHOT = `${DEFAULT_ACCENT}:${DEFAULT_PRIMARY}:${DEFAULT_TEMPLATE}`

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

/**
 * `${accent}:${primary}:${template}` — a primitive, so getSnapshot stays
 * referentially stable.
 */
function getSnapshot(): string {
  if (snapshot === null) {
    snapshot = [
      read(ACCENT_KEY, DEFAULT_ACCENT, ACCENT_VALUES),
      read(PRIMARY_KEY, DEFAULT_PRIMARY, PRIMARY_STYLES),
      read(TEMPLATE_KEY, DEFAULT_TEMPLATE, TEMPLATE_VALUES),
    ].join(":")
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

/** Persist one preference and stamp it on `<html>`, without notifying. */
function put(key: string, attr: "accent" | "primary" | "template", value: string) {
  write(key, value)
  document.documentElement.dataset[attr] = value
}

function notify() {
  snapshot = null
  for (const l of listeners) l()
}

export function useBrand(): Brand & {
  setAccent: (accent: Accent) => void
  setPrimary: (primary: PrimaryStyle) => void
  /**
   * Applies a template — its neutral ramp plus the accent and strategy that
   * belong to it — as one change.
   *
   * All three attributes are written before a single notify, so the app
   * repaints once. Setting them through the individual setters would paint an
   * intermediate frame with the new ramp under the old accent.
   */
  applyTemplate: (template: Template) => void
} {
  const value = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT
  )
  const [accent, primary, template] = value.split(":") as [
    Accent,
    PrimaryStyle,
    Template,
  ]

  const setAccent = React.useCallback((next: Accent) => {
    put(ACCENT_KEY, "accent", next)
    notify()
  }, [])

  const setPrimary = React.useCallback((next: PrimaryStyle) => {
    put(PRIMARY_KEY, "primary", next)
    notify()
  }, [])

  const applyTemplate = React.useCallback((next: Template) => {
    const def = TEMPLATES.find((t) => t.value === next)
    if (!def) return
    put(TEMPLATE_KEY, "template", def.value)
    put(ACCENT_KEY, "accent", def.accent)
    put(PRIMARY_KEY, "primary", def.primary)
    notify()
  }, [])

  return { accent, primary, template, setAccent, setPrimary, applyTemplate }
}
