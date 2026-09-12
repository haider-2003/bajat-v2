"use client"

import * as React from "react"
import { Workflow } from "lucide-react"
import { Area, AreaChart, CartesianGrid, LabelList, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { EmptyCell } from "@/components/ui/data-bits"
import type { PipelineStage } from "@/features/statistics/types"
import { localeTag } from "@/i18n/config"
import { useDir, useLocale, useT } from "@/i18n/context"

import { EstimatedMark, formatCompact, VizCard, VizCardHead, VizTable } from "./chart-kit"

/**
 * Request → card, as a shadcn area chart.
 *
 * Four points, one per stage, in reading order (the x-axis is reversed under
 * Arabic — this is a sequence, not a time axis). Straight segments, so the
 * slope of each one *is* the change between two stages; a flat wash under the
 * line, no gradient. One series, one hue (`--viz-accent`), no legend — the
 * title names it. Everything the plot shows is also in the table beneath.
 */
export function PipelineSteps({
  stages,
  estimatedDwell,
}: {
  stages: PipelineStage[]
  estimatedDwell: boolean
}) {
  const t = useT()
  const tag = localeTag[useLocale()]
  const rtl = useDir() === "rtl"

  const number = React.useMemo(() => new Intl.NumberFormat(tag), [tag])
  const percent = React.useMemo(
    () => new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 }),
    [tag]
  )
  const start = stages[0]?.value ?? 0

  const config = {
    value: { label: t("overview.pipeline.count"), color: "var(--viz-accent)" },
  } satisfies ChartConfig

  // A tenant with no applications has no pipeline: a flat line along the
  // baseline over four zeroes reads as a broken card rather than an empty one.
  if (stages.every((stage) => stage.value === 0)) {
    return (
      <VizCard>
        <VizCardHead
          title={t("overview.pipeline.title")}
          caption={t("overview.pipeline.caption")}
        />
        <div className="px-5 pb-6">
          <EmptyCell icon={Workflow} label={t("overview.pipeline.empty")} />
        </div>
      </VizCard>
    )
  }

  return (
    <VizCard>
      <VizCardHead
        title={t("overview.pipeline.title")}
        caption={t("overview.pipeline.caption")}
      />

      <div className="px-5 pb-5">
        <ChartContainer
          config={config}
          className="aspect-auto h-[220px] w-full"
          aria-label={t("overview.pipeline.chartLabel")}
        >
          <AreaChart
            accessibilityLayer
            data={stages}
            margin={{ top: 24, right: 24, bottom: 0, left: 24 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              reversed={rtl}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, _name, item) => {
                    const stage = item.payload as PipelineStage
                    return (
                      <div className="flex w-full flex-col gap-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            {t("overview.pipeline.count")}
                          </span>
                          <span className="font-medium tabular-nums">
                            {number.format(Number(value))}
                          </span>
                        </div>
                        {stage.id !== "submitted" && start > 0 ? (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              {t("overview.pipeline.ofSubmitted")}
                            </span>
                            <span className="tabular-nums">
                              {percent.format(stage.value / start)}
                            </span>
                          </div>
                        ) : null}
                        {stage.dropped > 0 ? (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              {t("overview.pipeline.lostHere")}
                            </span>
                            <span className="tabular-nums" dir="ltr">
                              −{number.format(stage.dropped)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            {t("overview.pipeline.dwell")}
                          </span>
                          <span className="tabular-nums">
                            {t("overview.pipeline.days", { days: stage.dwellDays })}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
              }
            />
            <Area
              dataKey="value"
              type="linear"
              fill="var(--color-value)"
              fillOpacity={0.1}
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--color-value)", strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="value"
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
                fontWeight={600}
                formatter={(value) => formatCompact(Number(value), tag)}
              />
            </Area>
          </AreaChart>
        </ChartContainer>
      </div>

      {estimatedDwell ? (
        <div className="border-t border-border-subtle px-5 py-3">
          <EstimatedMark>{t("overview.pipeline.estimatedDwell")}</EstimatedMark>
        </div>
      ) : null}

      <VizTable
        label={t("overview.tableView")}
        columns={[
          t("overview.pipeline.stage"),
          t("overview.pipeline.count"),
          t("overview.pipeline.dropped"),
          t("overview.pipeline.dwell"),
        ]}
        rows={stages.map((stage) => [
          stage.label,
          number.format(stage.value),
          stage.dropped > 0 ? `−${number.format(stage.dropped)}` : "—",
          t("overview.pipeline.days", { days: stage.dwellDays }),
        ])}
      />
    </VizCard>
  )
}
