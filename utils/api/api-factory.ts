import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { BaseEntity, BaseQuery, GetResponse, PaginationMeta } from "@/types/api"
import type { RequestOptions } from "@/types/axios"
import { serializeQuery } from "@/utils/api/api"
import { objectToFormData } from "@/utils/objects"

/**
 * Generates the full CRUD hook set plus a query-key factory for one REST
 * resource. See docs/network-layer.md §6.
 *
 * A feature's api.ts instantiates this once, re-exports the hooks under domain
 * names, and hand-writes only what the factory does not cover.
 */

export type ApiFactoryConfig = {
  /** Root of the query key, e.g. "member". */
  entityName: string
  /** REST path relative to the client's baseURL, e.g. "/member". */
  endpoint: string
  /** Send multipart bodies instead of JSON — set only if the resource uploads files. */
  isFormData?: boolean
  /** For payloads whose keys are already snake_case; double conversion mangles them. */
  disableRequestKeyConversion?: boolean
  /** Passed straight to the response interceptor. See docs/network-layer.md §2. */
  skipResponseKeyConversion?: boolean | Record<string, boolean>
  /** Opt out of PHP method spoofing on multipart updates (see below). */
  disableMethodKeyForPut?: boolean
  /** Convert only the root segment of bracket-notation FormData keys. */
  preserveNestedFormDataKeys?: boolean
}

export type QueryKeyFactory = {
  all: () => readonly unknown[]
  list: (filter?: unknown) => readonly unknown[]
  byId: (id: string | number) => readonly unknown[]
}

/** The default error type: every hook rejects with an Axios error. */
export type ApiError = AxiosError

/**
 * One entity, out of whatever envelope it arrived in.
 *
 * `GET /endpoint/{id}` is *documented* as returning the row directly
 * (docs/api-types.md § Response envelopes) and *observed* returning it wrapped
 * in the same `data` envelope the list endpoints use — the identical split
 * `readFlowNodes` in features/template-flow/api.ts already records for
 * `/template/flow/{id}`, and for the same reason: the envelope is the API's
 * convention and the docs describe the shape somebody expected.
 *
 * Guessing wrong fails **silently**. Handing back `{ data: row }` where a row
 * was promised makes every field read as `undefined`, so nothing throws, no
 * request errors, and the screen just comes up empty — which is how a template
 * opened in the editor with none of its design and none of its metadata.
 *
 * So neither shape is assumed. A wrapper is recognised by what it *lacks*: an
 * envelope carries `data` and none of the entity's own columns, while a row
 * that happens to have its own `data` column still has an `id`. Anything
 * ambiguous is left exactly as it came.
 */
function unwrapEntity<TEntity>(body: unknown): TEntity {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("data" in body) ||
    "id" in body
  ) {
    return body as TEntity
  }

  const inner = (body as { data: unknown }).data
  return inner && typeof inner === "object" && !Array.isArray(inner)
    ? (inner as TEntity)
    : (body as TEntity)
}

type QueryOptions<TData> = Omit<
  UseQueryOptions<TData, ApiError, TData>,
  "queryKey" | "queryFn"
>

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, ApiError, TVariables>,
  "mutationFn"
>

export function createApiFactory<
  TEntity extends BaseEntity,
  TCreateInput extends Record<string, unknown> = Record<string, unknown>,
  TUpdateInput extends Record<string, unknown> = Record<string, unknown>,
>(config: ApiFactoryConfig) {
  const {
    entityName,
    endpoint,
    isFormData = false,
    disableRequestKeyConversion = false,
    skipResponseKeyConversion,
    disableMethodKeyForPut = false,
    preserveNestedFormDataKeys = false,
  } = config

  /** The per-request interceptor overrides this resource always sends. */
  const requestOptions: RequestOptions = {
    skipRequestKeyConversion: disableRequestKeyConversion,
    skipResponseKeyConversion,
    preserveNestedFormDataKeys,
  }

  /**
   * Keys nest, so invalidating `all()` invalidates lists and detail queries
   * alike — and any custom key a feature spreads on top of them.
   */
  const QueryKeys: QueryKeyFactory = {
    all: () => [entityName] as const,
    list: (filter?: unknown) => [...QueryKeys.all(), filter] as const,
    byId: (id: string | number) => [...QueryKeys.all(), id] as const,
  }

  /** Builds the body for a write, honouring `isFormData`. */
  function buildRequestBody(data: Record<string, unknown>) {
    if (!isFormData) {
      return { body: data as unknown, headers: undefined }
    }
    return {
      body: objectToFormData(data),
      headers: { "Content-Type": "multipart/form-data" },
    }
  }

  const useGetList = (
    filter: BaseQuery,
    options?: QueryOptions<GetResponse<TEntity[]>>,
  ) =>
    useQuery({
      // `filter` in the key includes `sort`, so changing sort refetches even
      // though the server is not sent a sort param yet.
      queryKey: QueryKeys.list(filter),
      queryFn: async (): Promise<GetResponse<TEntity[]>> => {
        // Returns the *whole* response: rows end up at `query.data.data.data`.
        return await api.get<{ data: TEntity[]; meta: PaginationMeta }>(endpoint, {
          params: serializeQuery(filter),
          options: requestOptions,
        })
      },
      ...options,
    })

  const useGetById = (
    id: string | number | undefined,
    options?: QueryOptions<TEntity>,
  ) =>
    useQuery({
      queryKey: QueryKeys.byId(id as string | number),
      queryFn: async (): Promise<TEntity> => {
        const response = await api.get<TEntity>(`${endpoint}/${id}`, {
          options: requestOptions,
        })
        return unwrapEntity<TEntity>(response.data)
      },
      // Never fires before an id exists — avoids a `/endpoint/undefined` request.
      enabled: !!id,
      ...options,
    })

  const useCreate = (options?: MutationOptions<TEntity, TCreateInput>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (data: TCreateInput): Promise<TEntity> => {
        const { body, headers } = buildRequestBody(data)
        const response = await api.post<TEntity>(endpoint, body, {
          headers,
          options: requestOptions,
        })
        return unwrapEntity<TEntity>(response.data)
      },
      ...options,
      // Every mutation refreshes the resource, so tables update themselves and
      // callers never invalidate by hand. Any `onSuccess` passed in still runs.
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: QueryKeys.all() })
        options?.onSuccess?.(data, variables, onMutateResult, context)
      },
    })
  }

  const useUpdate = (
    options?: MutationOptions<TEntity, { id: string | number; data: TUpdateInput }>,
  ) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({
        id,
        data,
      }: {
        id: string | number
        data: TUpdateInput
      }): Promise<TEntity> => {
        const { body, headers } = buildRequestBody(data)

        // PHP cannot parse a multipart body on a real PUT, so multipart updates
        // are POSTed with a `_method` override field instead.
        if (isFormData && !disableMethodKeyForPut) {
          ;(body as FormData).append("_method", "PUT")
        }

        const response = isFormData
          ? await api.post<TEntity>(`${endpoint}/${id}`, body, {
              headers,
              options: requestOptions,
            })
          : await api.put<TEntity>(`${endpoint}/${id}`, body, {
              headers,
              options: requestOptions,
            })

        return unwrapEntity<TEntity>(response.data)
      },
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: QueryKeys.all() })
        options?.onSuccess?.(data, variables, onMutateResult, context)
      },
    })
  }

  const useDelete = (options?: MutationOptions<void, string | number>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: string | number): Promise<void> => {
        await api.delete(`${endpoint}/${id}`, { options: requestOptions })
      },
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        queryClient.invalidateQueries({ queryKey: QueryKeys.all() })
        options?.onSuccess?.(data, variables, onMutateResult, context)
      },
    })
  }

  return { QueryKeys, useGetList, useGetById, useCreate, useUpdate, useDelete }
}
