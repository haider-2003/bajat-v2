"use client"

import * as React from "react"

import { BajatMark } from "@/components/brand/bajat-mark"
import { IdCardStack } from "@/components/brand/id-card-stack"
import { cn } from "@/lib/utils"

/**
 * Bajat intro splash.
 *
 * Plays once per browser session over a full-screen overlay, then fades out
 * and unmounts. Later navigations and refreshes in the same tab skip it.
 *
 * Built from the same `IdCardStack` the login panel uses, animated with CSS
 * keyframes. It replaces a Lottie player: `lottie-web` plus a 156KB JSON
 * artboard was ~400KB of transfer and a runtime dependency, all to render a
 * two-second animation of three rectangles — and it could not share a single
 * pixel with the sign-in screen it was supposed to lead into. The CSS version
 * is the same artwork, so the splash now hands off to a login panel holding
 * the identical stack.
 *
 * Dropping the player also removes a class of failure: there is no JSON to
 * 404, no async import to reject, and no need for the watchdog timer that
 * previously existed to stop a failed load from holding the app hostage.
 *
 * Hydration: whether to play depends on `sessionStorage`, which the server
 * cannot see. Rather than branch during render — which desynchronises the two
 * trees — the component always renders the same markup, and `introInitScript`
 * (a blocking script in <head>) paints the cover before first paint and marks
 * the document with `<html data-intro="playing">`. That marker also drives the
 * scroll lock from CSS — writing `body.style` directly would show up as a
 * hydration attribute mismatch.
 */

const SESSION_KEY = "bajat-intro-played"
const COVER_ID = "bajat-intro-cover"
/** Cards land at ~1280ms; this holds the finished frame briefly. */
const HOLD_MS = 2150
const FADE_MS = 450
/**
 * Splash ground, per theme. Dark reuses the login panel's blue-black so the
 * handoff to the sign-in screen has no seam; light uses the page grey.
 *
 * These two hexes are duplicated into the pre-paint script below because that
 * script runs before any stylesheet is guaranteed to have applied, so it
 * cannot read a CSS custom property. They are the single source for both.
 */
const BACKDROP = {
  light: "#f4f4f5",
  dark: "#080d16",
} as const

/**
 * Runs before paint: decides whether the intro should play, and if so paints a
 * plain cover immediately so the app never flashes underneath. React replaces
 * the cover once it mounts.
 */
export const introInitScript = `
(function () {
  try {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var seen = sessionStorage.getItem(${JSON.stringify(SESSION_KEY)}) === "1";
    if (reduce || seen) return;
  } catch (e) { /* private mode: play it */ }
  document.documentElement.dataset.intro = "playing";
  // themeInitScript runs immediately before this one and has already put
  // .dark on <html>, so the cover can be painted in the right theme rather
  // than flashing a dark panel at a light-mode user.
  var dark = document.documentElement.classList.contains("dark");
  var d = document.createElement("div");
  d.id = ${JSON.stringify(COVER_ID)};
  d.setAttribute("aria-hidden", "true");
  d.style.cssText =
    "position:fixed;inset:0;z-index:200;background:" +
    (dark ? ${JSON.stringify(BACKDROP.dark)} : ${JSON.stringify(BACKDROP.light)});
  document.addEventListener("DOMContentLoaded", function () {
    if (document.documentElement.dataset.intro === "playing") {
      document.body.appendChild(d);
    }
  });
})();
`

/* The <html data-intro> marker set by the init script, read as an external
   store: the server snapshot is always `false`, so SSR and the first client
   render agree, and React re-renders with the real value after hydration. */
const introStore = {
  listeners: new Set<() => void>(),
  subscribe(cb: () => void) {
    introStore.listeners.add(cb)
    return () => introStore.listeners.delete(cb)
  },
  emit() {
    for (const cb of introStore.listeners) cb()
  },
  get: () => document.documentElement.dataset.intro === "playing",
  getServer: () => false,
}

export function IntroSplash() {
  const playing = React.useSyncExternalStore(
    introStore.subscribe,
    introStore.get,
    introStore.getServer
  )
  const [leaving, setLeaving] = React.useState(false)
  const dismissed = React.useRef(false)

  const dismiss = React.useCallback(() => {
    // Click, key and timer all race here; only the first one counts.
    if (dismissed.current) return
    dismissed.current = true

    setLeaving(true)
    try {
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      // Not persisting just means it may replay; harmless.
    }
    window.setTimeout(() => {
      delete document.documentElement.dataset.intro
      introStore.emit()
    }, FADE_MS)
  }, [])

  React.useEffect(() => {
    if (!playing) return

    // React's overlay is up now; drop the pre-paint cover.
    document.getElementById(COVER_ID)?.remove()

    const onKey = () => dismiss()
    window.addEventListener("keydown", onKey)
    const timer = window.setTimeout(dismiss, HOLD_MS)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
    }
  }, [playing, dismiss])

  if (!playing) return null

  return (
    <div
      aria-hidden
      onClick={dismiss}
      className={cn(
        "fixed inset-0 z-200 flex flex-col items-center justify-center overflow-hidden",
        // Ground follows the theme; the dark value is the login panel's.
        "bg-background dark:bg-[#080d16]",
        "transition-opacity ease-out",
        leaving ? "opacity-0" : "opacity-100"
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Glow blooms out from behind the stack as the cards arrive */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[760px] rounded-full opacity-40 animate-[intro-glow_1100ms_cubic-bezier(0.2,0.8,0.2,1)_both] dark:opacity-100"
        style={{
          background:
            "radial-gradient(circle, rgba(18,163,122,0.30) 0%, rgba(18,163,122,0) 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] size-[560px] rounded-full opacity-25 animate-[intro-glow_1300ms_cubic-bezier(0.2,0.8,0.2,1)_both] dark:opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(99,112,255,0.32) 0%, rgba(99,112,255,0) 70%)",
        }}
      />

      {/* The stack is authored at 420px; scale rather than reflow it, so the
          splash and the login panel stay pixel-identical in proportion. */}
      <div className="relative scale-[0.72] sm:scale-90 lg:scale-110">
        <IdCardStack mode="intro" />
      </div>

      {/* Wordmark rises last — the cards are the subject, the name is the
          resolution. */}
      <div className="relative mt-14 flex items-center gap-2.5 animate-[intro-rise_600ms_cubic-bezier(0.2,0.8,0.2,1)_both] [animation-delay:820ms]">
        <BajatMark className="size-7 text-text dark:text-white" />
        <span className="text-lg font-semibold tracking-[-0.01em] text-text dark:text-white">
          Bajat
        </span>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className={cn(
          "absolute bottom-6 left-6 rounded-md px-3 py-1.5",
          "text-xs font-medium text-text-muted transition-colors",
          "hover:bg-[rgba(0,0,0,0.06)] hover:text-text",
          "dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white/80",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        Skip
      </button>
    </div>
  )
}
