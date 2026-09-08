"use client"

import { EMPTY_VALUE } from "@/utils/format"

/**
 * A charged amount and its currency.
 *
 * ### The number is not reformatted
 *
 * `Payment.amount` arrives as a **string** that the provider has already
 * rounded to the currency's precision. Parsing it into a JS number to run it
 * through `Intl.NumberFormat` is the one place a rounding difference could
 * appear between what was charged and what this table claims was charged — and
 * IQD amounts are large enough that a float round-trip is not free. So the
 * digits are rendered exactly as sent, with only grouping separators added to
 * a value that has none.
 *
 * ### Tabular and LTR
 *
 * A column of amounts is compared down the page, so the digits have to align:
 * `tabular-nums` fixes the advance width. `dir="ltr"` keeps the number and its
 * currency in that order on an Arabic page — an amount is a quantity, and
 * mirroring it would put the code before the figure.
 */
export function AmountCell({
  amount,
  currency,
}: {
  amount: string | null | undefined
  currency: string | null | undefined
}) {
  if (!amount?.trim()) {
    return <span className="text-[13px] text-text-placeholder">{EMPTY_VALUE}</span>
  }

  return (
    <span dir="ltr" className="flex items-baseline justify-end gap-1.5 tabular-nums">
      <span className="text-[13px] font-medium text-text">{group(amount)}</span>
      {currency && (
        // Quieter and smaller: the figure is what is compared, the code is
        // what confirms it is comparable.
        <span className="text-[11px] font-medium tracking-[0.02em] text-text-muted uppercase">
          {currency}
        </span>
      )}
    </span>
  )
}

/**
 * Adds thousands separators to the integer part, leaving everything else
 * alone.
 *
 * Deliberately string-only. A value that is not a plain decimal — a range, a
 * currency symbol the provider inlined, anything unexpected — is returned
 * untouched rather than mangled into a shape it is not.
 */
function group(amount: string): string {
  const trimmed = amount.trim()
  const match = /^(-?)(\d+)(\.\d+)?$/.exec(trimmed)
  if (!match) return trimmed

  const [, sign, whole, fraction] = match
  return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ?? ""}`
}
