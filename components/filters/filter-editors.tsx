"use client"

import * as React from "react"
import { Check, Search } from "lucide-react"

import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import { cn } from "@/lib/utils"

import { useFilterEditor } from "./filter-builder"

/**
 * The editors a `FilterDefinition` can hand to `FilterMenu` / `AppliedFilters`.
 *
 * Each is the popover body for one *kind* of value — the same shapes the
 * toolbar controls cover, one for one:
 *
 * | Toolbar control   | Editor            | Value                       |
 * | ----------------- | ----------------- | --------------------------- |
 * | `FacetFilter`     | `FacetEditor`     | `string[]`, repeated param  |
 * | `SelectFilter`    | `ChoiceEditor`    | `string`, `""` for none     |
 * | `TextFilter`      | `TextEditor`      | `string`                    |
 * | price pair        | `RangeEditor`     | two `string`s               |
 * | `DatePicker`      | `DateEditor`      | one `yyyy-mm-dd`            |
 * | `DateRangeFilter` | `DateRangeEditor` | two `yyyy-mm-dd`            |
 *
 * All controlled, none owning state — the screen still debounces what it
 * sends (see `TextFilter` on why that lives there and not here).
 *
 * ### Rows, not menu items
 *
 * The lists here are plain buttons, because the popover is a `Popover` and
 * not a `Menu`: a menu owns the arrow keys and typeahead, which is exactly
 * what makes a search box inside one unusable. Tab moves between rows, the
 * search field filters them.
 */

/** Past this many options a list gets a search field above it. */
const SEARCHABLE_FROM = 8

const ROW = cn(
  "flex h-11 w-full items-center gap-2 rounded-md px-2 text-start text-sm lg:h-8",
  "text-text outline-none transition-colors duration-120",
  "hover:bg-[rgba(0,0,0,0.04)] focus-visible:bg-[rgba(0,0,0,0.04)]",
  "dark:hover:bg-[rgba(255,255,255,0.045)] dark:focus-visible:bg-[rgba(255,255,255,0.045)]"
)

/** The tick slot every list row reserves, so labels line up ticked or not. */
function Tick({ on }: { on: boolean }) {
  return (
    <span className="inline-flex size-4 shrink-0 items-center justify-center">
      {on && <Check className="size-3.5 text-text" strokeWidth={2} />}
    </span>
  )
}

/**
 * The list's search box — shown only when the list is long enough to need
 * it. A sunken field like the toolbar's search (§6.7), not a bordered input,
 * so it reads as part of the list rather than a form field above it.
 */
function ListSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const t = useT()
  return (
    <div className="relative mb-1">
      <Search
        className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-text-placeholder"
        strokeWidth={1.5}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("common.search")}
        aria-label={t("common.search")}
        className={cn(
          "h-9 w-full rounded-md bg-surface-sunken ps-7 pe-2 text-base lg:h-8 lg:text-[13px]",
          "text-text placeholder:text-text-placeholder",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      />
    </div>
  )
}

function useListFilter<T extends { label: string }>(options: T[]) {
  const [query, setQuery] = React.useState("")
  const searchable = options.length >= SEARCHABLE_FROM
  const needle = query.trim().toLowerCase()
  const visible = React.useMemo(
    () =>
      needle
        ? options.filter((option) => option.label.toLowerCase().includes(needle))
        : options,
    [options, needle]
  )
  return { query, setQuery, searchable, visible }
}

/** What an empty list says — loading, nothing at all, or nothing matching. */
function ListNote({
  total,
  visible,
  loading,
  emptyLabel,
}: {
  total: number
  visible: number
  loading: boolean
  emptyLabel?: string
}) {
  const t = useT()
  if (visible > 0) return null
  return (
    <p className="px-2 py-1.5 text-[13px] text-text-muted">
      {loading
        ? t("common.loading")
        : total === 0
          ? (emptyLabel ?? t("filters.nothingToChoose"))
          : t("common.noMatches")}
    </p>
  )
}

/**
 * A facet's chip text: one tick names the thing itself, more than one gives
 * a count — "Baghdad, Basra, Erbil…" truncated in a chip names neither how
 * many nor which. `undefined` when nothing is ticked, which is the kit's cue
 * for "unset".
 *
 * Takes `t` because it is a plain function the screens call while building
 * their definitions array, not a component.
 */
export function describeFacet(
  t: Translator,
  options: { key: string; label: string }[],
  selected: string[]
): string | undefined {
  if (selected.length === 0) return undefined
  if (selected.length === 1) {
    return options.find((option) => option.key === selected[0])?.label ?? selected[0]
  }
  return t("common.selectedCount", { count: selected.length })
}

/** Multi-select: one repeated parameter, any number ticked. Stays open. */
export function FacetEditor({
  options,
  selected,
  onToggle,
  emptyLabel,
  loading = false,
}: {
  options: { key: string; label: string }[]
  selected: string[]
  onToggle: (key: string) => void
  emptyLabel?: string
  loading?: boolean
}) {
  const list = useListFilter(options)

  return (
    <div className="flex flex-col">
      {list.searchable && <ListSearch value={list.query} onChange={list.setQuery} />}
      <div className="max-h-64 overflow-y-auto">
        {list.visible.map((option) => {
          const on = selected.includes(option.key)
          return (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => onToggle(option.key)}
              className={ROW}
            >
              <Tick on={on} />
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
        <ListNote
          total={options.length}
          visible={list.visible.length}
          loading={loading}
          emptyLabel={emptyLabel}
        />
      </div>
    </div>
  )
}

/** Single-select: a pick is the whole answer, so it closes the popover. */
export function ChoiceEditor({
  options,
  value,
  onChange,
  emptyLabel,
  loading = false,
}: {
  options: { value: string; label: string }[]
  /** The chosen value, or `""` for none. */
  value: string
  onChange: (value: string) => void
  emptyLabel?: string
  loading?: boolean
}) {
  const { close } = useFilterEditor()
  const list = useListFilter(options)

  return (
    <div className="flex flex-col">
      {list.searchable && <ListSearch value={list.query} onChange={list.setQuery} />}
      <div className="max-h-64 overflow-y-auto">
        {list.visible.map((option) => {
          const on = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => {
                onChange(option.value)
                close()
              }}
              className={ROW}
            >
              <Tick on={on} />
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
        <ListNote
          total={options.length}
          visible={list.visible.length}
          loading={loading}
          emptyLabel={emptyLabel}
        />
      </div>
    </div>
  )
}

/** Free text. Enter closes; the value is already live as it is typed. */
export function TextEditor({
  value,
  onChange,
  placeholder,
  label,
  type = "text",
  inputMode,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** The accessible name — the popover header shows the visible one. */
  label: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  const { close } = useFilterEditor()

  return (
    <div className="p-1">
      <Input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        // 16px below lg: iOS zooms the page when a smaller field takes focus.
        className="text-base lg:text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") close()
        }}
      />
    </div>
  )
}

/**
 * A floor and a ceiling, as two labelled boxes. Two boxes rather than a
 * slider for the same reason the toolbar had them: the amounts run into the
 * thousands and a slider cannot land on the number somebody has in mind.
 */
export function RangeEditor({
  min,
  max,
  onMinChange,
  onMaxChange,
  inputMode = "decimal",
}: {
  min: string
  max: string
  onMinChange: (value: string) => void
  onMaxChange: (value: string) => void
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  const t = useT()
  const { close } = useFilterEditor()
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") close()
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-muted">{t("filters.from")}</span>
        <Input
          inputMode={inputMode}
          value={min}
          onChange={(e) => onMinChange(e.target.value)}
          onKeyDown={onEnter}
          className="text-base lg:text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-muted">{t("filters.to")}</span>
        <Input
          inputMode={inputMode}
          value={max}
          onChange={(e) => onMaxChange(e.target.value)}
          onKeyDown={onEnter}
          className="text-base lg:text-sm"
        />
      </label>
    </div>
  )
}

/**
 * One day. The pick is the whole answer, so it closes the popover — the
 * calendar's own `Clear` is still there for emptying it.
 */
export function DateEditor({
  value,
  onChange,
  label,
}: {
  /** `yyyy-mm-dd`, or `""` for none. */
  value: string
  onChange: (value: string) => void
  /** The accessible name — the popover header shows the visible one. */
  label: string
}) {
  const { close } = useFilterEditor()

  return (
    <div className="p-1">
      <DatePicker
        variant="field"
        label={label}
        value={value}
        onChange={(next) => {
          onChange(next)
          if (next) close()
        }}
      />
    </div>
  )
}

/**
 * A date window as two `field` pickers. The month grid opens in a popover
 * of its own, nested inside the editor's — Base UI tracks the nesting, so a
 * click in the grid does not count as a click outside the editor. The ends
 * bound each other, so an inverted window cannot be assembled by clicking.
 */
export function DateRangeEditor({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  /** `yyyy-mm-dd`, or `""` for an open end. */
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const t = useT()
  const fromId = React.useId()
  const toId = React.useId()

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex flex-col gap-1">
        <label htmlFor={fromId} className="text-xs font-medium text-text-muted">
          {t("filters.from")}
        </label>
        <DatePicker
          id={fromId}
          variant="field"
          value={from}
          onChange={onFromChange}
          max={to || undefined}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={toId} className="text-xs font-medium text-text-muted">
          {t("filters.to")}
        </label>
        <DatePicker
          id={toId}
          variant="field"
          value={to}
          onChange={onToChange}
          min={from || undefined}
        />
      </div>
    </div>
  )
}
