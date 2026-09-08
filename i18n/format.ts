"use client"

import * as React from "react"

import { localeTag } from "./config"
import { useLocale } from "./context"
import { formatDate } from "@/utils/format"

/**
 * Locale-bound display formatters.
 *
 * `utils/format.ts` holds the formatting itself and takes a BCP 47 tag; these
 * hooks are the bridge from the app's two-letter locale to that tag, so a
 * component never has to know that `ar` means `ar-IQ-u-nu-latn`.
 *
 * Only dates need this. Phone numbers are Iraqi in both languages and their
 * grouping is part of the number, and `formatText` only ever chooses between a
 * string and a dash.
 */

/**
 * `const date = useFormatDate()` \u2014 then `date(row.createdAt)`.
 *
 * Stable across renders for a given locale, so it is safe in a `useMemo`
 * dependency list or inside a column definition.
 */
export function useFormatDate() {
  const locale = useLocale()
  const tag = localeTag[locale]
  return React.useCallback(
    (iso: string | null | undefined) => formatDate(iso, tag),
    [tag]
  )
}
