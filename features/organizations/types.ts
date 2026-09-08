import type { BaseEntity } from "@/types/api"

/**
 * The tenant every other entity hangs off. See
 * docs/CRUD-MIGRATION-REFERENCE.md §1.10.
 *
 * ### Two switches that read alike and do not mean alike
 *
 * `isEnabled` turns the whole tenant off — nobody signs in, nothing issues.
 * `isJoinRequestsEnabled` turns off only the *public* join form, leaving staff
 * able to add members by hand. The second is the one that gets used; the first
 * is close to a delete. They are rendered apart on the form for that reason.
 *
 * ### Writes are multipart, because of one field
 *
 * `logo` is a file, so the whole resource is `multipart/form-data` and updates
 * go out as `POST` with `_method=PUT` (docs/network-layer.md §6). The cost is
 * that every scalar travels as a string, which is why the booleans are written
 * as `0` / `1` — `"false"` is a non-empty string and PHP reads it as true.
 */
export type Organization = BaseEntity & {
  id: number
  name: string
  description?: string | null
  /** Absolute URL served by the backend, or null when none was uploaded. */
  logo?: string | null
  website?: string | null
  isEnabled: boolean
  /** Whether the public application form accepts new requests. */
  isJoinRequestsEnabled: boolean
  createdAt?: string
  updatedAt?: string
  /** Decimal degrees as strings, straight from the map picker. */
  lat?: string | null
  lng?: string | null
}

/**
 * `POST /organization`, multipart.
 *
 * ### `undefined` is how a field is left alone
 *
 * `objectToFormData` skips `null` and `undefined` entirely rather than
 * appending them empty (docs/network-layer.md §6). That is what makes an
 * unchanged logo work on update: the key is simply absent, and the backend
 * keeps what it has. Sending `""` instead would clear it.
 */
export type CreateOrganizationInput = {
  name: string
  description?: string
  /** A newly picked file, or `undefined` to leave the stored one in place. */
  logo?: File
  website?: string
  isEnabled: 0 | 1
  isJoinRequestsEnabled: 0 | 1
  lat?: string
  lng?: string
} & Record<string, unknown>

/** `POST /organization/{id}` with `_method=PUT`. Same body. */
export type UpdateOrganizationInput = CreateOrganizationInput
