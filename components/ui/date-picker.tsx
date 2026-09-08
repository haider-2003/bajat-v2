"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react"

import { useControlSurface } from "@/components/ui/control-style"
import { localeTag, type Locale } from "@/i18n/config"
import { useLocale, useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * A single-date picker: a trigger showing the chosen day, and a popover month
 * grid to pick one.
 *
 * Values are `yyyy-mm-dd` strings in and out — the same format the list
 * endpoints take — so nothing between this component and the query string has
 * to parse or reformat a date. `""` means "no date".
 *
 * ### Why dates are handled as strings and rebuilt locally
 *
 * `new Date("2026-01-01")` parses as **UTC midnight**, which in any negative
 * offset is the previous day locally — the classic off-by-one that shows the
 * 31st for a value of the 1st. So the string is split into y/m/d integers and
 * only ever rebuilt through `new Date(y, m, d)`, which is local.
 * `toISOString` is never called.
 */

/**
 * Monday-first weekday initials, in the active language.
 *
 * Derived from real dates rather than a hardcoded list: a fixed
 * `["Mo", "Tu", …]` is English spelled into the calendar's frame, and there is
 * no Arabic set to swap it for that `Intl` does not already know. 2024-01-01
 * was a Monday, which is only used as an anchor to walk seven days from.
 *
 * Cached per locale for the same reason the date formatters are.
 */
const weekdayCache = new Map<string, string[]>()

function weekdayNames(locale: string): string[] {
  let names = weekdayCache.get(locale)
  if (!names) {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" })
    names = Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 1 + i))
    )
    weekdayCache.set(locale, names)
  }
  return names
}

/** `yyyy-mm-dd` to a local `Date`, or null when it is not a real date. */
function parseISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  // Rejects overflow like 2026-02-31, which `Date` would roll forward.
  return date.getMonth() === Number(m) - 1 ? date : null
}

/** Local `Date` to `yyyy-mm-dd`, without going through UTC. */
function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const monthCache = new Map<string, Intl.DateTimeFormat>()
const triggerCache = new Map<string, Intl.DateTimeFormat>()

function cachedFormat(
  cache: Map<string, Intl.DateTimeFormat>,
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  let fmt = cache.get(locale)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    cache.set(locale, fmt)
  }
  return fmt
}

const monthFmt = (locale: string) =>
  cachedFormat(monthCache, locale, { month: "long", year: "numeric" })

const triggerFmt = (locale: string) =>
  cachedFormat(triggerCache, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

/**
 * `yyyy-mm-dd` rendered the way the trigger renders it; `""` gives `""`.
 *
 * `locale` is optional so the many call sites that build filter-chip text can
 * pass what they have; without it the value reads as English, which is the
 * same behaviour this had before there was a second language.
 */
export function formatDateValue(value: string, locale?: Locale): string {
  const date = parseISO(value)
  if (!date) return ""
  return triggerFmt(locale ? localeTag[locale] : "en-GB").format(date)
}

/**
 * The grid: back-fill to the Monday on or before the 1st, then whole weeks
 * until the month is covered. Six weeks is the worst case, five the common one.
 */
function buildMonth(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  // getDay() is Sunday-based; shift so Monday is 0, matching WEEKDAYS.
  const lead = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead)

  const days: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
    // Stop at the end of the first full week that has left the month behind.
    if ((i + 1) % 7 === 0 && days[i].getMonth() !== month.getMonth() && i >= 27) break
  }
  return days
}

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1)

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export function DatePicker({
  value,
  onChange,
  label,
  min,
  max,
  placeholder,
  className,
}: {
  /** `yyyy-mm-dd`, or `""` for no date. */
  value: string
  onChange: (value: string) => void
  /** The muted half of the trigger, and part of the accessible name. */
  label?: string
  /** Earliest selectable day, `yyyy-mm-dd`. */
  min?: string
  /** Latest selectable day, `yyyy-mm-dd`. */
  max?: string
  placeholder?: string
  className?: string
}) {
  const t = useT()
  const locale = useLocale()
  const tag = localeTag[locale]
  const [open, setOpen] = React.useState(false)
  // The same face the filter buttons and the active nav chip wear.
  const surface = useControlSurface()

  const selected = React.useMemo(() => parseISO(value), [value])
  const minDate = React.useMemo(() => (min ? parseISO(min) : null), [min])
  const maxDate = React.useMemo(() => (max ? parseISO(max) : null), [max])

  // The month on screen is separate state from the value, so browsing away and
  // closing without picking does not change the selection. Re-anchoring it on
  // open — rather than syncing it to `value` in an effect — is both simpler and
  // the better behaviour: the calendar always opens on the selected month.
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(selected ?? new Date()))

  const handleOpenChange = (next: boolean) => {
    if (next) setMonth(startOfMonth(selected ?? new Date()))
    setOpen(next)
  }

  const days = React.useMemo(() => buildMonth(month), [month])
  const today = new Date()

  const isDisabled = (day: Date) =>
    (minDate !== null && day < minDate) || (maxDate !== null && day > maxDate)

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  const pick = (day: Date) => {
    onChange(toISO(day))
    setOpen(false)
  }

  const todayDisabled = isDisabled(today)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        className={cn(
          // §18.7 — 44px for touch, the §6.6 32px chip at lg.
          "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 lg:h-8",
          "text-sm font-medium whitespace-nowrap",
          "transition-[box-shadow,background-color,color] duration-120",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:translate-y-px",
          surface.face,
          className
        )}
        aria-label={
          label ? t("datePicker.fieldDate", { field: label }) : t("datePicker.pick")
        }
      >
        <CalendarDays
          className={cn("size-4 shrink-0", surface.muted)}
          strokeWidth={1.5}
        />
        {label && <span className={surface.muted}>{label}</span>}
        {/* Unset reads as muted, a chosen date at full contrast — both taken
            from the surface, so the ink face stays legible. */}
        <span className={selected ? undefined : surface.muted}>
          {selected
            ? triggerFmt(tag).format(selected)
            : placeholder ?? t("datePicker.anyDate")}
        </span>
        {/* Clearing is the usual follow-up, so it sits on the trigger rather
            than only inside the popover. A nested <button> is invalid HTML,
            hence a span carrying the same role and key handling. */}
        {selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label={
              label
                ? t("datePicker.clearFieldDate", { field: label })
                : t("datePicker.clearDate")
            }
            onClick={(e) => {
              e.stopPropagation()
              onChange("")
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return
              e.preventDefault()
              e.stopPropagation()
              onChange("")
            }}
            className={cn(
              "ms-0.5 inline-flex size-4 items-center justify-center rounded-xs",
              "transition-opacity hover:opacity-100 opacity-60",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              surface.muted
            )}
          >
            <X className="size-3" strokeWidth={2} />
          </span>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="isolate z-50 outline-none"
          align="start"
          sideOffset={6}
        >
          <PopoverPrimitive.Popup
            className={cn(
              "w-[268px] rounded-xl border border-border bg-surface p-3 shadow-lg outline-none",
              "origin-[var(--transform-origin)] transition-[transform,opacity] duration-120",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            <div className="flex items-center justify-between">
              <MonthButton
                label={t("datePicker.previousMonth")}
                icon={ChevronLeft}
                onClick={() => shiftMonth(-1)}
              />
              <span aria-live="polite" className="text-[13px] font-medium text-text">
                {monthFmt(tag).format(month)}
              </span>
              <MonthButton
                label={t("datePicker.nextMonth")}
                icon={ChevronRight}
                onClick={() => shiftMonth(1)}
              />
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5">
              {weekdayNames(tag).map((d) => (
                <span
                  key={d}
                  aria-hidden
                  className="flex h-7 items-center justify-center text-[11px] font-medium text-text-placeholder"
                >
                  {d}
                </span>
              ))}

              {days.map((day) => {
                const outside = day.getMonth() !== month.getMonth()
                const disabled = isDisabled(day)
                const active = selected !== null && sameDay(day, selected)

                return (
                  <button
                    key={day.getTime()}
                    type="button"
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => pick(day)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md text-[13px] tabular-nums",
                      "transition-colors duration-120 outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      outside ? "text-text-placeholder" : "text-text-secondary",
                      !disabled &&
                        !active &&
                        "hover:bg-[rgba(0,0,0,0.05)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.06)]",
                      // Today is only marked when it is not the selection.
                      !active &&
                        sameDay(day, today) &&
                        "font-semibold text-text ring-1 ring-inset ring-border-strong",
                      active && "bg-text font-medium text-background",
                      disabled &&
                        "cursor-not-allowed text-text-placeholder opacity-40 hover:bg-transparent"
                    )}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <FooterAction onClick={() => pick(today)} disabled={todayDisabled}>
                {t("datePicker.today")}
              </FooterAction>
              <FooterAction
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
                disabled={!selected}
              >
                {t("common.clear")}
              </FooterAction>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function MonthButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-text-secondary",
        "transition-colors duration-120 outline-none",
        "hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.045)]",
        "focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Previous / next months run along the reading direction. */}
      <Icon data-flip-rtl className="size-4" strokeWidth={1.5} />
    </button>
  )
}

function FooterAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 rounded-sm px-2 text-[13px] font-medium text-text-secondary",
        "transition-colors hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:text-text-placeholder"
      )}
    >
      {children}
    </button>
  )
}
