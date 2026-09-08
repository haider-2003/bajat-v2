/**
 * The lookup that both halves of the app share.
 *
 * A server component gets its `t` from `getTranslations()` (i18n/server.ts)
 * and a client component from `useT()` (i18n/context.tsx), but both are this
 * same function over the same JSON — so a string reads identically either side
 * of the boundary, and moving a component across it changes nothing.
 *
 * No React and no `next/*` imports: the proxy and plain utilities can use it.
 */

import type enDictionary from "./dictionaries/en.json"

/**
 * A count-sensitive string, keyed by CLDR plural category.
 *
 * `other` is mandatory and is the fallback for every category a language does
 * not distinguish — which is why English only ever writes `one` and `other`,
 * while Arabic can spell out all six.
 */
export type PluralForms = {
  other: string
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
}

/** The shape every dictionary must have — English is the reference. */
export type Dictionary = typeof enDictionary

type DictionaryNode = string | PluralForms | { [key: string]: DictionaryNode }

/**
 * Every addressable key in the dictionary, as a dot path.
 *
 * This is what makes a typo in `t("nav.setings")` a build error rather than a
 * key rendered raw into the UI. Recursion stops at a string, and at a plural
 * node — detected by its mandatory `other` — so `t("table.rows")` is the key
 * rather than `t("table.rows.other")`.
 */
export type TranslationKey<T = Dictionary> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends PluralForms
      ? K
      : `${K}.${TranslationKey<T[K]>}`
}[keyof T & string]

/** Values substituted into `{placeholder}` slots. */
export type TranslationVars = Record<string, string | number>

export type Translator = (
  key: TranslationKey,
  vars?: TranslationVars
) => string

function lookup(dict: DictionaryNode, key: string): DictionaryNode | undefined {
  let node: DictionaryNode | undefined = dict
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined
    node = (node as Record<string, DictionaryNode>)[segment]
  }
  return node
}

/**
 * `{name}` → the matching var.
 *
 * A placeholder with nothing to fill it is left standing rather than replaced
 * with "undefined": the raw brace is visibly a bug, where the word is not.
 */
function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  )
}

function isPlural(node: DictionaryNode): node is PluralForms {
  return typeof node === "object" && node !== null && "other" in node
}

/**
 * Builds the `t` bound to one dictionary.
 *
 * A missing key returns the key itself. That is deliberate: a half-translated
 * screen showing `members.title` still renders, still lays out, and names the
 * exact entry to add — where throwing would take down a page over one string.
 */
export function createTranslator(
  dict: Dictionary,
  locale: string
): Translator {
  // One instance per translator rather than one per call: constructing
  // Intl.PluralRules is the expensive part, and a table re-render asks for the
  // same rule set a few hundred times.
  let plurals: Intl.PluralRules | undefined

  return function t(key, vars) {
    const node = lookup(dict as unknown as DictionaryNode, key)

    if (typeof node === "string") return interpolate(node, vars)

    if (isPlural(node ?? "")) {
      const forms = node as PluralForms
      const count = vars?.count
      if (typeof count !== "number") return interpolate(forms.other, vars)
      plurals ??= new Intl.PluralRules(locale)
      const category = plurals.select(count) as keyof PluralForms
      return interpolate(forms[category] ?? forms.other, vars)
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] missing translation for "${key}" in "${locale}"`)
    }
    return key
  }
}
