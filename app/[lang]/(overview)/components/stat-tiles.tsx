"use client"

import { Building2, Inbox, IdCard, Users, type LucideIcon } from "lucide-react"

import type { OverviewModel } from "@/features/statistics/types"
import { localeTag } from "@/i18n/config"
import { useLocale, useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

import { formatCompact, TickMeter, useCountUp } from "./chart-kit"

/**
 * The standing totals — what exists right now, regardless of the range.
 *
 * ### Why these are not scoped by the range control
 *
 * Every chart above and below re-renders against the selected window; these
 * four deliberately do not, because they are not a time series. "How many
 * organizations exist" has no last-30-days answer, and inventing one would put
 * two numbers on the same page that disagree about the same word.
 *
 * The honest resolution is to label them rather than to fake a window: the
 * chapter above this row says *all time* out loud, and the tiles are visually
 * a different object from the charts — smaller, flat, icon-led — so nobody
 * reads them as the range control's output. The rule that filters must scope
 * everything below them exists so the numbers always agree; here they agree
 * because each says which period it covers.
 *
 * ### Pending is the one with a meter
 *
 * Three of these are inert facts. Pending review is a queue somebody has to
 * work, so it alone carries a proportion — how much of all intake is sitting
 * unclaimed — and it is the only tile whose value can turn a warning tone.
 * A tile that changes colour when nothing is wrong teaches people to ignore it.
 */

type Tile = {
  key: string
  label: string
  value: number
  icon: LucideIcon
  /** Tint for the icon tile — the card's colour identity (§9.2). */
  tone: "violet" | "neutral"
  foot?: React.ReactNode
}

export function StatTiles({ model }: { model: OverviewModel }) {
  const t = useT()
  const tag = localeTag[useLocale()]
  const { totals } = model

  const pendingShare = totals.requests > 0 ? totals.pending / totals.requests : 0
  // A fifth of all intake still unclaimed is the point where the queue stops
  // being a queue and starts being a backlog.
  const pendingIsHigh = pendingShare >= 0.2

  const tiles: Tile[] = [
    {
      key: "members",
      label: t("overview.tiles.members"),
      value: totals.members,
      icon: Users,
      tone: "violet",
      foot: t("overview.tiles.membersFoot"),
    },
    {
      key: "identities",
      label: t("overview.tiles.identities"),
      value: totals.identities,
      icon: IdCard,
      tone: "violet",
      foot:
        totals.members > 0
          ? t("overview.tiles.perMember", {
              ratio: new Intl.NumberFormat(tag, {
                maximumFractionDigits: 2,
              }).format(totals.identities / totals.members),
            })
          : undefined,
    },
    {
      key: "organizations",
      label: t("overview.tiles.organizations"),
      value: totals.organizations,
      icon: Building2,
      tone: "neutral",
      foot: t("overview.tiles.organizationsFoot"),
    },
    {
      key: "pending",
      label: t("overview.tiles.pending"),
      value: totals.pending,
      icon: Inbox,
      tone: "neutral",
      foot: (
        <span className="flex items-center gap-2">
          <TickMeter
            value={totals.pending}
            max={totals.requests}
            size={5}
            gap={2}
            color={pendingIsHigh ? "var(--warning)" : "var(--viz-accent)"}
            className="w-16 shrink-0"
          />
          <span className={cn("tabular-nums", pendingIsHigh && "text-warning")}>
            {t("overview.tiles.pendingShare", {
              percent: new Intl.NumberFormat(tag, {
                style: "percent",
                maximumFractionDigits: 0,
              }).format(pendingShare),
            })}
          </span>
        </span>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile, i) => (
        <StatTile key={tile.key} tile={tile} index={i} tag={tag} />
      ))}
    </div>
  )
}

function StatTile({ tile, index, tag }: { tile: Tile; index: number; tag: string }) {
  const counted = useCountUp(tile.value, 900)
  const Icon = tile.icon

  return (
    <article
      data-await-intro
      className={cn(
        "flex flex-col justify-between rounded-xl border border-border bg-surface p-4",
        "transition-[border-color] duration-120 hover:border-border-strong",
        "animate-[viz-fade-up_440ms_cubic-bezier(0.16,1,0.3,1)_both]"
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center gap-2.5">
        {/* 28px icon tile — the card's colour identity (§9.2). */}
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            tile.tone === "violet"
              ? "bg-accent-soft text-accent-violet"
              : "bg-muted text-text-secondary"
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 truncate text-xs font-medium text-text-muted">
          {tile.label}
        </span>
      </div>

      {/* Proportional figures, not tabular: this is a standalone display value,
          and equal-width digits make it look loose (§ figures). */}
      <p className="mt-3 text-[1.75rem] leading-none font-semibold tracking-[-0.02em] text-text">
        {formatCompact(counted, tag)}
      </p>

      {tile.foot ? (
        <div className="mt-2.5 text-[11px] text-text-muted">{tile.foot}</div>
      ) : null}
    </article>
  )
}
