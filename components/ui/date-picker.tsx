"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"

import { useControlSurface } from "@/components/ui/control-style"
import { Input } from "@/components/ui/input"
import { localeTag, type Locale } from "@/i18n/config"
import { useLocale, useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * A single-date picker: a trigger showing the chosen day, and a popover month
 * grid to pick one.
 *
 * ### Two faces
 *
 * `chip` (the default) is the toolbar control: §6.6's 32px chip on the
 * control-style face, with the label inside it — `Date · Any date` — because
 * a filter bar has no room for a label above. `field` is the same picker in
 * a form: it takes the text input's box (§10.3 — 36px, `--input` border,
 * `--surface` fill, the accent focus ring), the calendar glyph at the end,
 * and no label inside, because a `Field` already put one above it. The
 * popover is identical either way.
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
 *
 * ### Getting to a far-off date
 *
 * Month arrows are fine for "next Tuesday" and useless for a birth date, which
 * is hundreds of clicks away. So the month and the year in the header open grids
 * of their own, and picking a year goes on to the month, then the day.
 *
 * ### Months are numbers first
 *
 * Not everyone knows the month names: Iraq's تشرين الأول is أكتوبر elsewhere, and
 * either may be unfamiliar to someone copying `10` off a document. So a month
 * always shows its number, with the name as the smaller hint.
 *
 * `numeric` goes further, for a date read off a document into a form. It adds
 * boxes to type day, month and year, and the closed field shows `yyyy-mm-dd`,
 * which is what the card prints. It is opt-in because a filter asks about last
 * Tuesday, not a date on a document, and its summary chip reads the friendly form.
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

/** The twelve month names in the active language, January first. */
const monthNameCache = new Map<string, string[]>()

function monthNames(locale: string): string[] {
  let names = monthNameCache.get(locale)
  if (!names) {
    const fmt = new Intl.DateTimeFormat(locale, { month: "long" })
    names = Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)))
    monthNameCache.set(locale, names)
  }
  return names
}

/** How far the year grid reaches when `min` / `max` do not say. */
const YEARS_BACK = 100
const YEARS_AHEAD = 30

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
  variant = "chip",
  id,
  "aria-describedby": describedBy,
  invalid = false,
  disabled = false,
  defaultOpen = false,
  numeric = false,
}: {
  /** `yyyy-mm-dd`, or `""` for no date. */
  value: string
  onChange: (value: string) => void
  /**
   * The muted half of a `chip` trigger, and part of the accessible name. A
   * `field` does not show it — its `Field` label does — but still announces
   * it when no `id` wires a label up.
   */
  label?: string
  /** Earliest selectable day, `yyyy-mm-dd`. */
  min?: string
  /** Latest selectable day, `yyyy-mm-dd`. */
  max?: string
  placeholder?: string
  className?: string
  /** `chip` for a toolbar, `field` for a form. */
  variant?: "chip" | "field"
  /** `field`: the `Field` wiring — its label's target, its message, its state. */
  id?: string
  "aria-describedby"?: string
  invalid?: boolean
  disabled?: boolean
  /** Mount with the calendar open, for a field that only exists to pick a date. */
  defaultOpen?: boolean
  /** `field`: boxes to type the date in, and `yyyy-mm-dd` on the closed field. */
  numeric?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const tag = localeTag[locale]
  const [open, setOpen] = React.useState(defaultOpen)
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
  const [view, setView] = React.useState<View>("days")

  const popup = React.useRef<HTMLDivElement>(null)
  const dayBox = React.useRef<HTMLInputElement>(null)
  /** A complete date in the typed boxes, not yet the value. See `TypedDate`. */
  const typed = React.useRef<Date | null>(null)

  const handleOpenChange = (
    next: boolean,
    details: PopoverPrimitive.Root.ChangeEventDetails
  ) => {
    if (next) {
      setMonth(startOfMonth(selected ?? new Date()))
      setView("days")
      typed.current = null
    } else if (typed.current && details.reason !== "escape-key") {
      // Clicking away keeps what was typed: the next click is usually the form's
      // own submit, and it must not find the date gone. Escape means never mind.
      onChange(toISO(typed.current))
    }
    setOpen(next)
  }

  // The button that was just pressed is about to unmount with its view, so
  // focus moves first, or it would fall out of the popover.
  const changeView = (next: View) => {
    popup.current?.focus()
    setView(next)
  }

  const days = React.useMemo(() => buildMonth(month), [month])
  const today = new Date()
  const names = monthNames(tag)
  const viewYear = month.getFullYear()
  const viewMonth = month.getMonth()

  const years = React.useMemo(() => {
    const now = new Date().getFullYear()
    // Never without the year on screen, however far a stored value has it.
    const first = minDate?.getFullYear() ?? Math.min(now - YEARS_BACK, viewYear)
    const last = maxDate?.getFullYear() ?? Math.max(now + YEARS_AHEAD, viewYear)
    return Array.from({ length: Math.max(last - first + 1, 0) }, (_, i) => first + i)
  }, [minDate, maxDate, viewYear])

  const isDisabled = (day: Date) =>
    (minDate !== null && day < minDate) || (maxDate !== null && day > maxDate)

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  const pick = (day: Date) => {
    onChange(toISO(day))
    setOpen(false)
  }

  const todayDisabled = isDisabled(today)
  const field = variant === "field"
  const asNumbers = field && numeric

  /** Clearing is the usual follow-up, so it sits on the trigger rather than
      only inside the popover. A nested <button> is invalid HTML, hence a span
      carrying the same role and key handling. */
  const clear = selected && !disabled && (
    <span
      role="button"
      tabIndex={0}
      aria-label={
        label ? t("datePicker.clearFieldDate", { field: label }) : t("datePicker.clearDate")
      }
      onClick={(e) => {
        e.stopPropagation()
        typed.current = null
        onChange("")
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        e.stopPropagation()
        typed.current = null
        onChange("")
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xs",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        field
          ? "size-5 text-text-muted transition-colors hover:text-text"
          : cn("ms-0.5 size-4 opacity-60 transition-opacity hover:opacity-100", surface.muted)
      )}
    >
      <X className="size-3" strokeWidth={2} />
    </span>
  )

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger
        id={id}
        disabled={disabled}
        aria-describedby={describedBy}
        // Styling hook only: `aria-invalid` is not a thing a button can say.
        data-invalid={invalid || undefined}
        className={cn(
          field
            ? [
                // §10.3 — the text input's box, with a glyph at the end.
                "flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-surface px-3",
                "text-start text-sm font-normal text-text",
                "transition-[border-color,box-shadow,background-color] duration-120 outline-none",
                "hover:border-border-strong",
                "focus-visible:border-accent-violet focus-visible:ring-3 focus-visible:ring-ring/45",
                // Open reads as focused: the popover has the keyboard now.
                "data-popup-open:border-accent-violet data-popup-open:ring-3 data-popup-open:ring-ring/45",
                "data-invalid:border-danger data-invalid:ring-3 data-invalid:ring-danger/15",
                "disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background-subtle disabled:text-text-placeholder",
                "dark:bg-surface-sunken dark:disabled:bg-[#0f0f0f]",
              ]
            : [
                // §18.7 — 44px for touch, the §6.6 32px chip at lg.
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 lg:h-8",
                "text-sm font-medium whitespace-nowrap",
                "transition-[box-shadow,background-color,color] duration-120",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "active:translate-y-px",
                surface.face,
              ],
          className
        )}
        aria-label={
          // A wired-up label names a field; only an unlabelled trigger needs this.
          field && id
            ? undefined
            : label
              ? t("datePicker.fieldDate", { field: label })
              : t("datePicker.pick")
        }
      >
        {field ? (
          <>
            <span
              // Digits read left to right whatever the locale does.
              dir={asNumbers && selected ? "ltr" : undefined}
              className={cn(
                "min-w-0 flex-1 truncate",
                !selected && "text-text-placeholder",
                asNumbers && selected && "tabular-nums rtl:text-end"
              )}
            >
              {selected
                ? asNumbers
                  ? toISO(selected)
                  : triggerFmt(tag).format(selected)
                : (placeholder ?? (asNumbers ? t("datePicker.format") : t("datePicker.pick")))}
            </span>
            {clear}
            <CalendarDays
              className="size-4 shrink-0 text-text-placeholder"
              strokeWidth={1.5}
              aria-hidden
            />
          </>
        ) : (
          <>
            <CalendarDays
              className={cn("size-4 shrink-0", surface.muted)}
              strokeWidth={1.5}
            />
            {label && <span className={surface.muted}>{label}</span>}
            {/* Unset reads as muted, a chosen date at full contrast — both
                taken from the surface, so the ink face stays legible. */}
            <span className={selected ? undefined : surface.muted}>
              {selected ? triggerFmt(tag).format(selected) : (placeholder ?? t("datePicker.anyDate"))}
            </span>
            {clear}
          </>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="isolate z-50 outline-none"
          align="start"
          sideOffset={6}
        >
          <PopoverPrimitive.Popup
            ref={popup}
            // Straight into the boxes, except on touch, where focusing one would
            // throw a keyboard over the calendar somebody may have come to tap.
            initialFocus={
              asNumbers ? (type) => (type === "touch" ? false : dayBox.current) : undefined
            }
            className={cn(
              "w-[288px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-3 shadow-lg outline-none",
              "origin-[var(--transform-origin)] transition-[transform,opacity] duration-120",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            {asNumbers && (
              <TypedDate
                selected={selected}
                isDisabled={isDisabled}
                dayBox={dayBox}
                onDate={(date) => {
                  typed.current = date
                  if (date) setMonth(startOfMonth(date))
                }}
                onDone={(date) => {
                  onChange(toISO(date))
                  setOpen(false)
                }}
              />
            )}

            {view === "days" ? (
              <>
                <div className="flex items-center justify-between gap-1">
                  <MonthButton
                    label={t("datePicker.previousMonth")}
                    icon={ChevronLeft}
                    onClick={() => shiftMonth(-1)}
                  />
                  <div aria-live="polite" className="flex min-w-0 items-center gap-1">
                    <ViewButton
                      label={t("datePicker.chooseMonth")}
                      onClick={() => changeView("months")}
                    >
                      {viewMonth + 1} · {names[viewMonth]}
                    </ViewButton>
                    <ViewButton
                      label={t("datePicker.chooseYear")}
                      onClick={() => changeView("years")}
                    >
                      {viewYear}
                    </ViewButton>
                  </div>
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
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <MonthButton
                    label={t("datePicker.backToCalendar")}
                    icon={ChevronLeft}
                    onClick={() => changeView("days")}
                  />
                  <span aria-live="polite" className="text-[13px] font-medium text-text">
                    {view === "months"
                      ? `${t("datePicker.chooseMonth")} · ${viewYear}`
                      : t("datePicker.chooseYear")}
                  </span>
                </div>

                {view === "months" ? (
                  <PickGrid className="grid-cols-3">
                    {names.map((name, index) => (
                      <PickCell
                        key={name}
                        active={index === viewMonth}
                        disabled={
                          (minDate !== null && new Date(viewYear, index + 1, 0) < minDate) ||
                          (maxDate !== null && new Date(viewYear, index, 1) > maxDate)
                        }
                        className="h-13 flex-col gap-0.5"
                        onClick={() => {
                          setMonth(new Date(viewYear, index, 1))
                          changeView("days")
                        }}
                      >
                        <span className="text-sm font-semibold tabular-nums">{index + 1}</span>
                        <span className="max-w-full truncate px-1 text-[11px] opacity-70">
                          {name}
                        </span>
                      </PickCell>
                    ))}
                  </PickGrid>
                ) : (
                  <PickGrid className="max-h-60 grid-cols-4 overflow-y-auto pe-1">
                    {years.map((year) => (
                      <PickCell
                        key={year}
                        active={year === viewYear}
                        className="h-9 shrink-0 text-[13px] tabular-nums"
                        onClick={() => {
                          setMonth(new Date(year, viewMonth, 1))
                          // On to the month: nobody comes here to change only the
                          // year of a calendar they then have to page through.
                          changeView("months")
                        }}
                      >
                        {year}
                      </PickCell>
                    ))}
                  </PickGrid>
                )}
              </>
            )}

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

type View = "days" | "months" | "years"

type DateParts = { d: string; m: string; y: string }

/** `٢٠٢٦` to `2026`: an Arabic keyboard may well type the first. */
const toLatinDigits = (text: string) =>
  text
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))

const pad2 = (n: number) => String(n).padStart(2, "0")

/** The typed boxes as a real date, or null while they do not make one yet. */
function partsToDate({ d, m, y }: DateParts): Date | null {
  // A leading zero would have `Date` read 0099 as 1999.
  if (!d || !m || y.length !== 4 || y.startsWith("0")) return null
  return parseISO(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`)
}

/**
 * Day, month and year as three labelled boxes, the fastest way to copy a date
 * off a document: the labels are the format, so nobody has to know or guess one.
 *
 * Mounted per opening, because the popup unmounts when it closes, so it always
 * starts from the current value without an effect to keep the two in step.
 *
 * ### Typed dates are held until the picker closes
 *
 * Changing one box of a date passes through dates nobody meant: `14` to `31`
 * makes 31 May valid on the way to 31 March. Committed as they went by, one of
 * those would be left in the field if the next box turned out wrong. So the
 * calendar follows along, but the value only changes on Enter or on clicking away.
 */
function TypedDate({
  selected,
  isDisabled,
  dayBox,
  onDate,
  onDone,
}: {
  selected: Date | null
  isDisabled: (day: Date) => boolean
  dayBox: React.RefObject<HTMLInputElement | null>
  /** What the boxes come to, on every change: a usable date, or `null`. */
  onDate: (date: Date | null) => void
  /** Enter on a usable date. */
  onDone: (date: Date) => void
}) {
  const t = useT()
  const id = React.useId()
  const monthBox = React.useRef<HTMLInputElement>(null)
  const yearBox = React.useRef<HTMLInputElement>(null)
  const [parts, setParts] = React.useState<DateParts>(() => ({
    d: selected ? pad2(selected.getDate()) : "",
    m: selected ? pad2(selected.getMonth() + 1) : "",
    y: selected ? String(selected.getFullYear()) : "",
  }))

  const date = partsToDate(parts)
  const complete = Boolean(parts.d && parts.m && parts.y.length === 4)
  const wrong = complete && (!date || isDisabled(date))

  // `lastLead` is the highest digit that can still start a two-digit value: the
  // box moves on after a 4 for the day or a 2 for the month, as no 40th or 20th
  // month is coming. The year is a fixed length and has nowhere to move on to.
  const boxes = [
    { key: "d", label: t("datePicker.day"), size: 2, lastLead: 3, ref: dayBox, prev: null, next: monthBox },
    { key: "m", label: t("datePicker.month"), size: 2, lastLead: 1, ref: monthBox, prev: dayBox, next: yearBox },
    { key: "y", label: t("datePicker.year"), size: 4, lastLead: 9, ref: yearBox, prev: monthBox, next: null },
  ] as const

  return (
    <div className="mb-3 border-b border-border pb-3">
      <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-2">
        {boxes.map((box) => (
          <div key={box.key} className="min-w-0">
            <label
              htmlFor={`${id}-${box.key}`}
              className="mb-1 block text-[11px] font-medium text-text-muted"
            >
              {box.label}
            </label>
            <Input
              ref={box.ref}
              id={`${id}-${box.key}`}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={wrong || undefined}
              className="h-11 text-center text-base tabular-nums md:h-8 md:text-[13px]"
              value={parts[box.key]}
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                const text = toLatinDigits(event.target.value).replace(/\D/g, "").slice(0, box.size)
                const grew = text.length > parts[box.key].length
                const next = { ...parts, [box.key]: text }
                setParts(next)

                const typed = partsToDate(next)
                onDate(typed && !isDisabled(typed) ? typed : null)

                if (grew && (text.length === box.size || Number(text) > box.lastLead)) {
                  box.next?.current?.focus()
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  if (date && !wrong) onDone(date)
                } else if (event.key === "Backspace" && !parts[box.key]) {
                  box.prev?.current?.focus()
                }
              }}
            />
          </div>
        ))}
      </div>
      {wrong && <p className="mt-1.5 text-xs text-danger">{t("datePicker.invalid")}</p>}
    </div>
  )
}

/**
 * The grid behind the month or the year in the header. Scrolls to the highlighted
 * cell on the way in, which is what makes a hundred-odd years quick to get
 * through: it opens on the year on screen, not on 1926.
 */
function PickGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  const grid = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const box = grid.current
    const active = box?.querySelector<HTMLElement>("[aria-pressed='true']")
    if (box && active) {
      box.scrollTop = active.offsetTop - box.clientHeight / 2 + active.offsetHeight / 2
    }
  }, [])

  return (
    <div ref={grid} className={cn("relative mt-2 grid content-start gap-1", className)}>
      {children}
    </div>
  )
}

function PickCell({
  active,
  disabled,
  className,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  className?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center justify-center rounded-md",
        "transition-colors duration-120 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-text text-background"
          : "text-text-secondary hover:bg-[rgba(0,0,0,0.05)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.06)]",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
        className
      )}
    >
      {children}
    </button>
  )
}

/** The month or the year in the header, drawn so it reads as something to open. */
function ViewButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-0 items-center gap-1 rounded-md border border-border px-2",
        "text-[13px] font-medium whitespace-nowrap text-text",
        "transition-colors duration-120 outline-none hover:border-border-strong",
        "focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <span className="min-w-0 truncate tabular-nums">{children}</span>
      <ChevronDown className="size-3 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
    </button>
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
