import type { FilterQuery, FilterValue } from "@/types/api"

/**
 * Turns a plain record of filter values into the clause array every list hook
 * takes. See docs/filtering-sorting-pagination.md §6.
 *
 * ```ts
 * buildFilter({ search, phone, statuses, organizationId })
 * // → [{ field: "organizationId", value: "3" }, { field: "phone", … }, …]
 * ```
 *
 * Two things it guarantees, both of which are easy to get wrong by hand:
 *
 * 1. **Empty means absent.** `""`, `null`, `undefined` and `[]` drop the clause
 *    entirely rather than sending `?search=`. Clearing a box produces an
 *    unfiltered request, not a request for the empty string. `0` and `false`
 *    are *not* empty — they are legitimate values and survive.
 * 2. **Order is stable.** Clauses come out sorted by field name, so the same
 *    set of filters always produces the same array — and therefore the same
 *    React Query key, whatever order the caller happened to write them in.
 *    Insertion order would give one screen two cache entries for one state.
 */
export function buildFilter(
  values: Record<string, FilterValue | null | undefined>
): FilterQuery[] {
  return Object.entries(values)
    .filter(([, value]) => !isEmpty(value))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([field, value]) => ({ field, value: value as FilterValue }))
}

/** `""`, `null`, `undefined` and `[]`. Deliberately not `0` or `false`. */
function isEmpty(value: FilterValue | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true
  return Array.isArray(value) && value.length === 0
}
