"use client"

import { locales, localeDir, localeNames } from "@/i18n/config"
import { useLocale } from "@/i18n/context"
import { useSwitchLocale } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/**
 * The language switch, sized for a footer.
 *
 * Settings owns the real control (a pair of labelled cards); this is the same
 * action at link scale, because sign-in has no Settings to send anyone to and
 * a full section would outweigh the form it sits under.
 *
 * Each option carries its own endonym with its own `lang`/`dir`, for the same
 * reason the Settings cards do: the person who needs this is the person who
 * cannot read the rest of the page, and "العربية" only shapes correctly when
 * the browser is told what it is.
 */
export function LocaleToggle() {
  const active = useLocale()
  const switchLocale = useSwitchLocale()

  return (
    <div className="flex items-center gap-1.5">
      {locales.map((locale, i) => (
        <span key={locale} className="flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden className="text-text-placeholder/60">
              ·
            </span>
          )}
          <button
            type="button"
            lang={locale}
            dir={localeDir[locale]}
            aria-current={locale === active ? "true" : undefined}
            onClick={() => {
              if (locale !== active) switchLocale(locale)
            }}
            className={cn(
              "rounded-xs transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              locale === active
                ? "font-medium text-text-secondary"
                : "hover:text-text-secondary"
            )}
          >
            {localeNames[locale].native}
          </button>
        </span>
      ))}
    </div>
  )
}
