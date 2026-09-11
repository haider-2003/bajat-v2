import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type { RequestOptions } from "@/types/axios"

import {
  statusId,
  type ChangeStatusInput,
  type CreateIDCardInput,
  type IDCard,
  type StatusName,
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
 * ### Documented but not built
 *
 * The factory generates update / delete for this resource too, and they are
 * not exported: an exported hook reads as a supported one. Deleting a card is
 * not something a queue screen should offer, and updating one is the
 * `useUpdateIdVars` / `useUpdateIdDates` pair below, which take different
 * paths from the factory's `POST /identity/{id}`.
 *
 * Hand-written and still missing, for the same reason — no screen calls them:
 *
 *  - `useGetIdsNode` (`GET /identity/node`) — the approval-node inbox.
 *  - `useApproveId` / `useRejectId` — the approval workflow, which needs
 *    attachments and a node history view to be worth anything.
 *  - `useUpdateIdVars` / `useUpdateIdDates` — editing an issued card.
 */

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
