import type { Organization } from "@/features/organizations/types"

/**
 * Member requests — a pending application to join an organization.
 * Approving one produces a `Member`. See docs/api-types.md § members-requests.
 *
 * Shapes are camelCase because that is what the code sees; the wire format is
 * snake_case and the interceptors convert both ways.
 */

/**
 * One field definition from an organization's join form.
 *
 * The PascalCase keys are intentional — the backend stores these verbatim, so
 * they are not "fixed" to camelCase anywhere in the stack.
 */
export type ApplicationFormInputType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "image"
  | "file"

export interface ApplicationFormInput {
  InputName: string
  InputLabel: string
  InputType: ApplicationFormInputType
  InputRequired: boolean
  /** Present for `select`. */
  Options?: string[]
}

/** A join-form field plus the answer the applicant gave. */
export interface JoinDataInput extends ApplicationFormInput {
  /** Array when the field is multi-select. */
  InputValue?: string | string[]
}

export type MemberStatus = "pending" | "rejected" | "approved"

/**
 * docs/api-types.md documents `phone`, `name` and the timestamps as required
 * strings. Live rows disagree — they come back null when the applicant never
 * supplied one — so they are widened here and every consumer handles the gap.
 * The doc says the code wins; this is the code.
 */
export type MemberRequest = {
  id: number
  phone: string | null
  name: string | null
  createdAt: string | null
  updatedAt: string | null
  /** Image URL, absent when the applicant uploaded none. */
  avatar?: string
  joinDate?: string | null
  joinData?: JoinDataInput[]
  status: MemberStatus
  /** Documented as always present; guard anyway, like the fields above. */
  organization: Organization | null
  /** Set once the request is approved and a member record exists. */
  memberId?: number | string | null
  attachment?: string | null
  /** Rejection reason. */
  note?: string | null
}

/** `organizationId` is a string here but a number in the members feature. */
export type CreateMembersInput = {
  phone: string
  name: string
  organizationId?: string
  joinData?: JoinDataInput[]
} & Record<string, unknown>

export type UpdateMembersInput = {
  name: string
} & Record<string, unknown>

export type ChangeMemberStatusInput = {
  status: MemberStatus
  note?: string
}
