import type { Organization } from "@/features/organizations/types"
import type { BaseEntity } from "@/types/api"

/**
 * Templates — the ID card design plus its issuance metadata.
 * See docs/api-types.md § templates.
 *
 * A template is two things welded into one record: a **design document**
 * (`template`, authored by the photo editor, documented in
 * docs/photo-editor-spec.md §19) and the **issuance terms** an identity is cut
 * from — what it costs, how long it stays valid, whether a branch has to be
 * named. Every screen that shows an issued card shows something off the second
 * half; only the editor touches the first.
 *
 * ### Almost everything is optional, and that is not laziness
 *
 * An `IDCard` arrives with its template embedded, and that embedded copy is
 * thinner than the one `/template` returns — the printer queue gets a `title`
 * and a `frontImage` and nothing else. The same type describes both, so a field
 * the list endpoint always sends is still `?` here. Read through the helpers in
 * ./display.ts rather than off the row, and a thin copy renders as a dash
 * instead of throwing.
 */
export type Template = BaseEntity & {
  id: number
  title: string
  description?: string | null
  /** A **string**, not a number — see docs/api-types.md § cross-feature gotchas. */
  price?: string | null
  /** The rendered artwork, i.e. the blank card before a person is printed onto it. */
  frontImage?: string | null
  backImage?: string | null
  /** Months the issued card stays valid. **`0` means it never expires.** */
  identityDuration?: number | null
  /**
   * A number on the entity, a **string** on input. Not a boolean in either
   * direction (docs/api-types.md § cross-feature gotchas, trap 7).
   */
  isEnabled?: number
  /** Whether issuing from this template forces the operator to name a branch. */
  branchRequired?: boolean
  /** How many identities have been cut from this design. */
  identitiesCount?: number
  /** Key for the public self-service link — `/public/v1/template/{shareKey}`. */
  shareKey?: string | null
  /** The design document. Opaque here; only the photo editor reads its shape. */
  template?: Record<string, unknown> | null
  organization?: Organization | null
  /** ISO 8601 strings, never `Date` objects. Absent on an embedded copy. */
  createdAt?: string | null
  updatedAt?: string | null
}

/** A queued CSV export of one template's identities — `GET /export`. */
export type TemplateExport = BaseEntity & {
  id: number
  status: string
  /** Download URL, present once the export finishes. */
  file?: string | null
  createdAt?: string
  updatedAt?: string
  template?: Template | null
  organization?: Organization | null
}

/**
 * `POST /template`. Every field is required — this is the editor's save
 * payload, not a patch, and the two casing traps in it are load-bearing:
 * `price` is a string, and `isEnabled` is a string here where the entity
 * returns a number.
 */
export type CreateTemplateInput = {
  title: string
  description: string
  price: string
  template: Record<string, unknown>
  frontImage?: string
  backImage?: string
  /** `"1"` / `"0"`. A boolean is rejected. */
  isEnabled: string
  branchRequired: boolean
  /** Months. `0` means the identity never expires. */
  identityDuration: number
}

/**
 * `PUT /template/{id}` takes the identical shape — there is no partial update.
 *
 * Which is why nothing outside the editor writes one: a PUT assembled from a
 * list row would send back whatever `template` that row happened to carry, and
 * an embedded copy carries none. That overwrites the design with `undefined`.
 */
export type UpdateTemplateInput = CreateTemplateInput

/**
 * `POST /template/clone` — copies the design, takes new terms.
 *
 * `organizationId` is how a design is handed to another organization; omitted,
 * the copy lands in the original's.
 */
export type CloneTemplateInput = {
  templateId: number
  title: string
  description: string
  price: string
  organizationId?: number
}
