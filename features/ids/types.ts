import type { Organization } from "@/features/organizations/types"
import type { Template } from "@/features/templates/types"
import type { User } from "@/features/users/types"
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

/**
 * The approval stage a card is parked at — the `node` on `GET /identity/node`
 * rows (docs/IDS-FLOW-EXPORTS-ROUTES.md §3.2).
 *
 * Not a full `Node`: the row carries the name and, when the backend sends it,
 * the colour — nothing about the organization that owns the step. The
 * reference client read `node.name` through an untyped accessor (spec §9.1);
 * this names the shape so a column can be typed against it.
 */
export type IdentityNode = {
  id?: number
  name: string
  color?: string | null
}

/**
 * One approval a card has been through — `IDCard.nodeHistory[]`, in the order
 * they happened (docs/IDS-FLOW-EXPORTS-ROUTES.md §3.4).
 *
 * The record does **not** say which node it was taken at: only its position
 * in the array and `createdAt` order it against the template's flow. The last
 * entry is the latest.
 */
export type NodeHistory = BaseEntity & {
  id: number
  /** URLs of the files uploaded at that stage. */
  attachments?: string[] | null
  /** Ad-hoc key/values captured at that stage. */
  fields?: { key: string; value: string }[] | null
  createdAt?: string | null
  /** Who processed it. */
  user?: User | null
  notes?: string | null
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
  /** The current approval stage. Sent on `/identity/node` rows; absent elsewhere. */
  node?: IdentityNode | null
  /** The approval trail. Sent on `GET /identity/{id}`; absent from list rows. */
  nodeHistory?: NodeHistory[] | null
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

/**
 * `POST /identity` — issue a card. See docs/ISSUE-ID-FORM.md §8.
 *
 * One flat multipart body: the four fixed fields, then **one root-level key
 * per template variable**, named exactly as the template's `vars[]` names it.
 * The factory sends keys verbatim (`disableRequestKeyConversion`), which is
 * what lets `employee_no` and a transliterated Arabic key reach the server
 * unrenamed — and what makes the mixed casing below deliberate rather than
 * careless: `template_id` and `organization_id` are snake, `branchId` is
 * camel, and the server reads each of them spelled exactly like that.
 *
 * `identity` is the literal `"by system"` — the marker for a dashboard-issued
 * card, as opposed to the public self-service form.
 *
 * Values follow `objectToFormData` (utils/objects.ts): a `File` becomes a
 * binary part, a string or number is sent as text, and `null` **omits the
 * key** — which the renderer treats differently from an empty string (an
 * absent key leaves the `{placeholder}` on the card, `""` prints blank).
 */
export type CreateIDCardInput = {
  identity: "by system"
  name: string
  /** `964` + ten digits — see `toApiPhone` in utils/format.ts. */
  phone: string
  template_id: number
  organization_id?: number
  branchId?: number
} & Record<string, string | number | File | null | undefined>

/**
 * `POST /identity/approve` + `_method=PUT` — advance a card to the next node
 * of its template's flow (docs/IDS-FLOW-EXPORTS-ROUTES.md §3.5).
 *
 * Multipart, because `attachments` are files. `objectToFormData` spreads the
 * arrays into PHP's bracket notation — `attachments[0]`, `fields[0][key]`,
 * `fields[0][value]` — which is exactly what the endpoint reads. The keys are
 * already snake_case, so request key conversion is skipped for this call.
 *
 * The client never names the *target* node: the server walks the stored
 * `template_id → node_ids[]` order itself.
 */
export type ApproveIdInput = {
  identity_id: string
  notes: string
  attachments?: File[]
  fields?: { key: string; value: string }[]
}

/**
 * `PUT /identity/reject` — stop the flow at the current node.
 *
 * JSON, not multipart, which is why there are no attachments here: the
 * reference client sent its `File` objects through `JSON.stringify` and
 * uploaded their metadata (spec §9.2). Typing them out is the honest version
 * of that — only the note reaches the server on a rejection.
 */
export type RejectIdInput = {
  identity_id: string
  notes: string
}

/**
 * `POST /identity/{id}` + `_method=PUT` — rewrite one template variable on an
 * issued card (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4c).
 *
 * The variable travels at the root under its own key, verbatim, beside the
 * three fixed fields. `identity` here is the card's **numeric id** — not the
 * `"by system"` literal `CreateIDCardInput` sends (spec §9.17).
 */
export type UpdateIdVarsInput = {
  template_id: number
  organization_id?: number
  identity: number
} & Record<string, string | number | File | null | undefined>
