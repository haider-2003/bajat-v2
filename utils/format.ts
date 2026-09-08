/**
 * Display formatters, shared by every screen.
 *
 * ### All of these are null-tolerant on purpose
 *
 * The API types document most fields as required strings, but real rows come
 * back with nulls — an applicant who never supplied a phone, a date that was
 * never set. A dash is the right answer for a missing value; a thrown
 * `TypeError` takes the whole table down with it. So every formatter here takes
 * `string | null | undefined` and always returns something renderable.
 */

/** Rendered wherever a value is missing. */
export const EMPTY_VALUE = "—"

/** Text that is safe to render, whatever the field actually held. */
export function formatText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : EMPTY_VALUE
}

/**
 * One formatter per locale, built on first use.
 *
 * `Intl.DateTimeFormat` is expensive to construct and a table asks for a few
 * hundred dates per render, so the instances are kept rather than rebuilt. The
 * cache is keyed by tag because the app now formats in two languages.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function dateFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = dateFormatters.get(locale)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    dateFormatters.set(locale, fmt)
  }
  return fmt
}

/**
 * An ISO timestamp as `Mon, 13 Aug 2026` — or its Arabic equivalent.
 *
 * `locale` is a BCP 47 tag, not one of the app's two-letter codes: components
 * pass it through `useFormatDate()` (i18n/format.ts), which maps `ar` to
 * `ar-IQ-u-nu-latn` so months are named in Arabic while the digits stay Latin.
 * The default keeps every non-React caller working unchanged.
 */
export function formatDate(
  iso: string | null | undefined,
  locale: string = "en-GB"
) {
  if (!iso) return EMPTY_VALUE
  const date = new Date(iso)
  // `new Date(null)` is the epoch and `new Date("nonsense")` is Invalid Date,
  // which makes Intl throw — neither should reach a cell.
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return dateFormatter(locale).format(date)
}

/**
 * How many digits an Iraqi number has once the country code and the trunk
 * `0` are off it. Both the display formatter and the wire normaliser measure
 * against it, so they cannot disagree about what a complete number is.
 */
const PHONE_LOCAL_DIGITS = 10

/**
 * `"9647701234567"` as `+964 770 123 4567`.
 *
 * Iraqi numbers specifically: anything that doesn't come out to ten local
 * digits is returned untouched rather than mangled into a shape it isn't.
 */
export function formatPhone(phone: string | null | undefined) {
  if (!phone) return EMPTY_VALUE
  const digits = phoneDigits(phone)
  const local = digits.startsWith("964") ? digits.slice(3) : digits
  if (local.length !== PHONE_LOCAL_DIGITS) return phone
  return `+964 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}

/**
 * A typed phone number reduced to the digits the API stores.
 *
 * Phone fields come back bare — `"9647701234567"` — so a filter that forwarded
 * `+964 770 123 4567` verbatim would never match. Punctuation and spacing are
 * the user's; the digits are the value.
 */
export function phoneDigits(value: string) {
  return value.replace(/\D/g, "")
}

/**
 * A typed phone number in the shape the API stores — `"9647701234567"`.
 *
 * Returns `null` when the input cannot be read as one, so a caller can tell
 * "not a phone number" from "a phone number I reformatted".
 *
 * ### Why this exists
 *
 * `formatPhone` above is the contract, read backwards: the stored value is a
 * `964` country code followed by **ten** local digits. What people type is the
 * local form with a leading zero — `07877242069` — which is eleven digits and
 * neither the stored shape nor anything the backend accepts. Sending it
 * through verbatim is what earns "The phone field format is invalid."
 *
 * So every accepted spelling of the same number collapses to one:
 *
 * ```
 * 07877242069      →  9647877242069
 * 7877242069       →  9647877242069
 * +964 787 724 2069 → 9647877242069
 * 009647877242069  →  9647877242069
 * ```
 *
 * The trunk `0` and the `+964` are alternatives to each other, never both, so
 * the country code is stripped first and the trunk zero only after — otherwise
 * `9640787…` would lose a digit that belongs to the subscriber.
 */
export function toApiPhone(value: string): string | null {
  let digits = phoneDigits(value)

  // `00` is the dialled form of `+`; drop it before looking for the code.
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("964")) digits = digits.slice(3)
  // The national trunk prefix, dropped when the number is written in full.
  if (digits.startsWith("0")) digits = digits.slice(1)

  return digits.length === PHONE_LOCAL_DIGITS ? `964${digits}` : null
}
