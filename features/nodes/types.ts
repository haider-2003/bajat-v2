import type { Organization } from "@/features/organizations/types"
import type { BaseEntity } from "@/types/api"

/**
 * A workflow node — one step an identity passes through on its way to being
 * printed. See docs/api-types.md § nodes and docs/CRUD-MIGRATION-REFERENCE.md
 * §1.3.
 *
 * ### The colour is data, not decoration
 *
 * `color` is stored on the row because the node is rendered as a chip on the
 * ID board, in the branch picker, and against every user who is allowed to act
 * on it. Those are three screens that must agree, so the colour cannot be
 * derived from the name or assigned by position — a node renamed or reordered
 * would change colour under people who navigate by it.
 *
 * ### It belongs to an organization, once
 *
 * `organization` comes back expanded on reads and goes out as
 * `organization_id` on create. It is **not** sent on update: a node that
 * changed tenant would take its history with it, so the backend treats the
 * owner as create-time only.
 */
export type Node = BaseEntity & {
  id: number
  name: string
  /** `#RRGGBB`. Always six digits — the picker never emits the short form. */
  color: string
  createdAt: string
  updatedAt: string
  /** Expanded on reads. Absent on an org-scoped token's own rows. */
  organization?: Organization
}

/** `POST /node` → `{ name, color, organization_id }`. */
export type CreateNodeInput = {
  name: string
  color: string
  /** Admins only. Omitted for org-scoped accounts, which the token scopes. */
  organizationId?: number
} & Record<string, unknown>

/**
 * `PUT /node/{id}` → `{ name, color }`.
 *
 * No `organizationId`: see the note on the entity. Typed as its own shape
 * rather than `Partial<CreateNodeInput>` so passing one is a compile error
 * rather than a field the backend silently drops.
 */
export type UpdateNodeInput = {
  name: string
  color: string
} & Record<string, unknown>
