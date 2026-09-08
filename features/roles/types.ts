import type { BaseEntity } from "@/types/api"
import type { Branch } from "@/features/branches/types"
import type { Organization } from "@/features/organizations/types"

/**
 * The three scopes a role can be cut to. See
 * docs/CRUD-MIGRATION-REFERENCE.md §1.8.
 *
 * One `/role` endpoint serves all three; `type` is what separates an admin
 * role from an organization one, both in the list filter and in which
 * permissions may be attached to it.
 */
export type RoleType = "admin" | "organization" | "branch"

/**
 * Permission names are scope-prefixed on the backend — `admin-members-list`,
 * `organization-members-list`. `can()` in the auth store hides that prefix from
 * call sites. See docs/authentication.md §6.
 */
export type Permission = BaseEntity & {
  id: number
  name: string
  /** Which role type may hold it. The tree is always fetched filtered by this. */
  type: RoleType
  createdAt?: string
  updatedAt?: string
}

export type Role = BaseEntity & {
  id: number
  name: string
  type: RoleType
  createdAt?: string
  updatedAt?: string
  /**
   * **Absent on list rows.** `GET /role` returns the role without its
   * permissions, so the editor re-reads `GET /role/{id}` to pre-check the
   * tree — see docs/CRUD-MIGRATION-REFERENCE.md §1.8. Treating a list row's
   * missing `permissions` as "none" would save an empty role over a full one.
   */
  permissions?: Permission[]
  organization?: Organization
  branch?: Branch
}

/**
 * `POST /role` → `{ name, type, permissions: number[] }`.
 *
 * `permissions` carries **ids**, not names — the checkbox tree renders names
 * and submits the ids behind them. Scoping (`organization_id` / `branch_id`)
 * is derived from the token server-side and deliberately not sent.
 */
export type CreateRoleInput = {
  name: string
  type: RoleType
  permissions: number[]
} & Record<string, unknown>

/** `PUT /role/{id}` — the same body. Changing `type` re-scopes the role. */
export type UpdateRoleInput = CreateRoleInput
