import type { Organization } from "@/features/organizations/types"
import type { BaseEntity } from "@/types/api"

/**
 * The black list — phone numbers barred from being issued an identity. See
 * docs/api-types.md § black-list.
 *
 * ### An entry is a phone number, not a person
 *
 * `name` is a label for whoever reads the list later; the *phone* is the key
 * the backend blocks on. Nothing here points at a `Member` — a number can be
 * barred before anyone by that name has ever registered, which is the whole
 * point of a pre-emptive block. So there is no member id to join on, and a
 * name in this list matching a member's name proves nothing.
 *
 * ### There is no update
 *
 * Entries are added and removed, never edited (docs/api-types.md § black-list),
 * so there is no `UpdateBlackListInput`. Correcting a typo means removing the
 * entry and adding it again — which is honest, because a corrected number is
 * a different block.
 *
 * Shapes are camelCase because that is what the code sees; the wire format is
 * snake_case and the interceptors convert both ways.
 */
export type BlackList = BaseEntity & {
  id: number
  /** The barred number, stored bare — `"9647701234567"`. */
  phone: string
  name: string
  /** Documented as required — an entry is always scoped to one organization. */
  organization: Organization
  createdAt: string
  /** Present, but not meaningful: nothing edits an entry, so it tracks `createdAt`. */
  updatedAt: string
}

/**
 * `organizationId` is **singular**, unlike members' `organizationIds`.
 *
 * A block belongs to one organization — it is that tenant's list, not a
 * platform-wide ban — so the endpoint reads `organization_id`. The plural
 * spelling members uses is the mistake to watch for here: it decamelizes to a
 * parameter this endpoint does not know, and the entry is created against
 * whatever the token's default organization is rather than the one that was
 * picked (docs/api-types.md § black-list).
 */
export type CreateBlackListInput = {
  /** The wire form — `964` plus ten local digits. Normalise with `toApiPhone`. */
  phone: string
  name: string
  organizationId?: number
} & Record<string, unknown>
