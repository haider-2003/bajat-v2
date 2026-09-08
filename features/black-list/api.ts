import { createApiFactory } from "@/utils/api/api-factory"
import type { BlackList, CreateBlackListInput } from "./types"

/**
 * Black list. See docs/api-types.md § black-list for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### Three hooks, not five
 *
 * The factory generates `useUpdate` as well; it is deliberately **not**
 * re-exported. `/blacklist` has no `PUT` — entries are added and removed, never
 * edited — and an exported hook reads as a supported one. The same reasoning
 * governs `features/organizations`.
 *
 * ### Not multipart
 *
 * Nothing here uploads a file, so writes go out as JSON and the `_method=PUT`
 * spoof PHP needs for multipart bodies never comes up.
 *
 * ### `entityName` is the wire spelling
 *
 * `"blacklist"`, one word, matching the endpoint rather than the `black-list`
 * folder. It is only a React Query key prefix, but keeping it on the endpoint's
 * spelling is what makes a stray `queryClient.invalidateQueries(["blacklist"])`
 * elsewhere hit this resource instead of quietly missing.
 */
const blackListApi = createApiFactory<BlackList, CreateBlackListInput>({
  entityName: "blacklist",
  endpoint: "/blacklist",
})

export const BlackListQueryKeys = blackListApi.QueryKeys

export const useGetBlackLists = blackListApi.useGetList
export const useGetBlackList = blackListApi.useGetById
export const useCreateBlackList = blackListApi.useCreate
export const useDeleteBlackList = blackListApi.useDelete
