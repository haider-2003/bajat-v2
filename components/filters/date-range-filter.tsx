"use client"

import { DatePicker, formatDateValue } from "@/components/ui/date-picker"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import { cn } from "@/lib/utils"

import { SHEET_CONTROL } from "./filter-sheet"

/**
 * A two-ended date window, as a pair of day pickers under one field name.
 *
 * ### Why a pair rather than one popover trigger
 *
 * Every other control in this family (`FacetFilter`, `SelectFilter`) is a
 * single trigger opening a single popup, and a range control that matched them
 * would have to put a calendar *inside* that popup — a popover nested in a
 * popover, two focus traps deep, which is the arrangement most likely to break
 * on a phone. Two plain pickers stay flat, and each end is independently
 * clearable from its own trigger, which is what an operator actually does:
 * "since Monday" and "before Monday" are both one-ended questions.
 *
 * ### The ends bound each other
 *
 * `from` caps the To picker's minimum and vice versa, so an inverted window —
 * which returns nothing, with nothing on screen explaining why — cannot be
 * assembled by clicking.
 *
 * The screen still owns both values; this only lays them out. `toInstantRange`
 * (utils/date.ts) is what turns them into the `*_at_range[]` pair the endpoint
 * takes.
 */
export function DateRangeFilter({
  label,
  from,
  to,
  onFromChange,
  onToChange,
  inSheet = false,
}: {
  /** The field being filtered — "Created", "Last moved". Prefixes both ends. */
  label: string
  /** `yyyy-mm-dd`, or `""` for an open end. */
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  /** Inside the filter sheet the pair stacks and goes full-width. */
  inSheet?: boolean
}) {
  const t = useT()

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        inSheet && "w-full flex-col items-stretch"
      )}
    >
      <DatePicker
        label={t("filters.rangeFrom", { field: label })}
        value={from}
        onChange={onFromChange}
        max={to || undefined}
        className={inSheet ? SHEET_CONTROL : undefined}
      />
      <DatePicker
        label={t("filters.rangeTo", { field: label })}
        value={to}
        onChange={onToChange}
        min={from || undefined}
        className={inSheet ? SHEET_CONTROL : undefined}
      />
    </div>
  )
}

/**
 * The window as one line of chip text — a full range, or whichever half of one
 * is set. `""` when neither is, which is the caller's cue to omit the chip.
 *
 * Takes `t` rather than calling `useT()` because it is a plain function, not a
 * component: the screens that build chip rows call it inside `useMemo`, where a
 * hook cannot go. They already hold a translator.
 */
export function describeRange(
  t: Translator,
  from: string,
  to: string
): string {
  if (from && to)
    return t("filters.rangeBoth", {
      from: formatDateValue(from),
      to: formatDateValue(to),
    })
  if (from) return t("filters.rangeFromOnly", { from: formatDateValue(from) })
  if (to) return t("filters.rangeToOnly", { to: formatDateValue(to) })
  return ""
}
