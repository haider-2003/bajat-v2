"use client"

import * as React from "react"
import { Check, Languages } from "lucide-react"

import {
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-section"
import { locales, localeDir, localeNames, type Locale } from "@/i18n/config"
import { useLocale, useT } from "@/i18n/context"
import { useSwitchLocale } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/**
 * Language — the switch between English and Arabic.
 *
 * ### Why a pair of named cards, not a Segmented control
 *
 * Every other choice on this page is a `Segmented`, and this one deliberately
 * is not. A segmented control is legible only to someone who can already read
 * its labels, and the one person guaranteed to need this row is the person who
 * cannot read the page it is on. So each option is a card carrying its own
 * **endonym** — "العربية", not "Arabic" — at a size you can find by shape.
 *
 * ### It is a link's worth of work, not a toggle's
 *
 * Switching rewrites the URL (`/en/settings` → `/ar/settings`) and refetches
 * the tree, because the dictionary is server data. `useSwitchLocale` does both
 * and writes the `NEXT_LOCALE` cookie the proxy reads on the next cold visit.
 * Nothing is stored in React state here: the URL is the state.
 */
export function LanguageSection() {
  const t = useT()
  const active = useLocale()
  const switchLocale = useSwitchLocale()

  // The switch is a navigation, so it can be in flight. Marking it keeps a
  // second click from queueing a second `replace` on a slow connection.
  const [pending, startTransition] = React.useTransition()

  return (
    <SettingsSection
      id="language"
      icon={Languages}
      title={t("settings.language.title")}
      description={t("settings.language.description")}
    >
      <SettingsRow
        label={t("settings.language.rowLabel")}
        description={t("settings.language.rowDescription", {
          language: localeNames[active].native,
        })}
        control={
          <div
            role="radiogroup"
            aria-label={t("settings.language.rowLabel")}
            className="flex flex-wrap gap-2"
          >
            {locales.map((locale) => (
              <LocaleCard
                key={locale}
                locale={locale}
                selected={locale === active}
                disabled={pending}
                onSelect={() => {
                  if (locale === active) return
                  startTransition(() => switchLocale(locale))
                }}
              />
            ))}
          </div>
        }
      />
    </SettingsSection>
  )
}

/**
 * One language, as a card.
 *
 * The endonym is set with its own `lang` and `dir` so the browser shapes it in
 * that language regardless of the document's: Arabic inside an English page
 * still needs RTL ordering and the Arabic face, or "العربية" renders as
 * disconnected glyphs in the wrong order — which is exactly the reader this
 * card exists for.
 */
function LocaleCard({
  locale,
  selected,
  disabled,
  onSelect,
}: {
  locale: Locale
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const { native, english } = localeNames[locale]

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        // §18.7 — a 44px touch target; the card is taller than that anyway.
        "relative flex min-w-[128px] flex-col items-start gap-0.5 rounded-md border px-3 py-2.5",
        "transition-[background-color,border-color,box-shadow] duration-120",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? // §14.2's selected treatment: accent-soft fill inside an accent rim.
            "border-accent-border bg-accent-soft"
          : "border-border bg-surface hover:border-border-strong"
      )}
    >
      <span
        lang={locale}
        dir={localeDir[locale]}
        className={cn(
          "text-sm font-medium",
          selected ? "text-accent-violet" : "text-text"
        )}
      >
        {native}
      </span>
      {/* The English name under it, so the row is navigable from either
          language rather than only from the one you already read. */}
      <span className="text-[11px] text-text-muted">{english}</span>

      {selected && (
        <Check
          aria-hidden
          className="absolute end-2 top-2 size-3.5 text-accent-violet"
          strokeWidth={2.5}
        />
      )}
    </button>
  )
}
