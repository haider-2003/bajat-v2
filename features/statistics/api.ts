import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { DashboardStatistics } from "./types"

/**
 * Dashboard statistics. See docs/network-layer.md §7 for the module
 * convention, and `./types.ts` for why every field is optional.
 *
 * ### Not from the factory
 *
 * `createApiFactory` generates a CRUD set around a paginated collection.
 * `/statistics` is a single read of one singleton object — no id, no page, no
 * writes — so the factory's hooks would all be wrong and only `useGetList`
 * would be close. It is a handful of lines by hand and honest about what the
 * endpoint is.
 */

export const StatisticsQueryKeys = {
  all: () => ["statistics"] as const,
}

/**
 * One envelope check, for the same reason `unwrapEntity` exists in the
 * factory: this API returns some payloads bare and some wrapped in `data`,
 * and guessing wrong fails silently — every total reads `undefined`, nothing
 * throws, and the landing page comes up full of zeroes.
 *
 * A wrapper is recognised by what it *lacks*: it carries `data` and none of
 * the statistics' own keys.
 */
function unwrapStatistics(body: unknown): DashboardStatistics {
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "data" in body &&
    !("totalIdentities" in body)
  ) {
    return ((body as { data?: DashboardStatistics }).data ?? {}) as DashboardStatistics
  }
  return (body ?? {}) as DashboardStatistics
}

/**
 * `GET /statistics` → the overview payload.
 *
 * `staleTime` is a minute: these are counts across a whole tenant, nobody
 * expects them to the second, and the screen is the app's landing page — it is
 * re-entered constantly by users navigating back from a list, and refetching
 * on every one of those would be pure noise.
 */
export function useGetStatistics(
  options?: Omit<
    UseQueryOptions<DashboardStatistics, AxiosError, DashboardStatistics>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: StatisticsQueryKeys.all(),
    queryFn: async (): Promise<DashboardStatistics> => {
      const response = await api.get<unknown>("/statistics")
      return unwrapStatistics(response.data)
    },
    staleTime: 60_000,
    ...options,
  })
}
