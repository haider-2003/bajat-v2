/**
 * Shared request/response shapes for the network layer.
 *
 * See docs/network-layer.md §5. These describe the *wire contract* after the
 * response interceptor has camelized keys — feature code never sees snake_case.
 */

/** Every resource driven by the API factory is addressable by `id`. */
export type BaseEntity = {
  id: string | number
}

/** One sort instruction. Currently travels in the query key only (see below). */
export type SortQuery = {
  field: string
  order: "asc" | "desc"
}

/**
 * What a filter can hold. Arrays become repeated params (`?statuses[]=a&…`);
 * `0` and `false` are legitimate values, not "unset" — see `buildFilter`.
 */
export type FilterValue = string | number | boolean | string[] | number[]

/** One filter clause. `{ field: "search", value: "ali" }` serializes to `?search=ali`. */
export type FilterQuery = {
  field: string
  value: FilterValue
}

/** The argument every list endpoint takes. */
export type BaseQuery = {
  page: number
  pageSize?: number
  sort?: SortQuery
  filter?: FilterQuery[]
  include?: string
}

/**
 * Pagination envelope the backend wraps every list in.
 *
 * Every field is optional because not every list endpoint sends a `meta` block
 * at all — some return a bare paginator with these keys at the root instead.
 * `readPageInfo` (utils/api/pagination.ts) is what reconciles the two; read
 * page numbers through it rather than off `meta` directly.
 */
export type PaginationMeta = {
  total?: number
  currentPage?: number
  perPage?: number
  lastPage?: number
}

/** The normalized result of `readPageInfo` — any field may be unknown. */
export type PageInfo = {
  total?: number
  currentPage?: number
  /** Rows per page the server actually used, which can differ from the request. */
  perPage?: number
  lastPage?: number
}

/**
 * The paginated response body. Note the double nesting: `useGetList` hands back
 * the whole Axios response, so rows end up at `query.data.data.data`.
 */
export type GetResponse<T> = {
  data: {
    data: T
    /** Absent on endpoints that return a bare paginator — see `PaginationMeta`. */
    meta?: PaginationMeta
  }
}

/** The single-resource envelope, used by `useGetById`. */
export type GetByIdResponse<T> = {
  data: T
}

/** Validation errors come back keyed by field, each holding a list of messages. */
export type ApiErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}
