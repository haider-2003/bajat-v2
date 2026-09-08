import type { Node } from "@/features/nodes/types"
import type { Organization } from "@/features/organizations/types"
import type { BaseEntity } from "@/types/api"

/**
 * A branch — one office in an organization's tree. See
 * docs/CRUD-MIGRATION-REFERENCE.md §1.4.
 *
 * ### Every relation arrives twice
 *
 * The row carries both the scalar (`parentId`, `organizationId`, `nodeIds`)
 * and, depending on the endpoint, the expanded object (`parent`,
 * `organization`, `nodes`). Neither is guaranteed — a list row may have the
 * ids and no objects, a detail read the reverse — so read through the helpers
 * below rather than off either field directly. Picking one and trusting it is
 * how a branch loses its parent on save: the form reads `parentId`, gets
 * `undefined` from a response that only sent `parent`, and submits a detach.
 *
 * ### `nodeIds` is what the branch is *for*
 *
 * A branch handles a subset of the organization's workflow nodes. It is
 * required on create — a branch that handles nothing cannot be routed work.
 */
export type Branch = BaseEntity & {
  id: number
  name: string
  /** `undefined`/`null` at the top of the tree. Nullable is "no parent". */
  parentId?: number | null
  organizationId?: number
  nodeIds?: number[]
  isEnabled: boolean
  createdAt?: string
  updatedAt?: string
  /** Decimal degrees as strings, straight from the map picker. */
  lat?: string | null
  lng?: string | null
  organization?: Organization
  parent?: Branch
  nodes?: Node[]
}

/** The branch's parent id, from whichever half of the response carries it. */
export function branchParentId(branch: Branch): number | null {
  return branch.parentId ?? branch.parent?.id ?? null
}

/** The branch's organization id, from whichever half carries it. */
export function branchOrganizationId(branch: Branch): number | undefined {
  return branch.organizationId ?? branch.organization?.id
}

/** The branch's node ids, from whichever half carries them. */
export function branchNodeIds(branch: Branch): number[] {
  return branch.nodeIds ?? branch.nodes?.map((node) => node.id) ?? []
}

/**
 * `POST /branch`.
 *
 * `parentId` is **omitted** when there is no parent; on update it is sent as
 * an explicit `null` instead — see `UpdateBranchInput`.
 */
export type CreateBranchInput = {
  name: string
  parentId?: number
  /** Admins only; org-scoped accounts let the token decide. */
  organizationId?: number
  nodeIds: number[]
  isEnabled: 0 | 1
  lat?: string
  lng?: string
} & Record<string, unknown>

/**
 * `PUT /branch/{id}`.
 *
 * ### `parentId: null` is the whole point
 *
 * Omitting the key leaves the existing parent in place; sending `null`
 * detaches the branch and moves it to the top of the tree. That is the only
 * way to detach one, so the update type makes the null explicit rather than
 * optional — `parentId?: number` would make "no parent chosen" and "detach"
 * the same value and quietly drop the operation.
 *
 * `organizationId` is absent: a branch does not change tenant.
 */
export type UpdateBranchInput = {
  name: string
  parentId: number | null
  nodeIds: number[]
  isEnabled: 0 | 1
  lat?: string
  lng?: string
} & Record<string, unknown>
