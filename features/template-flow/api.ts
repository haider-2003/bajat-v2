import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { Node } from "@/features/nodes/types"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  CreateTemplateFlowInput,
  TemplateFlow,
  TemplateFlowRow,
  UpdateTemplateFlowInput,
} from "./types"

/**
 * Template approval flows. See docs/CRUD-MIGRATION-REFERENCE.md §1.18 and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### The write goes through the factory; the read cannot
 *
 * `POST /template/flow` is an ordinary create, so `useCreate` covers it.
 * `GET /template/flow/{templateId}` is not an ordinary read: the id in the
 * path is the **template's**, not this resource's, and the body is a flat
 * array of join rows rather than one entity. The factory's `useGetById`
 * would hand that array back untouched and every caller would have to know
 * how to unpack it — so the unpacking lives here, once, and the hook returns
 * the thing callers actually want: the nodes, in order.
 *
 * ### Which means the cache key is the template id
 *
 * `useCreate` invalidates `["template-flow"]` wholesale, so a save refreshes
 * the flow it just replaced without the caller naming it. The read below
 * uses the factory's own key shape so it is caught by that invalidation.
 */
const templateFlowApi = createApiFactory<
  { id: string | number },
  CreateTemplateFlowInput,
  UpdateTemplateFlowInput
>({
  entityName: "template-flow",
  endpoint: "/template/flow",
})

export const TemplateFlowQueryKeys = templateFlowApi.QueryKeys

/** `POST /template/flow`. Replaces the chain outright; there is no PUT. */
export const useSaveTemplateFlow = templateFlowApi.useCreate

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object"
}

/** A node arrives either wrapped in a join row or, defensively, on its own. */
function nodeOf(entry: unknown): Node | null {
  if (!isRecord(entry)) return null
  const wrapped = (entry as Partial<TemplateFlowRow>).node
  if (isRecord(wrapped) && typeof wrapped.id === "number") return wrapped as Node
  // A bare node — the shape the docs promised. Accepted so a backend that
  // ever starts sending it does not blank the canvas again.
  if (typeof entry.id === "number" && typeof entry.name === "string") {
    return entry as unknown as Node
  }
  return null
}

/**
 * The chain, in order, out of whatever this endpoint returned.
 *
 * Deliberately forgiving about the envelope. This response has already been
 * documented as one shape and observed as another, and the failure mode when
 * the reader guesses wrong is silent — an empty array reads as "this template
 * has no flow", which is a legitimate state, so nothing errors and the canvas
 * simply comes up blank. Accepting a bare array, a `data` envelope and the
 * documented `nodes` key costs three lines and removes that whole class of
 * bug.
 *
 * Exported so the shape can be tested and so anything else reading this
 * endpoint unpacks it the same way.
 */
export function readFlowNodes(body: unknown): Node[] {
  const rows: unknown[] = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.data)
      ? body.data
      : isRecord(body) && Array.isArray(body.nodes)
        ? body.nodes
        : []

  return rows
    .map((entry, index) => ({
      node: nodeOf(entry),
      // `sort` is the server's ordering. Position in the array is the
      // tie-break, so a response that omits `sort` entirely still comes back
      // in the order it was sent rather than in an arbitrary one.
      sort: isRecord(entry) && typeof entry.sort === "number" ? entry.sort : index,
      index,
    }))
    .filter((row): row is { node: Node; sort: number; index: number } => !!row.node)
    .sort((a, b) => a.sort - b.sort || a.index - b.index)
    .map((row) => row.node)
}

/**
 * `GET /template/flow/{templateId}` → the chain, in order.
 *
 * The id is the **template's**. `useGetTemplateFlow(7)` fetching template 7's
 * flow is only obvious once you know, which is why this is not just
 * `useGetById` under a different name.
 */
export function useGetTemplateFlow(
  templateId: number | undefined,
  options?: Omit<
    UseQueryOptions<Node[], AxiosError, Node[]>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: TemplateFlowQueryKeys.byId(templateId as number),
    queryFn: async (): Promise<Node[]> => {
      const response = await api.get<TemplateFlow>(`/template/flow/${templateId}`)
      return readFlowNodes(response.data)
    },
    enabled: !!templateId,
    ...options,
  })
}
