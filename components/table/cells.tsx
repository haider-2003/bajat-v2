"use client"

import { CalendarDays } from "lucide-react"

import { EmptyCell } from "@/components/ui/data-bits"
import { useFormatDate } from "@/i18n/format"
import { formatPhone, formatText } from "@/utils/format"
import { cn } from "@/lib/utils"

/**
 * The header and cell treatments every column definition is built from —
 * DESIGN.md §8.3 / §8.6.
 *
 * A screen's `columns.tsx` is not shareable: it maps one entity's fields to one
 * table's columns, and no two entities have the same ones. What *is* shareable
 * is the handful of ways a value gets rendered inside a cell — an id, a name, a
 * date, a phone number — because those look the same in every table and would
 * otherwise be copy-pasted class strings drifting apart screen by screen.
 *
 * So: keep column *lists* local, build them out of these.
 */

/** 12px/500 muted header with a leading data-type glyph (§8.3). */
export function HeadCell({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-text-muted">
      <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
      {children}
    </span>
  )
}

/** Mono identifier, rendered `#123` (§8.6). */
export function IdCell({ value }: { value: string | number }) {
  return (
    <span className="font-mono text-xs font-medium tracking-[0.02em] text-text-muted">
      #{value}
    </span>
  )
}

const TEXT_EMPHASIS = {
  /** The row's identity — the one cell that names what the row *is*. */
  primary: "text-sm font-medium text-text",
  secondary: "text-sm text-text-secondary",
  /** Supporting detail that should not compete with the row's identity. */
  quiet: "text-[13px] text-text-secondary",
} as const

/**
 * Truncated text.
 *
 * Carries its own `title`, so a name clipped by the column width is still
 * readable on hover rather than silently lost.
 */
export function TextCell({
  value,
  emphasis = "secondary",
}: {
  value: string | null | undefined
  emphasis?: keyof typeof TEXT_EMPHASIS
}) {
  const text = formatText(value)
  return (
    <span
      title={value?.trim() || undefined}
      className={cn("block truncate", TEXT_EMPHASIS[emphasis])}
    >
      {text}
    </span>
  )
}

/** Phone number, mono and tabular so digits line up down the column. */
export function PhoneCell({ value }: { value: string | null | undefined }) {
  return (
    <span className="font-mono text-[13px] tabular-nums text-text-secondary">
      {formatPhone(value)}
    </span>
  )
}

/**
 * A date with its calendar glyph.
 *
 * Pass `empty` for a date the user is expected to fill in — an unset value then
 * renders as an affordance rather than a dash, per §8.6. Leave it off for a
 * date that is simply absent.
 */
export function DateCell({
  value,
  empty,
}: {
  value: string | null | undefined
  empty?: {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
    label: string
  }
}) {
  const formatDate = useFormatDate()

  if (!value && empty) return <EmptyCell icon={empty.icon} label={empty.label} />

  return (
    <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
      <CalendarDays
        className="size-3.5 shrink-0 text-text-muted"
        strokeWidth={1.5}
      />
      {formatDate(value)}
    </span>
  )
}
