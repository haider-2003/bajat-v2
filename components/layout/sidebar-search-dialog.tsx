"use client"

import * as React from "react"
import { CornerDownLeft, Search } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { locales, type Locale } from "@/i18n/config"
import { useT } from "@/i18n/context"
import { getDictionary } from "@/i18n/dictionaries"
import { useLocaleRouter } from "@/i18n/navigation"
import {
  createTranslator,
  type Dictionary,
  type TranslationKey,
  type Translator,
} from "@/i18n/translate"
import { cn } from "@/lib/utils"

import {
  footerNav,
  navSections,
  primaryNav,
  type NavItem,
} from "./sidebar-nav-data"

/**
 * Navigation search — the field in zone 2, and ⌘K from anywhere.
 *
 * ### It matches both languages, whichever one you are reading
 *
 * The rail is translated, so a search that only ever saw the current
 * dictionary would answer "members" with nothing while the user is in Arabic,
 * and "الأعضاء" with nothing while they are in English. Neither is a miss the
 * user can explain — the page is right there in the list behind the dialog.
 *
 * So the index carries every label in **both** locales and matches against all
 * of them. Nobody has to know which language a page was filed under, and a
 * bilingual team typing whichever word came to mind first both get an answer.
 *
 * Both dictionaries are loaded on first open rather than imported at the top of
 * this module: `i18n/dictionaries` splits them on purpose, so an English
 * visitor never downloads the Arabic strings, and holding that line is worth
 * more than the few milliseconds before the first keystroke lands.
 */

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

/**
 * Fold away everything two people typing the same word might disagree about.
 *
 * Arabic needs more than `toLowerCase`. The same word is written with or
 * without harakat, with any of four alefs, and ending in ة or ه depending on
 * who is typing — none of which the user considers a different word, and all
 * of which a plain substring match would. Latin accents come off in the same
 * NFKD pass.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    // Combining marks: Latin accents, plus the Arabic harakat the
    // decomposition above just separated out.
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    // Tatweel is decoration — it stretches a joined letter and means nothing.
    .replace(/ـ/g, "")
    // أ إ آ ٱ are all ا to someone searching.
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
}

type SearchRow = {
  href: string
  icon: NavItem["icon"]
  labelKey: TranslationKey
  /** The group or section the row sits under, shown as context in the list. */
  contextKey?: TranslationKey
}

type SearchEntry = SearchRow & {
  /** Every label this entry answers to, in every locale, normalized. */
  haystack: string[]
}

/** Flatten the rail down to the rows a search can actually land on. */
function collect(
  items: NavItem[],
  contextKey: TranslationKey | undefined,
  out: SearchRow[]
) {
  for (const item of items) {
    if (item.children?.length) {
      // A group header is not a destination; its children are. They carry no
      // icon of their own — in the rail they are text indented under the
      // parent — so they borrow the parent's, which is what the eye already
      // associates them with.
      for (const child of item.children) {
        out.push({
          href: child.href,
          icon: item.icon,
          labelKey: child.labelKey,
          contextKey: item.labelKey,
        })
      }
      continue
    }
    out.push({
      href: item.href,
      icon: item.icon,
      labelKey: item.labelKey,
      contextKey,
    })
  }
}

function buildIndex(dictionaries: Record<Locale, Dictionary>): SearchEntry[] {
  const rows: SearchRow[] = []
  collect(primaryNav, undefined, rows)
  for (const section of navSections) collect(section.items, section.labelKey, rows)
  collect(footerNav, undefined, rows)

  const translators = Object.fromEntries(
    locales.map((locale) => [
      locale,
      createTranslator(dictionaries[locale], locale),
    ])
  ) as Record<Locale, Translator>

  return rows.map((row) => ({
    ...row,
    haystack: locales.flatMap((locale) => {
      const translate = translators[locale]
      const label = normalize(translate(row.labelKey))
      // The parent is indexed too, so searching a section name offers the
      // rows filed under it.
      return row.contextKey
        ? [label, normalize(translate(row.contextKey))]
        : [label]
    }),
  }))
}

/**
 * A label the query *starts* outranks one it merely appears inside, so typing
 * a page's first letters offers that page before the section holding it.
 */
function score(entry: SearchEntry, query: string): number {
  let best = -1
  for (const hay of entry.haystack) {
    if (hay.startsWith(query)) return 2
    if (hay.includes(query)) best = Math.max(best, 1)
  }
  return best
}

/** Cached across opens: the dictionaries cannot change within a session. */
let dictionariesPromise: Promise<Record<Locale, Dictionary>> | null = null

function loadDictionaries(): Promise<Record<Locale, Dictionary>> {
  dictionariesPromise ??= Promise.all(
    locales.map((locale) => getDictionary(locale))
  ).then(
    (loaded) =>
      Object.fromEntries(locales.map((locale, i) => [locale, loaded[i]])) as Record<
        Locale,
        Dictionary
      >
  )
  return dictionariesPromise
}

/* ------------------------------------------------------------------ *
 * The panel
 * ------------------------------------------------------------------ */

/**
 * Mounted fresh on every open, which is what clears the query and the
 * selection — cheaper, and harder to get wrong, than an effect that has to
 * remember to reset them.
 */
function SearchPanel({ onNavigate }: { onNavigate: (href: string) => void }) {
  const t = useT()
  const [query, setQuery] = React.useState("")
  const [index, setIndex] = React.useState<SearchEntry[] | null>(null)
  const [active, setActive] = React.useState(0)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let alive = true
    loadDictionaries().then((dictionaries) => {
      if (alive) setIndex(buildIndex(dictionaries))
    })
    return () => {
      alive = false
    }
  }, [])

  const results = React.useMemo(() => {
    if (!index) return []
    const needle = normalize(query)
    if (!needle) return index
    return index
      .map((entry) => ({ entry, rank: score(entry, needle) }))
      .filter((row) => row.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .map((row) => row.entry)
  }, [index, query])

  // A shorter list can leave the selection past its end.
  const selected = Math.min(active, Math.max(results.length - 1, 0))

  const move = (delta: number) => {
    if (results.length === 0) return
    setActive((current) => {
      const next = Math.min(current, results.length - 1) + delta
      // Wraps, so ↑ from the first row reaches the last without a long hold.
      return (next + results.length) % results.length
    })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      move(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      move(-1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const hit = results[selected]
      if (hit) onNavigate(hit.href)
    }
  }

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>("[data-active=\"true\"]")
      ?.scrollIntoView({ block: "nearest" })
  }, [selected, results.length])

  return (
    <div className="flex max-h-[min(60vh,420px)] flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-4">
        <Search
          className="size-4 shrink-0 text-text-placeholder"
          strokeWidth={1.5}
        />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={t("sidebar.searchPlaceholder")}
          aria-label={t("sidebar.searchPlaceholder")}
          className={cn(
            "h-12 min-w-0 flex-1 bg-transparent text-sm text-text",
            "outline-none placeholder:text-text-placeholder"
          )}
        />
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {results.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[13px] text-text-muted">
            {/* Nothing at all until the index lands: "no matches" would be a
                lie for the frame or two the import takes. */}
            {index === null ? "" : t("sidebar.searchEmpty", { query })}
          </p>
        ) : (
          results.map((entry, i) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.href}
                type="button"
                data-active={i === selected}
                onPointerMove={() => setActive(i)}
                onClick={() => onNavigate(entry.href)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start",
                  "outline-none transition-colors duration-100",
                  i === selected
                    ? "bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.06)]"
                    : "hover:bg-[rgba(0,0,0,0.035)] dark:hover:bg-[rgba(255,255,255,0.04)]"
                )}
              >
                <Icon
                  className="size-4 shrink-0 text-text-muted"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  {t(entry.labelKey)}
                </span>
                {entry.contextKey && (
                  <span className="shrink-0 truncate text-[11px] text-text-muted">
                    {t(entry.contextKey)}
                  </span>
                )}
                {i === selected && (
                  <CornerDownLeft
                    aria-hidden
                    className="size-3.5 shrink-0 text-text-placeholder"
                    strokeWidth={1.5}
                  />
                )}
              </button>
            )
          })
        )}
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-text-muted">
        {t("sidebar.searchHint")}
      </p>
    </div>
  )
}

export function SidebarSearchDialog({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Lets the shell close the mobile drawer the search was opened from. */
  onNavigate?: () => void
}) {
  const t = useT()
  const router = useLocaleRouter()

  const go = (href: string) => {
    onOpenChange(false)
    onNavigate?.()
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        {/* The field reads as the heading; screen readers still need a real one. */}
        <DialogTitle className="sr-only">{t("common.search")}</DialogTitle>
        {open && <SearchPanel onNavigate={go} />}
      </DialogContent>
    </Dialog>
  )
}
