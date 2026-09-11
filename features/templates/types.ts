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
  /**
   * The ownership marker. **Set** on an organization's own template, **absent**
   * on a public one — see `TemplateScope`. The list filter `type` is how the
   * server exposes the same split.
   */
  organization?: Organization | null
  /** ISO 8601 strings, never `Date` objects. Absent on an embedded copy. */
  createdAt?: string | null
  updatedAt?: string | null
}

/**
 * Which of the two populations a template belongs to — the `type` filter on
 * `GET /template`, and the two tabs of the templates screen.
 *
 * - `organization` — owned by an organization (`organization` is set). The
 *   ones an identity can actually be issued from. An organization user sees
 *   their own; an admin sees every organization's, optionally narrowed with
 *   `organization_id`.
 * - `global` — the public catalogue, owned by nobody (`organization` absent).
 *   Blueprints to be adopted with `POST /template/clone`, not used directly.
 *
 * Ownership is decided **server-side from the bearer token** on `POST
 * /template`: an organization user's save lands in their organization, an
 * admin's lands in the public catalogue. The client never sends it, which is
 * why `CreateTemplateInput` has no organization field.
 */
export type TemplateScope = "organization" | "global"

export const TEMPLATE_SCOPES: readonly TemplateScope[] = ["organization", "global"]

/** The tab a URL with no `?type=` opens on. */
export const DEFAULT_TEMPLATE_SCOPE: TemplateScope = "organization"

/** Narrows an untrusted string (a query param) to a scope, or the default. */
export function readTemplateScope(value: string | null | undefined): TemplateScope {
  return TEMPLATE_SCOPES.includes(value as TemplateScope)
    ? (value as TemplateScope)
    : DEFAULT_TEMPLATE_SCOPE
}

/**
 * A queued export of one template's identities — `GET /export`
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §4).
 *
 * The file is a ZIP: an Excel sheet of the submissions plus a folder of every
 * attached image. The client never opens it — it hands the URL over.
 *
 * `status` is the job's own word for where it is — and on the live API it is
 * a bare **number**, not the string the doc implied, with no published
 * vocabulary. `exportStatusMeta` (./display.ts) reads either and falls back
 * to `file` for a code it cannot name; `file` is the only field the screen
 * *decides* on.
 */
export type TemplateExport = BaseEntity & {
  id: number
  status?: string | number | null
  /** Download URL. `""` / `null` until the job finishes. */
  file?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  template?: Template | null
  organization?: Organization | null
}

/**
 * `GET /template/export/{templateId}?statuses[]=…` — queue an export.
 *
 * `statuses` are the numeric ids, stringified, and an **empty** selection
 * means "every status", never "no status": the parameter is omitted entirely
 * rather than sent empty (spec §5.3).
 */
export type ExportTemplateInput = {
  templateId: number
  statuses?: string[]
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
 * This is the one client action that explicitly targets an organization, and
 * so the only way a public template becomes an organization's: the server
 * copies the design, the variables, `branch_required` and `identity_duration`
 * from `templateId` into a **new** row and stamps it with an owner.
 *
 * `organizationId` names that owner. Only an **admin** may send it — it is
 * how they push a public card into a specific organization. Omitted, the
 * server uses the bearer token's organization, which is the only thing an
 * organization user can clone into anyway.
 */
export type CloneTemplateInput = {
  templateId: number
  title: string
  description: string
  price: string
  organizationId?: number
}
