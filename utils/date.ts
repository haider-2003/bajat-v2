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
