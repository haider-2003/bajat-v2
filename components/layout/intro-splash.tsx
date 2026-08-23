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
 * ## Hand-off
 *
 * When the splash dismisses over the login screen, its card stack does not
 * fade — it flies to the position of the identical stack in the brand panel
 * and lands on it, so the two screens read as one continuous object rather
 * than the same animation played twice. This is a FLIP transition: measure
 * both rectangles, then animate the delta with the Web Animations API. It
 * needs no library, and the browser runs it on the compositor.
 *
 * The flight is strictly an enhancement. If the target is missing (any page
 * but /login) or not rendered (the panel is `hidden` below `lg`), the measure
 * returns nothing and the splash falls back to the plain cross-fade.
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
/** Flight time when the splash hands its cards to the login panel. */
const HANDOFF_MS = 720
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
  const [flying, setFlying] = React.useState(false)
  const dismissed = React.useRef(false)
  /** Untransformed wrapper — the element the flight is applied to. */
  const flightRef = React.useRef<HTMLDivElement>(null)
  /** The scaled stack inside it — the element that is measured. */
  const stackRef = React.useRef<HTMLDivElement>(null)

  /**
   * FLIP the splash's stack onto the login panel's. Returns the flight time,
   * or 0 when there is nothing to fly to.
   */
  const flyToPanel = React.useCallback(() => {
    const flight = flightRef.current
    const stack = stackRef.current
    const target = document.querySelector<HTMLElement>("[data-handoff-target]")
    if (!flight || !stack || !target) return 0

    // Measure the *scaled* stack, since that is what the eye sees; a display:
    // none panel (below `lg`) reports 0 and falls through to the cross-fade.
    const from = stack.getBoundingClientRect()
    const to = target.getBoundingClientRect()
    if (!from.width || !to.width) return 0

    // The wrapper is untransformed and shares its centre with the scaled
    // stack, so scaling it composes with the stack's own scale correctly.
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const scale = to.width / from.width

    flight.animate(
      [
        { transform: "none" },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      ],
      {
        duration: HANDOFF_MS,
        // Leaves quickly, arrives softly — an object being set down.
        easing: "cubic-bezier(0.65, 0, 0.25, 1)",
        fill: "forwards",
      }
    )

    // Outlives `data-intro`, so the panel cards never replay the entrance
    // this flight just stood in for.
    target.setAttribute("data-handoff", "done")
    return HANDOFF_MS
  }, [])

  const dismiss = React.useCallback(() => {
    // Click, key and timer all race here; only the first one counts.
    if (dismissed.current) return
    dismissed.current = true

    const flight = flyToPanel()
    if (flight) setFlying(true)
    setLeaving(true)

    try {
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      // Not persisting just means it may replay; harmless.
    }
    window.setTimeout(() => {
      delete document.documentElement.dataset.intro
      introStore.emit()
    }, flight || FADE_MS)
  }, [flyToPanel])

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
      className="fixed inset-0 z-200 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Ground, on its own layer. Fading this rather than the whole overlay
          is what lets the cards stay solid while the login screen is revealed
          underneath them. Ends a touch before the cards land. */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity ease-out",
          // Theme-aware; the dark value is the login panel's own ground.
          "bg-background dark:bg-[#080d16]",
          leaving ? "opacity-0" : "opacity-100"
        )}
        style={{
          transitionDuration: `${flying ? HANDOFF_MS - 160 : FADE_MS}ms`,
        }}
      />
      {/* Glow blooms out from behind the stack as the cards arrive */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 size-[760px] rounded-full",
          "animate-[intro-glow_1100ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
          "transition-opacity duration-300 ease-out",
          leaving ? "opacity-0! dark:opacity-0!" : "opacity-40 dark:opacity-100"
        )}
        style={{
          background:
            "radial-gradient(circle, rgba(18,163,122,0.30) 0%, rgba(18,163,122,0) 70%)",
        }}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-[38%] size-[560px] rounded-full",
          "animate-[intro-glow_1300ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
          "transition-opacity duration-300 ease-out",
          leaving ? "opacity-0! dark:opacity-0!" : "opacity-25 dark:opacity-50"
        )}
        style={{
          background:
            "radial-gradient(circle, rgba(99,112,255,0.32) 0%, rgba(99,112,255,0) 70%)",
        }}
      />

      {/* Two elements on purpose: the outer one is untransformed and carries
          the flight, the inner one carries the scale and is what gets
          measured. They share a centre, so the flight's scale composes with
          the inner scale instead of fighting it.

          The stack is authored at 420px; scale rather than reflow it, so the
          splash and the login panel stay pixel-identical in proportion. */}
      <div ref={flightRef} className="relative">
        <div
          ref={stackRef}
          className={cn(
            "scale-[0.72] sm:scale-90 lg:scale-110",
            // Only cross-fades when there was nowhere to fly to.
            !flying && "transition-opacity ease-out",
            !flying && leaving && "opacity-0"
          )}
          style={!flying ? { transitionDuration: `${FADE_MS}ms` } : undefined}
        >
          <IdCardStack mode="intro" />
        </div>
      </div>

      {/* Wordmark rises last — the cards are the subject, the name is the
          resolution. */}
      <div
        className={cn(
          "relative mt-14 flex items-center gap-2.5",
          "animate-[intro-rise_600ms_cubic-bezier(0.2,0.8,0.2,1)_both] [animation-delay:820ms]",
          "transition-opacity duration-200 ease-out",
          leaving && "opacity-0!"
        )}
      >
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
          "transition-opacity duration-200",
          leaving && "opacity-0",
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
