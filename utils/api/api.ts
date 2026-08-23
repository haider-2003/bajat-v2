import type { BaseQuery } from "@/types/api"

/**
 * Query param serialization for list endpoints. See docs/network-layer.md §5.
 *
 * The output is still camelCase — the request interceptor decamelizes params
 * on the way out, so `perPage` would become `per_page` anyway. `pageSize` is
 * mapped explicitly because the API name differs, not just the casing.
 */
export const serializeQuery = (query: BaseQuery) => {
  const params: Record<string, string | number | boolean | string[] | number[]> =
    {}

  if (query.page) params["page"] = query.page
  if (query.pageSize) params["per_page"] = query.pageSize
  if (query.include) params["include"] = query.include

  // Sorting is not sent yet — the backend has no contract for it. `sort` still
  // travels in the React Query key, so changing it busts the cache.
  // if (query.sort) {
  //   params["sort"] = query.sort.field
  //   params["order"] = query.sort.order
  // }

  if (query.filter) {
    // { field: "search", value: "ali" } → ?search=ali
    for (const clause of query.filter) {
      params[clause.field] = clause.value
    }
  }

  return params
}
