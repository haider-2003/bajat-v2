import type { Organization } from "@/features/organizations/types"

/**
 * Members — a person who can receive ID cards. See docs/api-types.md § members.
 *
 * Approving a `MemberRequest` produces one of these, so the two shapes are
 * close relatives. They are **not** interchangeable, and the differences are
 * the kind that compile cleanly and fail at runtime:
 *
 *  - `organizations` here is an **array** (many-to-many). A member request
 *    carries a single `organization`.
 *  - the write inputs take `organizationIds`, an **array of strings** — the
 *    endpoint validates `organization_ids` and rejects a singular
 *    `organization_id` as a missing field. A member request carries a single
 *    `organizationId`, and that one *is* a string too.
 *  - There is no `status`. A member exists because a request was approved;
 *    there is no pending or rejected member.
 *
 * The input type names collide with `features/members-requests` too — import
 * them explicitly rather than by memory (docs/api-types.md § members-requests,
 * gotcha 2).
 *
 * Shapes are camelCase because that is what the code sees; the wire format is
 * snake_case and the interceptors convert both ways.
 */
export type Member = {
  id: number
  phone: string
  name: string
  createdAt: string
  updatedAt: string
  /** Image URL, absent when the member has no photo. */
  avatar?: string
  joinDate?: string | null
  /** Plural, and documented as always present — many-to-many. */
  organizations: Organization[]
}

/**
 * `organizationIds` is **plural and an array** — the interceptor decamelizes it
 * to `organization_ids`, which is the only spelling the endpoint accepts. A
 * singular `organization_id` comes back as *"The organization ids field is
 * required."* Members-requests takes a singular `organizationId` instead.
 */
export type CreateMembersInput = {
  phone: string
  name: string
  organizationIds?: string[]
} & Record<string, unknown>

/** `name` is required on update even when only the phone is changing. */
export type UpdateMembersInput = {
  phone?: string
  name: string
  organizationIds?: string[]
} & Record<string, unknown>

/**
 * The bulk Excel import.
 *
 * `organization_id` is snake_case in this one input — the endpoint reads it
 * verbatim, so the usual camelCase-and-let-the-interceptor-convert rule does
 * not apply here.
 */
export type UploadMembersInput = {
  file: File
  organization_id?: number
} & Record<string, unknown>
