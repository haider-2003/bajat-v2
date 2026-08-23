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

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** An ISO timestamp as `Mon, 13 Aug 2026`. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return EMPTY_VALUE
  const date = new Date(iso)
  // `new Date(null)` is the epoch and `new Date("nonsense")` is Invalid Date,
  // which makes Intl throw — neither should reach a cell.
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return dateFmt.format(date)
}

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
  if (local.length !== 10) return phone
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
