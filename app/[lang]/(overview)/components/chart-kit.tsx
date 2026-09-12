"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The pieces every chart on this screen is built from.
 *
 * Four charts sharing one hover model, one entrance model and one number
 * format is what makes the page read as a single instrument rather than four
 * widgets that happen to sit near each other. Anything a second chart would
 * need a copy of belongs here.
 *
 * The colours live in `app/globals.css` (`--viz-*`), not in this file — see
 * the block there for why, and for the validator command that gates edits.
 */

/* ── Motion gates ─────────────────────────────────────────────────────────── */

/**
 * The user's reduced-motion preference, live.
 *
 * CSS animations are already clamped globally (§18.0 rule 10), so this exists
 * only for the motion CSS cannot reach: the JS count-up below. Read through
 * `useSyncExternalStore` so the server snapshot is a settled `true` — the
 * first paint then shows the final number rather than a zero that a
 * non-hydrated page would be stuck on.
 */
export function useReducedMotion() {
  const subscribe = React.useCallback((onChange: () => void) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  )
}

/**
 * Whether the intro splash has finished.
 *
 * CSS entrances wait for it through `data-await-intro`, which pauses the
 * animation at frame zero until `<html data-intro>` is removed. The count-up
 * is JavaScript and that attribute cannot reach it, so it watches the same
 * marker directly — otherwise the hero number would finish counting behind
 * the overlay and be sitting still by the time anyone saw it.
 *
 * A `MutationObserver` rather than importing the splash's own store: that
 * store is private to `intro-splash.tsx`, and one attribute is not worth
 * widening its surface for.
 */
export function useIntroDone() {
  const subscribe = React.useCallback((onChange: () => void) => {
    const observer = new MutationObserver(onChange)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-intro"],
    })
    return () => observer.disconnect()
  }, [])

  return React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.intro !== "playing",
    // The server cannot know, and guessing "done" would start the count-up
    // during hydration. Guessing "playing" only ever costs a frame.
    () => false
  )
}

/* ── Numbers ──────────────────────────────────────────────────────────────── */

/**
 * A count-up to `target`.
 *
 * Eased out rather than linear, so the number decelerates into its final value
 * instead of stopping dead — the difference between a readout that lands and
 * one that just halts. Returns `target` immediately under reduced motion, and
 * holds at `target` (not at zero) whenever the animation cannot run, so the
 * figure is never wrong, only occasionally un-animated.
 */
export function useCountUp(target: number, duration = 1100) {
  const reduced = useReducedMotion()
  const introDone = useIntroDone()
  const animate = !reduced && introDone

  const [animated, setAnimated] = React.useState(0)

  // Where the next run starts. Updated every frame, so a target that changes
  // mid-flight — a refetch landing — continues from what is on screen rather
  // than snapping back to zero and re-selling a number already read.
  const fromRef = React.useRef(0)

  React.useEffect(() => {
    // No `setState` in the effect body: the only writes happen inside the
    // animation frame callback, which is the external-system boundary this
    // hook exists to bridge.
    if (!animate) return

    const from = fromRef.current
    if (from === target) return

    let frame = 0
    const start = performance.now()
    // ease-out-expo — the standard curve in DESIGN.md §19.14. The figure
    // decelerates into its value instead of stopping dead.
    const ease = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const next = Math.round(from + (target - from) * ease(progress))
      fromRef.current = next
      setAnimated(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, animate])

  // Reduced motion, or the splash still up: the true figure, immediately.
  // There is no flash to guard against — the statistics arrive from a client
  // query, so the server never renders a number for this to disagree with.
  return animate ? animated : target
}

/**
 * `842` · `12,480` · `4.2M`.
 *
 * Compact only past a million, which is higher than the usual threshold and
 * deliberate. Two things break at a lower one:
 *
 *  - **Mixed formats in a comparison set.** The pipeline prints four counts in
 *    a row. At a ten-thousand threshold that row reads `14.2K · 12.3K · 9,310
 *    · 12.5K` — three rounded and one exact, which is exactly the row a reader
 *    is meant to compare across.
 *  - **Precision an admin actually wants.** `12.5K` is a marketing number.
 *    Somebody reconciling issued cards against printed ones needs `12,480`,
 *    and at six digits it still fits everywhere on this screen.
 *
 * Past a million the digits stop fitting the hero figure's column, and that is
 * where rounding starts earning its place.
 */
export function formatCompact(value: number, tag: string) {
  if (!Number.isFinite(value)) return "—"
  if (Math.abs(value) < 1_000_000) return new Intl.NumberFormat(tag).format(value)
  return new Intl.NumberFormat(tag, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

/** `+2.8%` / `−1.4%` / `0%`. The sign is part of the string, never a colour. */
export function formatDelta(fraction: number, tag: string) {
  const percent = new Intl.NumberFormat(tag, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(fraction)
  // U+2212 MINUS, not a hyphen: it is the width of the plus, so a column of
  // deltas stays aligned.
  return percent.replace("-", "−")
}

/* ── Geometry ─────────────────────────────────────────────────────────────── */

/**
 * The element's width, observed.
 *
 * Charts are drawn in real pixels rather than a `viewBox` that scales: a
 * scaled `viewBox` would stretch the 2px strokes and the type along with the
 * plot, and a hairline is a hairline at every width.
 */
export function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(fallback)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width
      if (next > 0) setWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

/* ── Blocks ─────────────────────────────────────────────────────────────── */

/**
 * The bevel every solid mark on this screen wears — a lit top edge and a
 * shaded bottom one, which is the whole of what makes a flat rectangle read as
 * a raised block.
 *
 * Translucent white and black rather than two more palette entries: the pair
 * lightens and darkens whatever fill it is laid over, so one constant serves
 * the accent, the de-emphasis grey and the warning tone, in both themes, and
 * no new colour has to clear the palette validator. Every edge is a hard 1px
 * line, not a blend across the mark.
 *
 * The third shadow is the only one outside the block — a 1px drop that lifts
 * it off the card. Kept to one pixel: a meter is a row of dozens of these, and
 * a soft shadow repeated forty times turns a crisp row into a grey smear.
 */
export const BLOCK_BEVEL =
  "inset 0 1px 0 rgba(255,255,255,0.34)," +
  " inset 0 -1px 0 rgba(0,0,0,0.22)," +
  " 0 1px 1px rgba(0,0,0,0.10)"

/**
 * A proportion, as a row of discrete blocks.
 *
 * ### Why blocks and not a bar
 *
 * A continuous bar asks the reader to judge one length against a track edge.
 * That is a fine judgement to ask for once and a poor one to ask for six times
 * down a card — the eye ends up comparing bar ends that are nowhere near each
 * other. Blocks turn the same value into a count, and counting is the one
 * quantitative judgement people make without error. It is also the treatment
 * DESIGN.md §8.6 already specifies for meters elsewhere in the app, so the
 * overview stops being the one screen with its own kind of bar.
 *
 * ### The blocks are square at every width
 *
 * Fixed-size blocks with a fixed gap, and the *count* falls out of the measured
 * width — not a fixed count stretched to fit, which would draw squares on a
 * wide card and letterboxes on a narrow one. Resolution therefore rises with
 * the room available, which is the right way round: a wider card can afford a
 * finer reading.
 *
 * Decorative, and `aria-hidden` — every meter on this screen sits beside the
 * figure it encodes, so there is nothing here a screen reader would miss.
 */
export function TickMeter({
  value,
  max,
  size = 10,
  gap = 3,
  color = "var(--viz-accent)",
  className,
}: {
  value: number
  max: number
  /** Block edge in px — they are square. */
  size?: number
  gap?: number
  /** The lit face. Unlit blocks always take the recessive grid step. */
  color?: string
  className?: string
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(240)

  const count = Math.max(6, Math.floor((width + gap) / (size + gap)))
  // A non-zero value always lights at least one block: rounding a small
  // fraction down to nothing would draw "a few" as "none".
  const lit =
    value > 0 && max > 0
      ? Math.min(count, Math.max(1, Math.round((value / max) * count)))
      : 0

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("flex w-full items-center", className)}
      style={{ gap }}
    >
      {Array.from({ length: count }, (_, i) => {
        const on = i < lit
        return (
          <span
            key={i}
            data-await-intro
            className={cn(
              "shrink-0 rounded-[2px]",
              // Only the lit run animates, and it fills from the start edge
              // like a meter charging. The stagger is capped so a 70-block row
              // still finishes inside the same beat as a 20-block one.
              on && "animate-[viz-fade-up_280ms_cubic-bezier(0.16,1,0.3,1)_both]"
            )}
            style={{
              width: size,
              height: size,
              background: on ? color : "var(--viz-grid)",
              boxShadow: on ? BLOCK_BEVEL : undefined,
              animationDelay: on ? `${140 + Math.min(i, 44) * 11}ms` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}

/* ── Hover ────────────────────────────────────────────────────────────────── */

export type TooltipRow = {
  label: string
  value: string
  /** Draws a short stroke of this colour beside the row — a line key (§ marks). */
  swatch?: string
}

export type TooltipState = {
  /** Anchor, in the container's own coordinates. */
  x: number
  y: number
  /** How far the mark reaches either side of `x`. When the readout has to sit
   *  beside the mark instead of above it, it clears this much. */
  reach?: number
  title: string
  rows: TooltipRow[]
} | null

/**
 * The hover/focus readout.
 *
 * Values lead and labels follow — the legend's hierarchy inverted, because by
 * the time a reader is here they already know the series and want the number.
 * Series are keyed with a short stroke rather than a filled box: at this
 * density a box is data-weight ink doing a label's job.
 *
 * Positioned inside the chart's own `relative` box and clamped to it, so it
 * never escapes a card or forces the page to scroll. It sits above the anchor
 * when there is room; when there is not — the tallest column's cap is a few
 * pixels under the plot's top edge, and the card clips whatever crosses it —
 * it steps to the side of the mark instead, so it neither gets cut off nor
 * covers the block it is describing. It measures itself to decide, because
 * a one-row readout and a two-row one are 20px apart and the guess that
 * fits one clips the other. `pointer-events-none` throughout — a tooltip
 * that can be hovered steals the pointer from the marks underneath and makes
 * the readout flicker.
 *
 * Every value this shows is also reachable without hovering: each chart ships
 * a table view under `<details>`, and the marks carry direct labels. The
 * tooltip enhances, it never gates.
 */
export function VizTooltip({
  state,
  width,
  align = "center",
}: {
  state: TooltipState
  /** The container's width, for clamping. */
  width: number
  align?: "center" | "start"
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // Starts at the size of a two-row readout; corrected before first paint.
  const [size, setSize] = React.useState({ w: 176, h: 80 })
  // Re-measured whenever the content changes — a different bucket may carry
  // one row or two — and a no-op when the box comes back the same size.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
  }, [state])

  if (!state) return null

  const EDGE = 4
  const GAP = 10
  const reach = state.reach ?? 0
  const fitsAbove = state.y - size.h >= 0

  let left: number
  let top: number
  let transform: string | undefined

  if (fitsAbove) {
    // Above the anchor, clamped so the card's edge is never crossed. The
    // clamp uses the measured half-width, so a narrow readout sits centred
    // and a wide one simply stops short of the edge.
    const half = size.w / 2
    left =
      align === "start"
        ? Math.min(Math.max(state.x, 8), Math.max(8, width - size.w - 8))
        : Math.min(Math.max(state.x, half + EDGE), Math.max(half + EDGE, width - half - EDGE))
    top = state.y
    transform = align === "start" ? "translateY(-100%)" : "translate(-50%, -100%)"
  } else {
    // Beside the mark, its top on the anchor. Right of it by default — the
    // plot always runs left-to-right — and left of it when the right side
    // would cross the edge; on a plot too narrow for either, back to the
    // clamp, where overlapping a neighbour beats being cut off.
    const right = state.x + reach + GAP
    const leftOf = state.x - reach - GAP - size.w
    left =
      right + size.w <= width - EDGE
        ? right
        : leftOf >= EDGE
          ? leftOf
          : Math.min(Math.max(state.x - size.w / 2, EDGE), Math.max(EDGE, width - size.w - EDGE))
    top = Math.max(0, state.y)
  }

  return (
    <div
      ref={ref}
      role="tooltip"
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 min-w-38 rounded-lg px-3 py-2",
        "bg-popover text-popover-foreground",
        "shadow-[0_0_0_1px_var(--border),0_8px_24px_-8px_rgba(0,0,0,0.28)]",
        "dark:shadow-[0_0_0_1px_var(--border-strong),0_12px_32px_-8px_rgba(0,0,0,0.7)]"
      )}
      style={{
        left,
        top,
        transform,
        // The readout is Latin-numeral tabular data in both languages; letting
        // it mirror under RTL would put the value on the wrong side of its key.
        direction: "ltr",
      }}
    >
      <p className="text-[11px] font-medium tracking-[0.04em] text-text-muted uppercase">
        {state.title}
      </p>
      <div className="mt-1.5 flex flex-col gap-1">
        {state.rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            {row.swatch ? (
              <span
                aria-hidden
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={{ background: row.swatch }}
              />
            ) : null}
            <span className="text-sm font-semibold tabular-nums text-text">
              {row.value}
            </span>
            <span className="truncate text-xs text-text-secondary">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Chrome ───────────────────────────────────────────────────────────────── */

/**
 * The card every non-hero chart sits in — DESIGN.md §9.1, plus one addition.
 *
 * The addition is the hover: `border` → `border-strong` at 120ms, no lift and
 * no shadow in dark mode (§9.6). It is on because every one of these cards
 * *is* interactive — the marks inside respond to the pointer — and a card that
 * never acknowledges the pointer reads as an image of a chart.
 */
export function VizCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "group/viz relative flex flex-col rounded-xl border border-border bg-surface",
        "transition-[border-color,box-shadow] duration-120",
        "hover:border-border-strong hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        "dark:hover:shadow-none",
        className
      )}
      {...props}
    />
  )
}

/**
 * A chart card's header: title, optional count, optional trailing control.
 *
 * 16px/600 title over a 12px muted caption, matching §9.2 — the same header
 * the list and table cards on every other screen use, so the overview does not
 * invent a second one.
 */
export function VizCardHead({
  title,
  caption,
  action,
}: {
  title: string
  caption?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <h3 className="text-[15px] leading-snug font-semibold text-text">{title}</h3>
        {caption ? <p className="mt-1 text-xs text-text-muted">{caption}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/**
 * The "this part is modelled" mark.
 *
 * `/statistics` cannot answer everything this screen draws (see
 * `features/statistics/derive.ts`). Where a number is modelled rather than
 * measured it is labelled, here, in the open — an unmarked estimate on an
 * admin dashboard is the one thing on this page that could actually cost
 * somebody something.
 */
export function EstimatedMark({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-placeholder">
      <span aria-hidden className="size-1 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  )
}

/**
 * The table twin every chart carries.
 *
 * Collapsed by default and reachable by keyboard. It is what makes the charts
 * legal without relying on colour or hover: every value a mark or a tooltip
 * shows is also here as text, which is the WCAG-clean equivalent of the whole
 * visual layer.
 */
export function VizTable({
  label,
  columns,
  rows,
}: {
  label: string
  columns: string[]
  rows: Array<Array<string | number>>
}) {
  return (
    <details className="group/table border-t border-border-subtle">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1.5 px-5 py-3",
          "text-xs font-medium text-text-muted select-none",
          "transition-colors duration-120 hover:text-text",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        )}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-3 shrink-0 transition-transform duration-180 group-open/table:rotate-90 rtl:-scale-x-100"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3.5 10.5 8 6 12.5" />
        </svg>
        {label}
      </summary>
      <div className="max-h-64 overflow-auto px-5 pb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted">
              {columns.map((column, i) => (
                <th
                  key={column}
                  scope="col"
                  className={cn(
                    "sticky top-0 bg-surface py-1.5 font-medium",
                    i === 0 ? "text-start" : "text-end"
                  )}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-border-subtle">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      "py-1.5",
                      c === 0
                        ? "text-start text-text-secondary"
                        : "text-end tabular-nums text-text"
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
