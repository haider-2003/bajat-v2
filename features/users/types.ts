import type { BaseEntity } from "@/types/api"
import type { Organization } from "@/features/organizations/types"
import type { Role } from "@/features/roles/types"

/**
 * A dashboard account. See docs/CRUD-MIGRATION-REFERENCE.md §1.7.
 *
 * The same shape backs three tables — platform admins (`/user`), organization
 * users (`/organization_user`) and branch users (`/branch_user`) — because the
 * backend returns one user record with a `type` on it. What differs between
 * them is which endpoint owns the row and which extra scoping fields it
 * carries, not the fields themselves.
 *
 * This is also the shape the auth store persists, so `roles[].permissions[]`
 * is what every `can()` check reads.
 */
export type User = BaseEntity & {
  id: number
  name: string
  /** Wire form: `964` plus ten local digits. */
  phone: string
  type: "admin" | "organization_user" | "branch_user"
  /** Whether the user has already enrolled an authenticator app. */
  tfaEnabled: boolean
  isEnabled: boolean
  email?: string
  createdAt?: string
  updatedAt?: string
  organization?: Organization
  roles?: Role[]
}

/**
 * `POST /user` → `{ name, phone, role_id: number[], is_enabled: 0|1 }`.
 *
 * ### `roleId`, singular, holding an array
 *
 * This endpoint alone spells the field `role_id` while still taking a list —
 * organization and branch users use `role_ids`. It is the API's own
 * inconsistency (docs/identities-api.postman_collection.json § Users), not a
 * typo to normalise: sending `role_ids` here is a parameter `/user` does not
 * read, so the user is created with no roles and no error.
 *
 * ### `isEnabled` is a number
 *
 * Read back as a boolean, written as `0` / `1`. See
 * docs/CRUD-MIGRATION-REFERENCE.md §3.4 — the asymmetry is the backend's.
 */
export type CreateUserInput = {
  name: string
  phone: string
  roleId: number[]
  isEnabled: 0 | 1
} & Record<string, unknown>

/**
 * `PUT /user/{id}` → `{ name, role_id, is_enabled }`.
 *
 * **No `phone`.** It is the account's identity — it is what an OTP is sent to
 * — and the endpoint does not accept a change to it. Moving an account to a
 * new number means creating the new one and deleting the old, which is honest:
 * the two are different logins.
 */
export type UpdateUserInput = {
  name: string
  roleId: number[]
  isEnabled: 0 | 1
} & Record<string, unknown>
