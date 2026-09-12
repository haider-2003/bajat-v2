import * as React from "react"

import { useStickyState } from "@/hooks/use-sticky-state"
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
 *
 * ### Both survive leaving the screen
 *
 * Given a `storageKey`, the page and the page size are held in
 * `useStickyState`, so opening a row and coming back lands on the page you
 * left at the size you chose.
 *
 * The scope check above is what makes that safe to restore. The stored page
 * carries the scope it was valid for, so it comes back only if the filters
 * and page size rebuilt on mount hash to the same thing — page 4 of a filter
 * set you are no longer looking at reads as page 1, exactly as it does when
 * you change a filter with the screen open.
 */
export function useListQuery(
  filter: FilterQuery[],
  options?: {
    /** Rows per page to start on. Defaults to `DEFAULT_PAGE_SIZE`. */
    pageSize?: number
    /**
     * Remember the page and page size under this key, per tab. Omit and both
     * reset every time the screen is mounted.
     */
    storageKey?: string
  }
): {
  /** Ready to pass straight to a list hook. */
  query: BaseQuery
  page: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
} {
  const storageKey = options?.storageKey
  const [pageSize, setPageSize] = useStickyState(
    storageKey && `${storageKey}:size`,
    options?.pageSize ?? DEFAULT_PAGE_SIZE
  )

  // What the current page number is valid *for*. Anything that changes which
  // rows land on which page belongs in here.
  const scope = React.useMemo(
    () => JSON.stringify([pageSize, filter]),
    [pageSize, filter]
  )

  const [paged, setPaged] = useStickyState(
    storageKey && `${storageKey}:page`,
    { scope, page: 1 }
  )
  const page = paged.scope === scope ? paged.page : 1

  const setPage = (next: number) => setPaged({ scope, page: Math.max(1, next) })

  const query = React.useMemo<BaseQuery>(
    () => ({ page, pageSize, filter }),
    [page, pageSize, filter]
  )

  return { query, page, pageSize, setPage, setPageSize }
}
