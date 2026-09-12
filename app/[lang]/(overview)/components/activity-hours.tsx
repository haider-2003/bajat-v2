"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { EmptyCell } from "@/components/ui/data-bits"
import type { ActivityCell } from "@/features/statistics/types"
import { localeTag } from "@/i18n/config"
import { useDir, useLocale, useT } from "@/i18n/context"

import { EstimatedMark, VizCard, VizCardHead, VizTable } from "./chart-kit"

/** Two-hour blocks, 00:00–02:00 through 22:00–24:00. */
const BLOCKS = 12

type HourPoint = { block: number; label: string; value: number }

/**
 * When applications arrive, as a shadcn bar chart of the day.
 *
 * The model still carries weekday × block (see `deriveActivity`), but the
 * card folds it to twelve two-hour blocks summed across the week: the
 * question it answers is "which hours need reviewers", and a single row of
 * bars answers that at a glance where a seven-row heat grid asked the reader
 * to scan for the darkest square. Time runs left → right in both languages,
 * as it does on the pulse panel above, so the SVG is pinned `ltr`; the
 * tooltip is HTML and follows the document direction.
 */
export function ActivityHours({
  cells,
  estimated,
  className,
}: {
  cells: ActivityCell[]
  estimated: boolean
  className?: string
}) {
  const t = useT()
  const tag = localeTag[useLocale()]
  const rtl = useDir() === "rtl"

  const number = React.useMemo(() => new Intl.NumberFormat(tag), [tag])

  const blockLabel = (block: number) =>
    `${String(block * 2).padStart(2, "0")}:00–${String(block * 2 + 2).padStart(2, "0")}:00`

  const points = React.useMemo<HourPoint[]>(() => {
    const sums = Array.from({ length: BLOCKS }, () => 0)
    for (const cell of cells) sums[cell.block] = (sums[cell.block] ?? 0) + cell.value
    return sums.map((value, block) => ({ block, label: blockLabel(block), value }))
  }, [cells])

  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0])
  const empty = points.every((point) => point.value === 0)

  const config = {
    value: { label: t("overview.activity.applications"), color: "var(--viz-accent)" },
  } satisfies ChartConfig

  return (
    <VizCard className={className}>
      <VizCardHead
        title={t("overview.activity.title")}
        caption={t("overview.activity.caption")}
        action={
          !empty && peak ? (
            <span className="hidden text-xs text-text-muted sm:inline">
              {t("overview.activity.peak", { hours: peak.label })}
            </span>
          ) : undefined
        }
      />

      {empty ? (
        <div className="px-5 pb-6">
          <EmptyCell icon={Clock} label={t("overview.activity.empty")} />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <ChartContainer
            config={config}
            className="aspect-auto h-[200px] w-full"
            style={{ direction: "ltr" }}
            aria-label={t("overview.activity.chartLabel")}
          >
            <BarChart
              accessibilityLayer
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              barCategoryGap={4}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="block"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                // Every other block, as the hour it starts: 00 · 04 · 08 …
                interval={1}
                tickFormatter={(block: number) => String(block * 2).padStart(2, "0")}
              />
              <ChartTooltip
                cursor={false}
                wrapperStyle={{ direction: rtl ? "rtl" : "ltr" }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(_label, payload) =>
                      (payload?.[0]?.payload as HourPoint | undefined)?.label ?? null
                    }
                    formatter={(value) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          {t("overview.activity.applications")}
                        </span>
                        <span className="font-medium tabular-nums">
                          {number.format(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      {estimated && !empty ? (
        <div className="border-t border-border-subtle px-5 py-3">
          <EstimatedMark>{t("overview.activity.estimated")}</EstimatedMark>
        </div>
      ) : null}

      <VizTable
        label={t("overview.tableView")}
        columns={[t("overview.activity.hours"), t("overview.activity.applications")]}
        rows={points.map((point) => [point.label, number.format(point.value)])}
      />
    </VizCard>
  )
}
