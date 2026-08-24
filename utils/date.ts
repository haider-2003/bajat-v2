/**
 * Date conversion at the query boundary.
 *
 * Screens hold dates as `yyyy-mm-dd` — what a calendar actually selects, with
 * no timezone attached. The API wants an instant. This is the only place the
 * two meet.
 */

/**
 * `yyyy-mm-dd` to the ISO instant of that day's **local** midnight.
 *
 * ```
 * "2026-08-13"  →  "2026-08-12T21:00:00.000Z"   // in UTC+3
 * ```
 *
 * The local part matters. `new Date("2026-08-13").toISOString()` round-trips to
 * `2026-08-13T00:00:00.000Z`, because the string form parses as UTC — which is
 * 3am on the 13th locally, so a row created at 1am that morning falls outside a
 * range that visibly starts on the 13th. Building the date through
 * `new Date(y, m, d)` anchors it to the user's midnight instead, which is the
 * boundary they picked.
 *
 * `""` passes through as `""`: an empty end of a range is unbounded, not epoch.
 */
export function toInstant(value: string): string {
  if (!value) return ""

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ""

  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  // Rejects overflow like 2026-02-31, which `Date` would roll forward.
  if (date.getMonth() !== Number(m) - 1) return ""

  return date.toISOString()
}

/**
 * `yyyy-mm-dd` to the ISO instant of that day's **local** end — 23:59:59.999.
 *
 * The upper bound of a range needs the end of the chosen day, not its start.
 * `toInstant` on both ends of "13th → 13th" asks for a zero-width window and
 * returns nothing, and on "1st → 13th" silently drops everything that happened
 * on the 13th, which is the day the user could see on screen when they picked
 * it.
 *
 * `""` passes through as `""`, same as `toInstant`.
 */
export function toDayEndInstant(value: string): string {
  if (!value) return ""

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return ""

  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999)
  if (date.getMonth() !== Number(m) - 1) return ""

  return date.toISOString()
}

/**
 * The `*_at_range[]` pair a list endpoint takes, from two `yyyy-mm-dd` values.
 *
 * **Position is the whole contract**: the backend reads element 0 as the start
 * and element 1 as the end. So an open-ended *lower* bound cannot simply be
 * omitted — `[endInstant]` is a one-element array, and the backend would read
 * that lone value as the start, turning "up to the 13th" into "from the 13th",
 * which is not a narrower filter but the opposite one. `EPOCH` fills the slot
 * instead, as a constant rather than something derived from `Date.now()` so the
 * clause is stable across renders and React Query keeps hashing it to one key.
 *
 * Both ends unset gives `undefined`, which `buildFilter` drops entirely.
 */
const EPOCH = "1970-01-01T00:00:00.000Z"

export function toInstantRange(
  from: string,
  to: string
): string[] | undefined {
  const start = toInstant(from)
  const end = toDayEndInstant(to)

  if (!start && !end) return undefined
  // An open-ended upper bound *can* be omitted — a one-element array is read
  // as a start, which is exactly what it means here.
  if (start && !end) return [start]
  if (!start && end) return [EPOCH, end]
  return [start, end]
}
