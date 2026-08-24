import type { Organization } from "@/features/organizations/types"
import type { BaseEntity } from "@/types/api"

/**
 * Templates — the ID card design plus its issuance metadata.
 * See docs/api-types.md § templates.
 *
 * **Types only, and deliberately partial.** There is no `features/templates/api.ts`
 * yet; this exists because an `IDCard` arrives with its template embedded, and
 * every screen that shows an issued card shows something off it — the title on
 * the printer queue, the artwork in the preview.
 *
 * The fields here are the ones live `/identity` rows actually carry. The full
 * shape — `template` (the design document), `shareKey`, `branchRequired`,
 * `identitiesCount` — is in the doc, and belongs in this file the day the
 * templates screen is built. Adding them now would be describing a payload
 * nothing in the app has ever received.
 *
 * Everything optional for the same reason as `features/members-requests`: the
 * doc documents the resource's own endpoint, and an embedded copy is thinner.
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
  /** Months the issued card stays valid. `null` where the template never expires. */
  identityDuration?: number | null
  /** A number on the entity, a string on input. Not a boolean in either direction. */
  isEnabled?: number
  organization?: Organization | null
}
