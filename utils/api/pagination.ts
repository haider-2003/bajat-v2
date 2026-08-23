import type { PageInfo } from "@/types/api"

/**
 * Reads the pagination numbers out of a list response body.
 *
 * Two envelopes are in the wild for these endpoints. The documented one is
 * `{ data: [...], meta: { total, currentPage, perPage } }`
 * (docs/api-types.md § response envelopes). A controller that returns a
 * Laravel paginator straight out instead produces
 * `{ data: [...], total, lastPage, perPage, currentPage }` — **no `meta`**.
 *
 * Rows sit at `body.data` in both, which is exactly why a table can render
 * perfectly and still have a dead Next button: the row count is found, the
 * total is not, and every control that depends on the total goes quiet.
 *
 * So: look in `meta` first, fall back to the body root, and coerce — a
 * paginator serialized through PHP hands several of these back as strings.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Numbers only, and only real ones — `"12"` counts, `""`, `null` and `NaN` do not. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function readPageInfo(body: unknown): PageInfo {
  const root = isRecord(body) ? body : undefined
  const meta = root && isRecord(root.meta) ? root.meta : undefined

  const pick = (key: string) => toNumber(meta?.[key]) ?? toNumber(root?.[key])

  const total = pick("total")
  const perPage = pick("perPage")

  // `lastPage` is the honest source when the backend sends it. Otherwise derive
  // it from the total and the page size the *server* used — which is not always
  // the one that was asked for.
  const lastPage =
    pick("lastPage") ??
    (total !== undefined && perPage !== undefined && perPage > 0
      ? Math.max(1, Math.ceil(total / perPage))
      : undefined)

  return { total, perPage, lastPage, currentPage: pick("currentPage") }
}
