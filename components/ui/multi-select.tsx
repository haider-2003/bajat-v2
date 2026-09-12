"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * A form multi-select — DESIGN.md §10.3 for the trigger, §12.5 for the
 * searchable menu.
 *
 * ### Not `FacetEditor`, and not for the same job
 *
 * `components/filters/facet-filter.tsx` is the *toolbar* multi-select: it wears
 * §6.6's compact filter chip, and a facet with nothing ticked means "do not
 * filter". This one wears §10.3's full-width field box and lives inside a
 * `Field`, where nothing ticked means an empty array is about to be submitted —
 * which for `role_ids` and `node_ids` is a validation error, not a default.
 * Same interaction, two different meanings for the empty state, so they stay
 * two components.
 *
 * ### The trigger says what is selected, not how many
 *
 * Up to two selections are named. Past that it counts, because three truncated
 * names in a 36px box name none of them. The full set is always one click away
 * and always ticked in the list, so the trigger is a summary rather than the
 * record.
 *
 * ### Search appears only when the list is long enough to need it
 *
 * A search box over six nodes is a control that costs a keystroke and saves
 * none (§12.5). Over sixty permissions it is the only way through.
 */

export type MultiSelectOption = {
  value: string
  label: string
  /** Optional colour dot — nodes carry one, roles do not. */
  color?: string
}

/** Below this the list is scannable; above it, it needs a filter (§12.5). */
const SEARCH_THRESHOLD = 8

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  loading = false,
  disabled = false,
  id,
  className,
  ...aria
}: {
  options: MultiSelectOption[]
  /** The selected values. Order is the caller's; this control never reorders. */
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Shown when there is nothing to pick and nothing is loading. */
  emptyLabel?: string
  loading?: boolean
  disabled?: boolean
  id?: string
  className?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
}) {
  const t = useT()
  const [query, setQuery] = React.useState("")

  const selected = React.useMemo(() => new Set(value), [value])

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.label.toLowerCase().includes(needle))
  }, [options, query])

  /** Toggling never reorders: a value keeps its place, or is appended. */
  const toggle = (option: string) => {
    onChange(
      selected.has(option) ? value.filter((v) => v !== option) : [...value, option]
    )
  }

  const summary = React.useMemo(() => {
    if (value.length === 0) return null
    const labels = value
      .map((v) => options.find((option) => option.value === v)?.label)
      // A selected id whose option has not loaded yet — or was deleted — still
      // has to be counted. Dropping it would make the trigger disagree both
      // with the ticked list and with what is about to be submitted.
      .filter((label): label is string => !!label)
    if (labels.length === 0 || value.length > 2) {
      return t("common.selectedCount", { count: value.length })
    }
    return labels.join(t("common.listSeparator"))
  }, [value, options, t])

  return (
    <Popover>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
        className={cn(
          // §10.3 — a select trigger takes the text input's box.
          "flex w-full items-center gap-2 rounded-lg border border-input bg-surface px-3",
          // §18.7 — 44px for touch, the §10.1 36px box from 768px up.
          "h-11 text-base md:h-9 md:text-sm",
          "text-start transition-colors duration-120 outline-none",
          "focus-visible:border-accent-violet focus-visible:ring-2 focus-visible:ring-ring/45",
          "aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-surface-sunken",
          className
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            summary ? "text-text" : "text-text-placeholder"
          )}
        >
          {summary ?? placeholder ?? t("common.selectPlaceholder")}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-text-muted"
          strokeWidth={1.5}
          aria-hidden
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        // Matched to the trigger so the panel reads as the field opening rather
        // than a menu appearing beside it.
        className="w-(--anchor-width) min-w-56 p-1"
      >
        {options.length > SEARCH_THRESHOLD && (
          <div className="mb-1 flex items-center gap-2 border-b border-border px-2 pb-1.5">
            <Search
              className="size-3.5 shrink-0 text-text-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
              className="h-7 w-full bg-transparent text-[13px] text-text outline-none placeholder:text-text-placeholder"
            />
          </div>
        )}

        <div role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto">
          {loading ? (
            <p className="px-2 py-6 text-center text-[13px] text-text-muted">
              {t("common.loading")}
            </p>
          ) : visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-text-muted">
              {options.length === 0
                ? (emptyLabel ?? t("common.noOptions"))
                : t("common.noMatches")}
            </p>
          ) : (
            visible.map((option) => {
              const checked = selected.has(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    // §12.2 menu item, at §18.7's touch height below md.
                    "flex w-full items-center gap-2 rounded-md px-2 text-start",
                    "h-9 text-sm md:h-8 md:text-[13px]",
                    "transition-colors duration-120 outline-none",
                    "hover:bg-[rgba(0,0,0,0.04)] focus-visible:bg-[rgba(0,0,0,0.04)]",
                    "dark:hover:bg-[rgba(255,255,255,0.06)] dark:focus-visible:bg-[rgba(255,255,255,0.06)]",
                    checked ? "text-text" : "text-text-secondary"
                  )}
                >
                  {option.color && (
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {checked && (
                    <Check
                      className="size-3.5 shrink-0 text-accent-violet"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
