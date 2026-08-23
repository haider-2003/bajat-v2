"use client"

import * as React from "react"

/**
 * Theme control — DESIGN.md §16 / §17.
 *
 * Three states, matching the token contract: an explicit "light"/"dark" choice
 * persists to localStorage, and "system" follows `prefers-color-scheme` live.
 * The class applied is `.dark`, which is what `@custom-variant dark` in
 * globals.css keys off.
 */

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "bajat-theme"

type ThemeContextValue = {
  /** The user's preference, including "system". */
  theme: Theme
  /** What is actually painted right now. */
  resolved: "light" | "dark"
  setTheme: (theme: Theme) => void
  /** Flips to the opposite of what is currently painted. */
  toggle: () => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>")
  return ctx
}

/**
 * Runs before paint to apply the stored theme, so the first frame is already
 * correct. Without it the page flashes light before hydration.
 */
export const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "system";
    var dark = t === "dark" ||
      (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`

function readStored(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system"
  } catch {
    // localStorage throws in some private-browsing modes.
    return "system"
  }
}

function applyTheme(theme: Theme): "light" | "dark" {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
  return dark ? "dark" : "light"
}

/* -------------------------------------------------------------------- *
 * External store: the preference lives in localStorage + the OS media
 * query, so it is read with useSyncExternalStore rather than mirrored
 * into state via an effect.
 * -------------------------------------------------------------------- */

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  mq.addEventListener("change", onChange)
  // Another tab may change the preference.
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    mq.removeEventListener("change", onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** `${preference}:${resolved}` — a primitive so getSnapshot stays stable. */
function getSnapshot(): string {
  const pref = readStored()
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  return `${pref}:${dark ? "dark" : "light"}`
}

/** The server cannot know the preference; the init script fixes it pre-paint. */
function getServerSnapshot(): string {
  return "system:light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
  const [theme, resolved] = snapshot.split(":") as [Theme, "light" | "dark"]

  // Keep the DOM class in sync when the OS flips while on "system".
  React.useEffect(() => {
    applyTheme(theme)
  }, [theme, resolved])

  const setTheme = React.useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference won't persist; the session still honours it.
    }
    applyTheme(next)
    emit()
  }, [])

  const toggle = React.useCallback(() => {
    // Anchor on what is painted, so the first click from "system" always
    // visibly flips rather than appearing to do nothing.
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "light" : "dark")
  }, [setTheme])

  const value = React.useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle]
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
