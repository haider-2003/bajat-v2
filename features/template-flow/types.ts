import type { Node } from "@/features/nodes/types"

/**
 * The approval chain one template routes its identities through — see
 * docs/CRUD-MIGRATION-REFERENCE.md §1.18.
 *
 * ### The read and the write are different shapes, and the docs had it wrong
 *
 * `docs/api-types.md` describes the read as `{ id, templateId, nodes: Node[] }`.
 * The live endpoint returns something else: a **flat array of join rows**,
 * each one a record of "this node, at this position in this template's flow":
 *
 * ```json
 * [{ "id": 52, "node": { "id": 22, "name": "…", "color": "#000000" },
 *    "sort": 0, "created_at": "…", "updated_at": "…" }]
 * ```
 *
 * Reading `.nodes` off that gets `undefined`, which is a flow with no steps —
 * so a template with a perfectly good chain rendered as an empty canvas. The
 * builder now reads through `readFlowNodes` (./api.ts) rather than off the
 * body, and anything that touches this endpoint should do the same.
 *
 * The write is still `{ template_id, node_ids: [...] }`, verified against
 * `docs/identities-api.postman_collection.json` → *Template flow / Set flow
 * for template*. The two directions genuinely disagree; that is the API's
 * shape, not a mistake here.
 */

/** One row of the join table: a node, and where it sits in the chain. */
export type TemplateFlowRow = {
  /** The row's own id — **not** the node's, and not the template's. */
  id: number
  node: Node
  /** Position in the chain, ascending. Ties fall back to array order. */
  sort?: number
  createdAt?: string
  updatedAt?: string
}

/** What `GET /template/flow/{templateId}` actually resolves to. */
export type TemplateFlow = TemplateFlowRow[]

/**
 * `POST /template/flow` → `{ template_id, node_ids }`.
 *
 * `nodeIds` carries the order. An id may legitimately repeat — the backend
 * takes the array as given — though a chain that visits the same step twice
 * is a workflow question, not a transport one.
 */
export type CreateTemplateFlowInput = {
  templateId: number
  nodeIds: number[]
} & Record<string, unknown>

/**
 * Identical to create, because the only way to update is to re-create.
 *
 * There is no `PUT` or `DELETE` on this resource in the collection at all —
 * posting a flow for a template that already has one replaces it outright,
 * which is why the builder sends the whole chain on every save.
 */
export type UpdateTemplateFlowInput = CreateTemplateFlowInput
