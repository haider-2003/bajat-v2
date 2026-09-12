"use client"

import * as React from "react"
import { RotateCw } from "lucide-react"

import { Segmented } from "@/components/ui/segmented"
import { Skeleton } from "@/components/ui/skeleton"
import { deriveOverview } from "@/features/statistics/derive"
import { useGetStatistics } from "@/features/statistics/api"
import type { OverviewRange, PipelineStage } from "@/features/statistics/types"
import { useStickyState } from "@/hooks/use-sticky-state"
import { localeTag } from "@/i18n/config"
import { useLocale, useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

import { ActivityHours } from "./activity-hours"
import { Chapter } from "./chapter"
import { OrgRanking } from "./org-ranking"
import { PipelineSteps } from "./pipeline-steps"
import { PulsePanel } from "./pulse-panel"
import { RequestQueue } from "./request-queue"
import { StatTiles } from "./stat-tiles"

/**
 * The overview screen.
 *
 * ### The shape of the page
 *
 * Four chapters, in the order the questions get asked:
 *
 *  1. **Scale** — one hero panel (how many cards, over what curve) and the
 *     standing totals beneath it.
 *  2. **The pipeline** — four steps: the same population measured four times
 *     as it moves from application to card, with what was lost between any two
 *     of them printed in the gap.
 *  3. **Where the work comes from** — which organizations, and at what hours.
 *  4. **Right now** — the newest applications, each a link into real work.
 *
 * It narrows deliberately: a year, then a lifetime, then a typical week, then
 * six people who applied this morning. Everything before the last section is
 * an aggregate, and a page of nothing but aggregates gives the reader nowhere
 * to go.
 *
 * ### One filter row, above everything
 *
 * The range control sits in the title block and scopes every time series
 * below it. It is not repeated on any card — per-chart ranges are how two
 * charts on one screen end up disagreeing about the same week. The standing
 * totals are the deliberate exception and say so; see `stat-tiles.tsx`.
 */

const RANGE_KEY = "overview:range"

export function OverviewClient() {
  const t = useT()
  const locale = useLocale()
  const tag = localeTag[locale]

  const [range, setRange] = useStickyState<OverviewRange>(RANGE_KEY, "12m")
  const { data, isLoading, isFetching, isError, refetch } = useGetStatistics()

  /**
   * Bucket labels.
   *
   * `Intl` rather than dictionary entries: twelve month names and thirty day
   * labels in two languages is sixty strings a translator would have to keep
   * in step with the calendar, and the platform already has them — correctly
   * abbreviated, and under `ar-IQ-u-nu-latn` already in the Latin numerals
   * this app uses in both languages.
   */
  const labelFor = React.useCallback(
    (back: number) => {
      const now = new Date()
      if (range === "12m") {
        const month = new Date(now.getFullYear(), now.getMonth() - back, 1)
        return new Intl.DateTimeFormat(tag, { month: "short" }).format(month)
      }
      const days = range === "90d" ? back * 7 : back
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
      return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(day)
    },
    [range, tag]
  )

  const stageLabels: Record<PipelineStage["id"], string> = React.useMemo(
    () => ({
      submitted: t("overview.pipeline.stages.submitted"),
      review: t("overview.pipeline.stages.review"),
      approved: t("overview.pipeline.stages.approved"),
      issued: t("overview.pipeline.stages.issued"),
    }),
    [t]
  )

  const model = React.useMemo(
    () => deriveOverview(data, { range, labelFor, stageLabels }),
    [data, range, labelFor, stageLabels]
  )

  const rangeLabel = t(`overview.ranges.${range}`)

  if (isLoading) return <OverviewSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
        <p className="text-sm font-medium text-text">{t("common.loadFailed")}</p>
        <p className="text-[13px] text-text-muted">{t("common.cannotReachServer")}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3",
            "text-[13px] font-medium text-text transition-colors duration-120",
            "hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <RotateCw className="size-3.5 shrink-0" strokeWidth={2} />
          {t("common.retry")}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {/* The one filter row. It sits above everything it scopes and is never
          repeated on a card — per-chart ranges are how two charts on one
          screen end up disagreeing about the same week. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-text-muted">
          {t("overview.scopeNote", { range: rangeLabel })}
        </p>
        <Segmented
          value={range}
          onValueChange={setRange}
          label={t("overview.rangeLabel")}
          items={[
            { value: "30d", label: t("overview.ranges.30d") },
            { value: "90d", label: t("overview.ranges.90d") },
            { value: "12m", label: t("overview.ranges.12m") },
          ]}
        />
      </div>

      <div
        className={cn(
          "flex flex-col gap-10",
          // Refetching holds the previous render at reduced opacity rather
          // than collapsing to skeletons: the numbers are already on screen
          // and correct, and a skeleton flash would throw away the reader's
          // place.
          "transition-opacity duration-240",
          isFetching && "opacity-60"
        )}
      >
      {/* ── 01 · Scale ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <Chapter index={1} label={t("overview.chapters.scale")} aside={rangeLabel} />
        <PulsePanel
          points={model.pulse}
          delta={model.identitiesDelta}
          organizations={model.totals.organizations}
          estimatedBuckets={model.estimated.subMonthly}
          rangeLabel={rangeLabel}
        />
        <StatTiles model={model} />
      </section>

      {/* ── 02 · The pipeline ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <Chapter
          index={2}
          label={t("overview.chapters.pipeline")}
          aside={t("overview.ranges.allTime")}
        />
        <PipelineSteps
          stages={model.pipeline}
          estimatedDwell={model.estimated.dwell}
        />
      </section>

      {/* ── 03 · Where the work comes from ───────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <Chapter index={3} label={t("overview.chapters.sources")} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <OrgRanking rows={model.organizations} className="lg:col-span-2" />
          <ActivityHours
            cells={model.activity}
            estimated={model.estimated.activity}
            className="lg:col-span-3"
          />
        </div>
      </section>

      {/* ── 04 · Right now ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <Chapter index={4} label={t("overview.chapters.now")} />
        <RequestQueue requests={model.latestRequests} />
      </section>
      </div>
    </div>
  )
}

/**
 * The first-load skeleton.
 *
 * Blocks at the real heights of the real sections, so the page does not jump
 * when the data lands. Only ever shown on a true first load — a refetch dims
 * the existing render instead.
 */
function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-[380px] w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-40" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Skeleton className="h-[300px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[300px] rounded-xl lg:col-span-3" />
        </div>
      </div>
    </div>
  )
}
