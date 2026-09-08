import type { Organization } from "@/features/organizations/types"
import type { User } from "@/features/users/types"
import type { BaseEntity } from "@/types/api"

/**
 * A machine credential — what a kiosk or an integration presents instead of a
 * phone number and an OTP. See docs/CRUD-MIGRATION-REFERENCE.md §1.2.
 *
 * ### `key` is read-only, and the row is the only copy
 *
 * The server generates the secret and binds it to the caller's organization
 * and user; nothing in this app can set or rotate it. Renaming a key does not
 * change it, and deleting a key is the only revocation — which is why the
 * delete confirmation on this screen names the integrations that will stop
 * working rather than just asking twice.
 *
 * Unusually for a secret, the list endpoint returns it in full on every row.
 * That is the backend's contract, not a choice this client can make, so the UI
 * masks it by default and reveals on demand.
 */
export type ApiKey = BaseEntity & {
  id: number
  name: string
  /** The secret itself. Never sent back on a write — the server owns it. */
  key: string
  createdAt: string
  updatedAt: string
  /** Assigned server-side from the token, not chosen in the form. */
  organization?: Organization
  /** Who created it. Expanded on reads. */
  user?: User
}

/**
 * `POST /access_key` → `{ name }`.
 *
 * One field, and that is the whole contract. The organization and the user are
 * derived from the token — sending an `organization_id` here does not move the
 * key, it is simply ignored.
 */
export type CreateApiKeyInput = {
  name: string
} & Record<string, unknown>

/** `PUT /access_key/{id}` → `{ name }`. Renaming is the only edit. */
export type UpdateApiKeyInput = {
  name: string
} & Record<string, unknown>
