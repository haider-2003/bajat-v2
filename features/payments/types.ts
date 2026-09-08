import type { Member } from "@/features/members/types"
import type { Organization } from "@/features/organizations/types"
import type { Template } from "@/features/templates/types"
import type { BaseEntity } from "@/types/api"

/**
 * A payment against an identity request. See
 * docs/CRUD-MIGRATION-REFERENCE.md §1.13.
 *
 * ### Read-only, by the backend
 *
 * `/payment` exposes a list and a detail read and nothing else — money is
 * moved by the payment provider, and this table is the record of what it did.
 * There is no create, no refund and no status change from here.
 *
 * ### `amount` is a string
 *
 * A decimal that has already been rounded to the currency's precision by
 * whoever charged it. Parsing it into a JS number to format it would be the
 * one place a rounding difference could appear between what was charged and
 * what this table claims was charged, so it is rendered as sent.
 */
export type Payment = BaseEntity & {
  id: number
  /** The provider's reference. What support quotes back when a charge is disputed. */
  requestId: string
  amount: string
  /** ISO 4217, e.g. `"IQD"`. */
  currency: string
  /** Free-form on the wire — the provider's vocabulary, not ours. */
  status: string
  /** `null` until the provider confirms. A row can exist unpaid. */
  paidAt: string | null
  createdAt: string
  updatedAt: string
  organization?: Organization
  template?: Template
  member?: Member
}
