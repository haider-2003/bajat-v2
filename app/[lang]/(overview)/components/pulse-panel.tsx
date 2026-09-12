"use client"

import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import type { PulsePoint } from "@/features/statistics/types"
import { localeTag } from "@/i18n/config"
import { useLocale, useT } from "@/i18n/context"
import { cn } from "@/lib/utils"
import { EMPTY_VALUE } from "@/utils/format"

import {
  EstimatedMark,
  formatCompact,
  formatDelta,
  useCountUp,
  useMeasuredWidth,
  VizTable,
  VizTooltip,
  type TooltipState,
} from "./chart-kit"

/**
 * The issuance pulse — the screen's lead.
 *
 * ### It leads on size, not on decoration
 *
 * This card once carried a tinted gradient ground and a radial bloom behind
 * the plot, on the theory that the lead element has to look different from the
 * cards under it. It did, but the difference it bought was atmosphere — and
 * atmosphere behind a chart is ink competing with the marks, on a screen whose
 * whole job is to be read quickly.
 *
 * So it is the same flat card as everything else (§9.1: surface on grey, a
 * hairline for an edge, no shadow) and leads on the only two channels that
 * cost the reader nothing: it is the first thing on the page, and its figure
 * is set at 44px against the tiles' 28px. Hierarchy out of size and position
 * is hierarchy that survives a theme change, a screenshot, and a printer.
 *
 * ### Columns, not a curve
 *
 * This chart was first drawn as a monotone spline with an area wash under it,
 * and it was wrong twice over. A spline draws *continuity* — it says the value
 * moved smoothly from one month to the next — but monthly totals are twelve
 * discrete buckets with nothing in between, so every curve between two points
 * was an assertion about days that have no data. And on a tenant with eight
 * near-empty months it degenerated into decorative hills: two big blobs and a
 * long flat stretch, which is an illustration, not a chart.
 *
 * Columns say exactly what is true and nothing more: one mark per bucket, a
 * common baseline, height linear in count. They also survive sparse data — a
 * zero month is visibly a zero month rather than a flat section of curve.
 *
 * ### Each column is a block
 *
 * Three flat faces: a front, a lit top and a shaded side. The **front** face
 * is the mark — its height is exactly linear in the count, so the thing a
 * reader measures is undistorted. The extrusion is a *constant* depth on every
 * column, which means it shifts the whole series by the same amount and can
 * never change one column's reading relative to another's.
 *
 * That is the line between an extruded chart and a lying one, and it is worth
 * stating because most 3-D bar charts cross it: they ramp the depth with
 * perspective, and then a column is taller for being near.
 *
 * The blocks stand on a floor — a slab the same `depth` deep, one flat tone —
 * and the gridlines sit on the back wall behind them, offset by that same
 * depth, so a block's top-back edge meets the line for its value. Floor and
 * wall are what make the extrusion read as space rather than as a bevel; they
 * are still nothing but flat fills and hairlines.
 *
 * ### The current bucket is drawn as unfinished
 *
 * The last column is the month (or week, or day) in progress, so it is
 * *always* short through no fault of the business. Its body is ghosted while
 * its top face stays solid — a block that is present and counted but visibly
 * still filling — and the delta chip ignores it entirely (see `deriveOverview`).
 */

/** Plot insets. The bottom band is reserved for x labels, so they can never be
 *  the thing that overflows the panel and nests a scrollbar inside it. */
const PAD = { top: 38, right: 22, bottom: 30, left: 44 }
const PLOT_HEIGHT = 292

/** Widest a column is allowed to get, however much room the panel has. */
const MAX_COLUMN = 30

/**
 * The three faces of an extruded block, square-cornered.
 *
 * `front` is the value. `top` and `side` are the same `d` px on every column,
 * so the extrusion is a constant offset and not a perspective — see the note
 * above. Three closed paths rather than one silhouette, because each face
 * takes a different overlay.
 */
function blockFaces(x: number, y: number, w: number, h: number, d: number) {
  return {
    front: `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`,
    top: `M${x} ${y} L${x + d} ${y - d} L${x + w + d} ${y - d} L${x + w} ${y} Z`,
    side:
      `M${x + w} ${y} L${x + w + d} ${y - d}` +
      ` L${x + w + d} ${y + h - d} L${x + w} ${y + h} Z`,
  }
}

export function PulsePanel({
  points,
  delta,
  organizations,
  estimatedBuckets,
  rangeLabel,
}: {
  points: PulsePoint[]
  delta: number | null
  organizations: number
  estimatedBuckets: boolean
  rangeLabel: string
}) {
  const t = useT()
  const tag = localeTag[useLocale()]
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(720)
  const [active, setActive] = React.useState<number | null>(null)

  /**
   * The hero figure is the sum of what is plotted, not the all-time total.
   *
   * It used to be `total_identities`, and that put a lifetime number directly
   * above a twelve-month chart under one heading — two different questions
   * answered by one figure. The range control scopes everything below it, so
   * the lead figure has to be scoped too. The lifetime total still exists, on
   * its own tile, labelled all-time.
   */
  const windowTotal = points.reduce((sum, point) => sum + point.value, 0)
  const counted = useCountUp(windowTotal)

  const plotW = Math.max(80, width - PAD.left - PAD.right)
  const plotH = PLOT_HEIGHT - PAD.top - PAD.bottom
  const band = points.length > 0 ? plotW / points.length : plotW
  const columnW = Math.min(MAX_COLUMN, band * 0.58)
  // Extrusion depth, proportional to the column: a 30-day range should not
  // wear the same shoulder as a 12-month one on columns twice the width.
  // Clamped at both ends — under 5px the faces vanish, over 14px the top
  // face is a bigger shape than a short front and starts to read as data —
  // and always smaller than the 42% gap, so blocks never overlap.
  const depth = Math.max(5, Math.min(14, Math.round(columnW * 0.45)))

  /**
   * The scale's ceiling, rounded up to something a reader can name.
   *
   * Forced even and never below two: the mid gridline is half the ceiling, and
   * an odd or tiny ceiling labels it `0.5` — half an ID card, on a chart that
   * only ever counts whole ones.
   */
  const { ceiling, gridValues } = React.useMemo(() => {
    const max = Math.max(1, ...points.map((p) => p.value))
    const step = Math.pow(10, Math.floor(Math.log10(max)))
    const rounded = Math.ceil(max / (step / 2)) * (step / 2)
    const top = Math.max(2, Math.ceil(rounded / 2) * 2)
    return { ceiling: top, gridValues: [top, top / 2] }
  }, [points])

  const baseline = PAD.top + plotH
  const heightOf = (value: number) => (value / ceiling) * plotH
  const xOf = (index: number) => PAD.left + index * band + (band - columnW) / 2

  /** The index of the tallest bucket — the one value worth direct-labelling. */
  const peakIndex = points.reduce(
    (best, point, i) => (point.value > (points[best]?.value ?? -1) ? i : best),
    0
  )

  /**
   * Which buckets get an x label.
   *
   * Stepped **backwards from the last**, so the series always ends on a label
   * and the gaps stay even. Stepping forwards from zero left `Aug` and `Sep`
   * touching at the right edge while every other pair sat two apart.
   *
   * The 104px budget is sized for the longest month name this app renders —
   * Arabic's `تشرين الأول` — rather than for `Sep`.
   */
  const labelled = React.useMemo(() => {
    const budget = Math.max(2, Math.floor(plotW / 104))
    const step = Math.max(1, Math.ceil(points.length / budget))
    const set = new Set<number>()
    for (let i = points.length - 1; i >= 0; i -= step) set.add(i)
    return set
  }, [points.length, plotW])

  const activePoint = active !== null ? points[active] : null
  const tooltip: TooltipState =
    activePoint && active !== null
      ? {
          x: xOf(active) + columnW / 2 + depth / 2,
          y: baseline - heightOf(activePoint.value) - depth - 12,
          title: activePoint.label,
          rows: [
            {
              label: activePoint.isCurrent
                ? t("overview.pulse.inProgress")
                : t("overview.pulse.issued"),
              value: new Intl.NumberFormat(tag).format(activePoint.value),
              swatch: "var(--viz-accent)",
            },
            ...(activePoint.previous !== null
              ? [
                  {
                    label: t("overview.pulse.previousBucket"),
                    value: new Intl.NumberFormat(tag).format(activePoint.previous),
                  },
                ]
              : []),
          ],
        }
      : null

  /**
   * Keyboard parity with the pointer.
   *
   * The plot takes a single tab stop and the arrow keys walk the buckets,
   * rather than thirty focusable rects that would bury the rest of the page
   * behind thirty tab presses. Whatever is focused shows what hover shows.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    if (points.length === 0) return
    const last = points.length - 1
    const current = active ?? last

    // Logical, not physical: the plot is drawn left-to-right in both languages
    // (the numerals are Latin under `ar-IQ`), but the arrow key a reader
    // presses to move "forward in time" is the one their text runs in.
    const rtl = document.documentElement.dir === "rtl"
    const back = rtl ? "ArrowRight" : "ArrowLeft"
    const forward = rtl ? "ArrowLeft" : "ArrowRight"

    if (event.key === back) setActive(Math.max(0, current - 1))
    else if (event.key === forward) setActive(Math.min(last, current + 1))
    else if (event.key === "Home") setActive(0)
    else if (event.key === "End") setActive(last)
    else if (event.key === "Escape") setActive(null)
    else return

    event.preventDefault()
  }

  // `delta === null` means there was no comparable previous period — a tenant
  // whose prior bucket was empty. It gets the neutral chip and a caption that
  // says so, rather than a `0%` that would claim nothing had changed.
  const deltaTone =
    delta === null ? "neutral" : delta > 0 ? "success" : delta < 0 ? "danger" : "neutral"
  const DeltaIcon =
    delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <section
      data-await-intro
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface",
        "animate-[viz-fade-up_520ms_cubic-bezier(0.16,1,0.3,1)_both]"
      )}
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-stretch lg:gap-10">
        {/* ── The figure ────────────────────────────────────────────────── */}
        <div className="flex shrink-0 flex-col justify-between lg:w-64">
          <div>
            <p className="text-xs font-medium tracking-[0.08em] text-text-muted uppercase">
              {t("overview.pulse.label")}
            </p>

            {/* The hero figure — one per view, in the app's own sans, and
                deliberately NOT tabular: equal-width digits make a number this
                large look loose (§ figures). */}
            <p className="mt-2 text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.03em] text-text sm:text-5xl">
              {formatCompact(counted, tag)}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium",
                  deltaTone === "success" && "bg-success-bg text-success",
                  deltaTone === "danger" && "bg-danger-bg text-danger",
                  deltaTone === "neutral" && "bg-muted text-text-muted"
                )}
              >
                <DeltaIcon className="size-3.5 shrink-0" strokeWidth={2} />
                {delta === null ? EMPTY_VALUE : formatDelta(delta, tag)}
              </span>
              <span className="text-xs text-text-muted">
                {delta === null
                  ? t("overview.pulse.noComparison")
                  : t("overview.pulse.vsPrevious")}
              </span>
            </div>
          </div>

          <p className="mt-5 max-w-88 text-[13px] leading-relaxed text-text-secondary lg:mt-0">
            {t("overview.pulse.context", {
              range: rangeLabel,
              organizations: new Intl.NumberFormat(tag).format(organizations),
            })}
          </p>
        </div>

        {/* ── The plot ──────────────────────────────────────────────────── */}
        <div ref={ref} className="relative min-w-0 flex-1">
          <svg
            width={width}
            height={PLOT_HEIGHT}
            role="img"
            tabIndex={0}
            aria-label={t("overview.pulse.chartLabel", { range: rangeLabel })}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className={cn(
              "block touch-pan-y rounded-lg outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "focus-visible:ring-offset-surface"
            )}
            // The time axis runs left-to-right in both languages; mirroring it
            // under RTL would put "now" on the left and read as a countdown.
            style={{ direction: "ltr" }}
          >
            {/* The floor: a slab exactly `depth` deep, the plane the blocks
                stand on. Its front edge is the baseline; its back edge is the
                baseline of the back wall. One flat tone, edged in the grid
                hairline — no shadow, no blend. */}
            <path
              d={
                `M${PAD.left} ${baseline} L${PAD.left + depth} ${baseline - depth}` +
                ` L${PAD.left + plotW + depth} ${baseline - depth}` +
                ` L${PAD.left + plotW} ${baseline} Z`
              }
              fill="var(--viz-floor)"
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />

            {/* Scale — two hairlines on the *back* wall, offset by the same
                `depth` as every block, so a block's top-back edge lands exactly
                on the line for its value. Solid and recessive; no vertical
                gridlines, the columns are the x-structure. */}
            {gridValues.map((value) => {
              const y = baseline - depth - heightOf(value)
              return (
                <g key={value}>
                  <line
                    x1={PAD.left + depth}
                    x2={PAD.left + plotW + depth}
                    y1={y}
                    y2={y}
                    stroke="var(--viz-grid)"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left + depth - 10}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-text-placeholder text-[10px] tabular-nums"
                  >
                    {formatCompact(value, tag)}
                  </text>
                </g>
              )
            })}

            {/* The columns. */}
            {points.map((point, i) => {
              const h = heightOf(point.value)
              const x = xOf(i)
              const isActive = active === i

              // A zero bucket still gets a mark: a 3px slab lying on the floor,
              // so "nothing was issued" reads as a measured zero rather than
              // as a month the chart forgot to draw. It wears the grid tone,
              // not the accent — a tile, not a block.
              if (point.value === 0) {
                const slab = blockFaces(x, baseline - 3, columnW, 3, depth)
                return (
                  <g key={`${point.label}-${i}`}>
                    <path d={slab.front} fill="var(--viz-grid)" />
                    <path d={slab.side} fill="var(--viz-grid)" />
                    <path d={slab.side} fill="#000" opacity={0.3} />
                    <path d={slab.top} fill="var(--viz-grid)" />
                    <path d={slab.top} fill="#fff" opacity={0.12} />
                  </g>
                )
              }

              // The same depth on every block, however short: the side face
              // is a parallelogram at any height, so a 2px column simply gets
              // a 2px-tall sliver of side — and the extrusion stays a constant
              // offset across the series, which is the whole point of it.
              const face = blockFaces(x, baseline - h, columnW, h, depth)

              return (
                <g
                  key={`${point.label}-${i}`}
                  data-await-intro
                  className="origin-bottom transform-fill animate-[viz-grow-y_520ms_cubic-bezier(0.16,1,0.3,1)_both]"
                  style={{ animationDelay: `${160 + i * 38}ms` }}
                >
                  {/* Body. The in-progress bucket is ghosted; every other
                      column is nearly opaque and lifts to full on hover, so
                      the pointer is always acknowledged. */}
                  <g
                    opacity={point.isCurrent ? 0.28 : isActive ? 1 : 0.9}
                    className="transition-opacity duration-120"
                  >
                    <path d={face.front} fill="var(--viz-accent)" />
                    <path d={face.side} fill="var(--viz-accent)" />
                    {/* Shade and highlight are translucent black and white
                        rather than two more palette entries — the same trick
                        `BLOCK_BEVEL` plays on the meters, for the same reason:
                        one pair works over any fill, in either theme. */}
                    <path d={face.side} fill="#000" opacity={0.36} />
                  </g>

                  {/* The cap stays solid, the in-progress bucket included: a
                      block still filling is still a measured block, and the
                      lit face is what makes it read as one. */}
                  <path d={face.top} fill="var(--viz-accent)" />
                  <path d={face.top} fill="#fff" opacity={0.44} />
                </g>
              )
            })}

            {/* One direct label, on the extreme — never a number on every
                column (§ labels are sparing, or they stop working). */}
            {points[peakIndex] && points[peakIndex].value > 0 ? (
              <text
                x={xOf(peakIndex) + columnW / 2 + depth / 2}
                y={baseline - heightOf(points[peakIndex].value) - depth - 8}
                textAnchor="middle"
                className="fill-text-secondary text-[11px] font-medium tabular-nums"
              >
                {formatCompact(points[peakIndex].value, tag)}
              </text>
            ) : null}

            {/* x labels, in the band reserved for them. */}
            {points.map((point, i) =>
              labelled.has(i) ? (
                <text
                  key={`x-${point.label}-${i}`}
                  x={xOf(i) + columnW / 2}
                  y={baseline + 18}
                  textAnchor="middle"
                  className={cn(
                    "text-[10px]",
                    point.isCurrent
                      ? "fill-text-secondary font-medium"
                      : "fill-text-placeholder"
                  )}
                >
                  {point.label}
                </text>
              ) : null
            )}

            {/* Hit targets: the whole band, top to bottom — far bigger than the
                mark, so a short column is as easy to reach as a tall one. */}
            {points.map((point, i) => (
              <rect
                key={`hit-${point.label}-${i}`}
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
              />
            ))}
          </svg>

          <VizTooltip state={tooltip} width={width} />
        </div>
      </div>

      {estimatedBuckets ? (
        <div className="border-t border-border-subtle px-5 py-3 sm:px-6">
          <EstimatedMark>{t("overview.pulse.estimatedBuckets")}</EstimatedMark>
        </div>
      ) : null}

      <div>
        <VizTable
          label={t("overview.tableView")}
          columns={[t("overview.pulse.bucket"), t("overview.pulse.issued")]}
          rows={points.map((point) => [
            point.isCurrent
              ? `${point.label} · ${t("overview.pulse.inProgress")}`
              : point.label,
            new Intl.NumberFormat(tag).format(point.value),
          ])}
        />
      </div>
    </section>
  )
}
