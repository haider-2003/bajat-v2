import type { BaseEntity } from "@/types/api"
import type { Branch, Organization } from "@/features/organizations/types"

/**
 * Permission names are scope-prefixed on the backend — `admin-members-list`,
 * `organization-members-list`. `can()` in the auth store hides that prefix from
 * call sites. See docs/authentication.md §6.
 */
export type Permission = BaseEntity & {
  id: number
  name: string
}

export type Role = BaseEntity & {
  id: number
  name: string
  type: "admin" | "organization" | "branch"
  permissions?: Permission[]
  organization?: Organization
  branch?: Branch
}
