"use client"

import * as React from "react"
import { Building2 } from "lucide-react"
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { EmptyCell } from "@/components/ui/data-bits"
import type { OrgRank } from "@/features/statistics/types"
import { localeTag } from "@/i18n/config"
import { useDir, useLocale, useT } from "@/i18n/context"

import { formatCompact, VizCard, VizCardHead, VizTable } from "./chart-kit"

/** Row pitch of the bar chart, so six rows and two rows are both the right height. */
const ROW = 40

/** Longest org name the category axis will print; the tooltip carries the rest. */
const NAME_CHARS = 22

/**
 * Top organizations, as a shadcn horizontal bar chart.
 *
 * Nominal categories sorted by value, so one series in one hue — the accent —
 * and no legend. The bars grow from the reading edge: under Arabic the number
 * axis is reversed and the names sit on the right, so the card mirrors with
 * the text instead of leaving a Latin-order chart in an Arabic column. The
 * SVG itself is pinned `ltr` so Recharts' anchors stay physical; the tooltip,
 * which is HTML, follows the document direction again.
 */
export function OrgRanking({
  rows,
  className,
}: {
  rows: OrgRank[]
  className?: string
}) {
  const t = useT()
  const tag = localeTag[useLocale()]
  const rtl = useDir() === "rtl"

  const number = React.useMemo(() => new Intl.NumberFormat(tag), [tag])
  const percent = React.useMemo(
    () => new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 }),
    [tag]
  )
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  const config = {
    value: { label: t("overview.orgs.identities"), color: "var(--viz-accent)" },
  } satisfies ChartConfig

  const truncate = (name: string) =>
    name.length > NAME_CHARS ? `${name.slice(0, NAME_CHARS - 1).trimEnd()}…` : name

  return (
    <VizCard className={className}>
      <VizCardHead
        title={t("overview.orgs.title")}
        caption={t("overview.orgs.caption")}
      />

      {rows.length === 0 ? (
        <div className="px-5 pb-6">
          <EmptyCell icon={Building2} label={t("overview.orgs.empty")} />
        </div>
      ) : (
        <div className="px-5 pb-5">
          <ChartContainer
            config={config}
            className="aspect-auto w-full"
            style={{ height: rows.length * ROW + 8, direction: "ltr" }}
            aria-label={t("overview.orgs.title")}
          >
            <BarChart
              accessibilityLayer
              data={rows}
              layout="vertical"
              margin={{ top: 4, bottom: 4, left: rtl ? 44 : 0, right: rtl ? 0 : 44 }}
              barCategoryGap={12}
            >
              <XAxis type="number" hide reversed={rtl} domain={[0, "dataMax"]} />
              <YAxis
                type="category"
                dataKey="name"
                orientation={rtl ? "right" : "left"}
                width="auto"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                interval={0}
                tickFormatter={truncate}
              />
              <ChartTooltip
                cursor={false}
                wrapperStyle={{ direction: rtl ? "rtl" : "ltr" }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(_label, payload) =>
                      (payload?.[0]?.payload as OrgRank | undefined)?.name ?? null
                    }
                    formatter={(value, _name, item) => {
                      const row = item.payload as OrgRank
                      return (
                        <div className="flex w-full flex-col gap-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              {t("overview.orgs.identities")}
                            </span>
                            <span className="font-medium tabular-nums">
                              {number.format(Number(value))}
                            </span>
                          </div>
                          {total > 0 ? (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">
                                {t("overview.orgs.share")}
                              </span>
                              <span className="tabular-nums">
                                {percent.format(row.value / total)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      )
                    }}
                  />
                }
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                // Rounded at the data end only; square where it meets the axis.
                // Recharts draws a bar from its axis end toward its tip, so on
                // a reversed axis the rectangle simply has a negative width and
                // the corner indices are the same in both directions.
                radius={[0, 4, 4, 0]}
                barSize={14}
                isAnimationActive={false}
              >
                {/* The value, just past the tip. Not `position="left|right"`:
                    those resolve against the same signed rectangle, so under a
                    reversed axis they land at the axis end, on top of the org
                    name. Taking the physical tip with min/max is direction-
                    proof. */}
                <LabelList
                  dataKey="value"
                  content={({ viewBox, value }) => {
                    if (!viewBox || !("width" in viewBox)) return null
                    const { x, y, width, height } = viewBox
                    const tip = rtl ? Math.min(x, x + width) - 8 : Math.max(x, x + width) + 8
                    return (
                      <text
                        x={tip}
                        y={y + height / 2}
                        dominantBaseline="central"
                        textAnchor={rtl ? "end" : "start"}
                        className="fill-foreground"
                        fontSize={12}
                        fontWeight={600}
                      >
                        {formatCompact(Number(value), tag)}
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}

      <VizTable
        label={t("overview.tableView")}
        columns={[
          t("overview.orgs.organization"),
          t("overview.orgs.identities"),
          t("overview.orgs.share"),
        ]}
        rows={rows.map((row) => [
          row.name,
          number.format(row.value),
          total > 0 ? percent.format(row.value / total) : "—",
        ])}
      />
    </VizCard>
  )
}
