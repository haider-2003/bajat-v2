import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"

import api from "@/api/client"
import { createApiFactory, type ApiError } from "@/utils/api/api-factory"
import { serializeQuery } from "@/utils/api/api"
import { objectToFormData } from "@/utils/objects"
import type { BaseQuery, GetResponse, PaginationMeta } from "@/types/api"
import type { RequestOptions } from "@/types/axios"

import {
  statusId,
  type ApproveIdInput,
  type ChangeStatusInput,
  type CreateIDCardInput,
  type IDCard,
  type RejectIdInput,
  type StatusName,
  type UpdateIdVarsInput,
} from "./types"

/**
 * IDs (identities). See docs/api-types.md § ids for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * Three settings on the factory, none of them cosmetic:
 *
 *  - **`isFormData`** — the resource uploads files (the applicant's photo, the
 *    approval attachments), so writes are multipart, which is also why updates
 *    POST with `_method=PUT`.
 *  - **`disableRequestKeyConversion`** — a write's keys are already snake_case
 *    and are the template's own variable names besides. Converting them mangles
 *    both: `template_id` would go out as `template_id` → `template_i_d`, and a
 *    variable called `exp_date` would arrive under a name no template knows.
 *  - **`skipResponseKeyConversion: { request: true }`** — the same names coming
 *    back. Everything else on the row is normal camelCase.
 */

/** Skip config, shared by the factory and the hand-written calls below. */
const SKIP: Record<string, boolean> = { request: true }

/** What the hand-written calls pass so they behave like the factory's. */
const REQUEST_OPTIONS: RequestOptions = {
  skipRequestKeyConversion: true,
  skipResponseKeyConversion: SKIP,
}

const idsApi = createApiFactory<IDCard, CreateIDCardInput>({
  entityName: "identity",
  endpoint: "/identity",
  isFormData: true,
  disableRequestKeyConversion: true,
  skipResponseKeyConversion: SKIP,
})

export const IdQueryKeys = idsApi.QueryKeys

export const useGetIds = idsApi.useGetList
export const useGetId = idsApi.useGetById

/**
 * `POST /identity` — issue a card from a template.
 *
 * The factory's create, typed to `CreateIDCardInput`: one multipart body with
 * the template's variables flat at the root (docs/ISSUE-ID-FORM.md §8). The
 * body is assembled by `buildIssuePayload` in ./issue-form.ts rather than at
 * the call site, so the one place that knows the wire shape is next to the
 * one place that knows which variables a design collects.
 *
 * Invalidates every `["identity"]` query, as every factory write does. The
 * *templates* list is stale too after this — `identitiesCount` moved — and
 * the issue sheet invalidates that itself, because the factory only knows its
 * own resource.
 */
export const useCreateId = idsApi.useCreate

/**
 * `DELETE /identity/{id}` — remove a card outright.
 *
 * Offered from the two ledger screens (Requests and ID Flow), never from the
 * printer or delivery queues: a card that has reached a press is stock, and
 * "delete" there would mean something no endpoint does. The factory's
 * invalidation covers both lists and any open detail at once.
 */
export const useDeleteId = idsApi.useDelete

/**
 * ### Documented but not built
 *
 * The factory's `useUpdate` is not exported: `POST /identity/{id}` is the
 * *variable* edit below, which takes a different body from the factory's.
 *
 *  - `useUpdateIdDates` (`PUT /identity/date/{id}`) — rewriting a card's
 *    issue / expiration dates. The reference client declared it and never
 *    called it from a live screen (docs/IDS-FLOW-EXPORTS-ROUTES.md §7), so it
 *    is named here rather than shipped as a hook nothing exercises.
 */

/**
 * `GET /identity/node` — the approval inbox: cards parked at a node the
 * caller is assigned to (docs/IDS-FLOW-EXPORTS-ROUTES.md §3).
 *
 * ### Scoping comes from the token, not a parameter
 *
 * There is no `node_id` to send. The server reads the caller's
 * `node_ids` off the bearer token and returns whatever is sitting at any of
 * them, across every template whose flow contains those nodes. A user with no
 * nodes gets an empty list whatever they filter on.
 *
 * ### Keyed under `["identity", "node", …]`, deliberately
 *
 * Its own key so it never collides with `GET /identity` for the same filter,
 * *and* under the resource's prefix so every write that invalidates
 * `["identity"]` — approve, reject, delete, a status change — refetches this
 * list too. A card that was just approved leaves the inbox on that refetch.
 *
 * Same envelope as the factory's list: the whole Axios response, rows at
 * `data.data.data`.
 */
export function useGetIdsNode(
  filter: BaseQuery,
  options?: Omit<
    UseQueryOptions<GetResponse<IDCard[]>, ApiError, GetResponse<IDCard[]>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: [...IdQueryKeys.all(), "node", filter] as const,
    queryFn: async (): Promise<GetResponse<IDCard[]>> =>
      await api.get<{ data: IDCard[]; meta: PaginationMeta }>("/identity/node", {
        params: serializeQuery(filter),
        options: REQUEST_OPTIONS,
      }),
    ...options,
  })
}

/**
 * `POST /identity/approve` + `_method=PUT` — advance a card to the next node.
 *
 * Multipart, for the attachments; the PHP method override is what lets a
 * browser send one on an update, since a real `PUT` cannot carry a body of
 * files. `objectToFormData` writes `attachments[0]`, `fields[0][key]` and so
 * on, and `null`/`undefined` members are omitted rather than sent as the
 * strings "null" / "undefined" — so an approval with no files and no fields
 * is exactly `identity_id`, `notes`, `_method`.
 */
export function useApproveId() {
  const queryClient = useQueryClient()

  return useMutation<IDCard, ApiError, ApproveIdInput>({
    mutationFn: async (input) => {
      const body = objectToFormData(input)
      body.append("_method", "PUT")
      const response = await api.post<IDCard>("/identity/approve", body, {
        headers: { "Content-Type": "multipart/form-data" },
        options: REQUEST_OPTIONS,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}

/**
 * `PUT /identity/reject` — stop the flow at the current node.
 *
 * Plain JSON: the endpoint takes an id and a note, and nothing else about the
 * request survives the trip (see `RejectIdInput`). What the rejection does to
 * `status` is the server's decision; the client never touches `status` from
 * the flow screens.
 */
export function useRejectId() {
  const queryClient = useQueryClient()

  return useMutation<IDCard, ApiError, RejectIdInput>({
    mutationFn: async (input) => {
      const response = await api.put<IDCard>("/identity/reject", input, {
        options: REQUEST_OPTIONS,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}

/**
 * `POST /identity/{id}` + `_method=PUT` — rewrite one template variable on an
 * issued card (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4c).
 *
 * The factory's update is not used because the body is not the entity: it is
 * the one variable being changed, verbatim under the template's own key, plus
 * `template_id`, `organization_id` and `identity` (the card's numeric id).
 * Keys go out untouched — `disableRequestKeyConversion` on this resource is
 * what keeps a variable called `exp_date` from arriving as something no
 * template knows.
 */
export function useUpdateIdVars() {
  const queryClient = useQueryClient()

  return useMutation<IDCard, ApiError, { id: number | string; data: UpdateIdVarsInput }>({
    mutationFn: async ({ id, data }) => {
      const body = objectToFormData(data)
      body.append("_method", "PUT")
      const response = await api.post<IDCard>(`/identity/${id}`, body, {
        headers: { "Content-Type": "multipart/form-data" },
        options: REQUEST_OPTIONS,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}

/**
 * `PUT /identity/change_status/{id}` — move a card along the workflow.
 *
 * Takes the status **name** and converts. The endpoint wants the number, and
 * a call site holding `4` is a call site nobody can read; worse, `0` is a real
 * status, so a mistyped name that fell through to a default would silently
 * send a card back to `PENDING`. An unknown name throws here instead, before
 * a request goes out.
 */
export function useChangeIdStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: number | string
      status: StatusName
      notes?: string
    }): Promise<IDCard> => {
      const numeric = statusId(status)
      if (numeric < 0) throw new Error(`Unknown identity status: ${status}`)

      const body: ChangeStatusInput = { status: numeric, notes }
      const response = await api.put<IDCard>(
        `/identity/change_status/${id}`,
        body,
        { options: REQUEST_OPTIONS }
      )
      return response.data
    },
    // Every list on the screen is keyed under `identity`, so one invalidation
    // refreshes the queue, its counts and any open detail alike.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IdQueryKeys.all() })
    },
  })
}
