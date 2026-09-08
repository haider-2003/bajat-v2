import type { Branch } from "@/features/branches/types"
import type { Node } from "@/features/nodes/types"
import type { Organization } from "@/features/organizations/types"
import type { Role } from "@/features/roles/types"
import type { BaseEntity } from "@/types/api"

/**
 * A staff account scoped to one organization. See
 * docs/CRUD-MIGRATION-REFERENCE.md §1.6.
 *
 * The same record `/user` returns, reached through `/organization_user` and
 * carrying two extra grants: the roles that say *what* it may do, and the
 * nodes that say *where* in the workflow it may do it. Both are required —
 * roles with no nodes is an account that can act on nothing.
 */
export type OrganizationUser = BaseEntity & {
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
 * `POST /organization_user`.
 *
 * `type` rides along as a literal because the backend keys the account kind
 * off it; it is not a choice the form offers.
 *
 * `roleIds` — **plural**, unlike `/user`'s `role_id`. See
 * docs/CRUD-MIGRATION-REFERENCE.md §4.5.
 */
export type CreateOrganizationUserInput = {
  name: string
  phone: string
  type: "organization_user"
  /** Admins only; org-scoped accounts let the token decide. */
  organizationId?: number
  roleIds: number[]
  nodeIds: number[]
  isEnabled: 0 | 1
} & Record<string, unknown>

/**
 * `PUT /organization_user/{id}`.
 *
 * No `phone` and no `organizationId`: the number is the login and the
 * organization is the tenant, and neither moves. Both were resent by the app
 * this was ported from — harmless there, but sending a field the endpoint may
 * act on when the form has no control for it is how a hidden value gets
 * written back stale.
 */
export type UpdateOrganizationUserInput = {
  name: string
  roleIds: number[]
  nodeIds: number[]
  isEnabled: 0 | 1
} & Record<string, unknown>
