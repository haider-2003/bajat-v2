import type { Organization } from "@/features/organizations/types"

import type { Member } from "./types"

/**
 * A member's organizations, one entry per organization.
 *
 * `Member.organizations` is the many-to-many read straight off the pivot, and
 * the API returns one row per *membership* rather than per organization — a
 * member added to the same organization twice comes back with it listed
 * twice. Rendered as-is that is two identical badges on the card, a `+1`
 * that counts nothing in the table, and React's duplicate-key warning under
 * both. Collapsed here, by id, first occurrence kept, so every screen that
 * lists them agrees on what "the member's organizations" means.
 *
 * Also the one place the array is read defensively: it is documented as
 * always present, but a missing one is a `.length` on undefined that takes
 * the whole table down rather than dropping one cell.
 */
export function memberOrganizations(member: Member): Organization[] {
  const seen = new Set<Organization["id"]>()
  const distinct: Organization[] = []
  for (const organization of member.organizations ?? []) {
    if (seen.has(organization.id)) continue
    seen.add(organization.id)
    distinct.push(organization)
  }
  return distinct
}
