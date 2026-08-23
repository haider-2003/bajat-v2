import * as React from "react"

import type { BaseQuery, FilterQuery } from "@/types/api"
import { DEFAULT_PAGE_SIZE } from "@/utils/constants"

/**
 * Pagination state for a server-driven list, tied to its filters.
 *
 * Hand it the clause array from `buildFilter` and it hands back the whole
 * `BaseQuery` to pass to a list hook:
 *
 * ```ts
 * const filter = React.useMemo(() => buildFilter({ search, statuses }), [search, statuses])
 * const { query, page, pageSize, setPage, setPageSize } = useListQuery(filter)
 * const rows = useGetMembersRequests(query, { placeholderData: keepPreviousData })
 * ```
 *
 * ### The page resets itself
 *
 * Both of the visible-confusion bugs in
 * docs/filtering-sorting-pagination.md §9 — a filter change and a page-size
 * change each leaving you stranded past the end of a shrunken result set — come
 * from page being remembered across a change that invalidates it. So page is
 * **not** remembered across one: it is stored against a snapshot of the filters
 * and page size, and reads as 1 the moment that snapshot no longer matches.
 *
 * Deriving it rather than correcting it in an effect matters. An effect would
 * render one frame asking for page 5 of a one-page result, fire that request,
 * and only then snap back — a wasted round trip and a flash of an empty table.
 * Every call site is also spared a `setPage(1)` it can forget to write.
 */
export function useListQuery(
  filter: FilterQuery[],
  options?: {
    /** Rows per page to start on. Defaults to `DEFAULT_PAGE_SIZE`. */
    pageSize?: number
  }
): {
  /** Ready to pass straight to a list hook. */
  query: BaseQuery
  page: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
} {
  const [pageSize, setPageSize] = React.useState(
    options?.pageSize ?? DEFAULT_PAGE_SIZE
  )

  // What the current page number is valid *for*. Anything that changes which
  // rows land on which page belongs in here.
  const scope = React.useMemo(
    () => JSON.stringify([pageSize, filter]),
    [pageSize, filter]
  )

  const [paged, setPaged] = React.useState({ scope, page: 1 })
  const page = paged.scope === scope ? paged.page : 1

  const setPage = (next: number) => setPaged({ scope, page: Math.max(1, next) })

  const query = React.useMemo<BaseQuery>(
    () => ({ page, pageSize, filter }),
    [page, pageSize, filter]
  )

  return { query, page, pageSize, setPage, setPageSize }
}
