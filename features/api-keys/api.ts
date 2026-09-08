import { createApiFactory } from "@/utils/api/api-factory"
import type { ApiKey, CreateApiKeyInput, UpdateApiKeyInput } from "./types"

/**
 * API keys. See docs/CRUD-MIGRATION-REFERENCE.md §1.2.
 *
 * `entityName` is camelCase here rather than the endpoint's `access_key`,
 * matching the folder — the key prefix is internal to React Query and nothing
 * else invalidates this resource by hand.
 */
const apiKeysApi = createApiFactory<ApiKey, CreateApiKeyInput, UpdateApiKeyInput>({
  entityName: "apiKey",
  endpoint: "/access_key",
})

export const ApiKeyQueryKeys = apiKeysApi.QueryKeys

export const useGetApiKeys = apiKeysApi.useGetList
export const useGetApiKey = apiKeysApi.useGetById
export const useCreateApiKey = apiKeysApi.useCreate
export const useUpdateApiKey = apiKeysApi.useUpdate
export const useDeleteApiKey = apiKeysApi.useDelete
