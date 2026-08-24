import type { Organization } from "@/features/organizations/types"
import type { Template } from "@/features/templates/types"
import type { BaseEntity } from "@/types/api"

/**
 * IDs (identities) — the issued ID card, and the system's central entity.
 * See docs/api-types.md § ids.
 *
 * ### The status is a name coming back and a number going out
 *
 * `GET` hands you `"WAITING_TO_PRINT"`. `PUT /identity/change_status/{id}`
 * wants `4`. Nothing in the stack converts between them, so both directions go
 * through `STATUS_NAMES` below — index *is* the id, which is the whole reason
 * the array is ordered rather than a map.
 *
 * ### `request` is the one field that keeps its own key casing
 *
 * Its keys are template variable names — `exp_date`, `:full_name`,
 * `lmsm~_lwzyfy` — authored in the template editor and stored verbatim. The
 * feature's api.ts skips them on the way back so a lookup by the name the
 * template defined still finds the value; camelizing would quietly rename
 * every one of them. The same goes out: request key conversion is disabled for
 * this endpoint, so a write sends `template_id`, not `templateId`.
 *
 * ### What the doc says versus what `GET /identity` sends
 *
 * The doc types `name`, `phone` and `nodeHistory` as always present on the
 * entity. List rows carry none of them — the person's name is in `member` and
 * again inside `request`, under whichever variable the template happened to
 * call it. So they are optional here and `identityName` / `identityPhone`
 * (fields.ts) are how a screen reads them. Same precedent as
 * features/members-requests/types.ts: the doc describes the contract, the code
 * describes the rows.
 */

/**
 * Every status, **in id order** — the index is the number the API takes.
 *
 * `PENDING` is 0, so `statusId` returning `-1` for an unknown name is the only
 * safe sentinel: `0` is a real status a mistyped name would silently become.
 */
export const STATUS_NAMES = [
  "PENDING",
  "PAID",
  "APPROVED",
  "REJECTED",
  "WAITING_TO_PRINT",
  "PRINTING",
  "PRINTED",
  "DELIVERY_IN_PROGRESS",
  "DELIVERED",
  "RETURNED",
] as const

export type StatusName = (typeof STATUS_NAMES)[number]

/** The numeric id a write must send, or `-1` for a name the API doesn't have. */
export function statusId(name: StatusName | string): number {
  return STATUS_NAMES.indexOf(name as StatusName)
}

/**
 * The person the card was issued to, as embedded in an identity row.
 *
 * Not `features/members`' `Member`: that one requires `organizations`, and the
 * copy embedded here has no relations on it at all. Typing this as a `Member`
 * would compile and then read `.organizations.length` off undefined.
 */
export type IdentityMember = BaseEntity & {
  id: number
  name: string | null
  phone: string | null
  avatar?: string | null
  joinDate?: string | null
  isBlocked?: number
}

/**
 * Who created the card — polymorphic, so `type` is what says which.
 *
 * `"admin"` for a dashboard user, and the card was entered on someone's
 * behalf; `null` when it came in through the public self-service link.
 */
export type IdentityCreator = BaseEntity & {
  id: number
  name: string | null
  phone: string | null
  type?: string | null
}

export type IDCard = BaseEntity & {
  id: number
  /** The QR verification key. Stable, and what a scanner resolves. */
  uniqueKey: string
  status: StatusName
  /** `"INTERNAL"` for a dashboard-issued card, versus the public form. */
  source?: string | null
  type?: string | null
  /** The rendered card. `null` until the backend has generated the artwork. */
  frontImage: string | null
  /** Also `null` on a single-sided template, which is not the same as pending. */
  backImage: string | null
  /** Template variable values. Keys are verbatim — see the note above. */
  request?: Record<string, unknown> | null
  createdAt: string | null
  updatedAt: string | null
  /** Documented as required; absent from list rows. Read through `identityName`. */
  name?: string | null
  phone?: string | null
  templateId?: number
  template?: Template | null
  member?: IdentityMember | null
  organization?: Organization | null
  creatable?: IdentityCreator | null
}

/**
 * `PUT /identity/change_status/{id}`.
 *
 * `status` is the **number**, and `notes` is plural — the members-requests
 * equivalent calls the same idea `note`.
 */
export type ChangeStatusInput = {
  status: number
  notes?: string
}
