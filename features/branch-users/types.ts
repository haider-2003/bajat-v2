import type { Branch } from "@/features/branches/types"
import type { Node } from "@/features/nodes/types"
import type { Organization } from "@/features/organizations/types"
import type { Role } from "@/features/roles/types"
import type { BaseEntity } from "@/types/api"

/**
 * A staff account scoped to one branch. See
 * docs/CRUD-MIGRATION-REFERENCE.md §1.5.
 *
 * Structurally an organization user with a `branchId` on it — and that one
 * field is the whole difference: an organization user sees the tenant, a
 * branch user sees one office of it.
 */
export type BranchUser = BaseEntity & {
  id: number
  name: string
  phone: string
  type: string
  isEnabled: boolean
  tfaEnabled?: boolean
  createdAt?: string
  updatedAt?: string
  roles?: Role[]
  organization?: Organization
  branch?: Branch
  nodes?: Node[]
}

/**
 * `POST /branch_user`.
 *
 * `branchId` is required. The branch must belong to the chosen organization,
 * which is why the branch picker is fetched filtered by it rather than listing
 * every branch on the platform.
 */
export type CreateBranchUserInput = {
  name: string
  phone: string
  type: "branch_user"
  organizationId?: number
  branchId: number
  roleIds: number[]
  nodeIds: number[]
  isEnabled: 0 | 1
} & Record<string, unknown>

/**
 * `PUT /branch_user/{id}`.
 *
 * `branchId` is absent alongside `phone` and `organizationId`: moving an
 * account between branches would carry its node grants across into a branch
 * that may not handle those nodes. Delete and recreate is the honest path.
 */
export type UpdateBranchUserInput = {
  name: string
  roleIds: number[]
  nodeIds: number[]
  isEnabled: 0 | 1
} & Record<string, unknown>
