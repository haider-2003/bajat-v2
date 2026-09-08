import type { Permission, RoleType } from "@/features/roles/types"

/**
 * Turns the backend's flat permission list into the grid the role editor
 * renders. See docs/CRUD-MIGRATION-REFERENCE.md §1.8 "Permission-name grammar".
 *
 * ### Why parse names at all
 *
 * `GET /permission` returns ~120 rows of `{ id, name }` where the name is the
 * only structure: `organization-create-member`, `admin-members-list`,
 * `branch-change-status-identity`. Rendering that as one flat column of 120
 * checkboxes is a list nobody can audit — the question a role editor gets
 * asked is "what can this role do to members?", and answering it means the
 * names have to be grouped by the thing they act on.
 *
 * So the name is split into a **scope**, an **action** and an **entity**, and
 * the editor renders one row per entity with one checkbox per action.
 *
 * ### The parse is lossy on purpose, and the id is what is submitted
 *
 * Two names can normalise onto the same entity (`branches` and `branch`), and
 * a name this parser does not recognise falls through to a single-word entity
 * rather than being dropped. Nothing here is ever sent back — the checkbox
 * carries `permission.id`, and the parse only decides where it is drawn. A
 * mis-grouped permission is therefore a cosmetic bug, never a wrong grant.
 */

const SCOPES: RoleType[] = ["admin", "organization", "branch"]

/** One permission, split into the parts the editor groups by. */
export type ParsedPermission = {
  permission: Permission
  scope: RoleType | null
  action: string
  entity: string
}

/**
 * Entities whose plural is not formed by the rules below, or which are not
 * plural at all. Kept verbatim so `member-request` does not become
 * `member-reques`.
 */
const VERBATIM_ENTITIES = new Set([
  "member-request",
  "organization-user",
  "branch-user",
  "blacklist",
  "news",
  "permissions",
])

/**
 * Singularises an entity segment so `members-list` and `create-member` land in
 * the same row. English-only, and deliberately crude — it runs over a fixed
 * vocabulary of about twenty words, not arbitrary input.
 */
export function normalizeEntity(entity: string): string {
  if (!entity) return entity
  if (VERBATIM_ENTITIES.has(entity)) return entity
  if (entity === "branches") return "branch"
  if (entity.endsWith("ies")) return `${entity.slice(0, -3)}y`
  if (/(ches|shes|xes|ses)$/.test(entity)) return entity.slice(0, -2)
  if (entity.endsWith("s")) return entity.slice(0, -1)
  return entity
}

/**
 * `organization-create-member` → `{ scope: "organization", action: "create",
 * entity: "member" }`.
 *
 * The special cases are ordered, and the order is the specification: several
 * of them match names the general rule would also match, and would split
 * differently. `change-status-identity` under the general rule is action
 * `change`, entity `status-identity` — a row called "status-identity" with one
 * checkbox in it.
 */
export function parsePermissionName(name: string): {
  scope: RoleType | null
  action: string
  entity: string
} {
  const scope = SCOPES.find((s) => name.startsWith(`${s}-`)) ?? null
  const rest = scope ? name.slice(scope.length + 1) : name
  const parts = rest.split("-")

  // 1. The one three-word action in the vocabulary. Matched on content rather
  //    than position because the words appear in more than one order.
  if (
    rest.includes("export") &&
    rest.includes("identities") &&
    rest.includes("template")
  ) {
    return { scope, action: "export-identities-template", entity: "template" }
  }

  // 2/3. `change-status-<entity>` and `change-<entity>-status` are the same
  //      verb written two ways; both collapse onto one action.
  if (parts[0] === "change" && parts[1] === "status") {
    return { scope, action: "change-status", entity: normalizeEntity(parts.slice(2).join("-")) }
  }
  if (parts[0] === "change" && parts[parts.length - 1] === "status") {
    return {
      scope,
      action: "change-status",
      entity: normalizeEntity(parts.slice(1, -1).join("-")),
    }
  }

  // 4/5. Single-verb actions that would otherwise read as an entity prefix.
  if (parts[0] === "clone" || parts[0] === "block") {
    return { scope, action: parts[0], entity: normalizeEntity(parts.slice(1).join("-")) }
  }

  // 6. `<entity>-list` — the only action written as a suffix.
  if (parts.length > 1 && parts[parts.length - 1] === "list") {
    return {
      scope,
      action: "list",
      entity: normalizeEntity(parts.slice(0, -1).join("-")),
    }
  }

  // 7. Flow permissions name their entity in the verb.
  if (parts.length === 2 && parts[1] === "flow") {
    return { scope, action: parts[0], entity: "flow" }
  }

  // 9. A bare word is an entity nobody wrote a verb for — `news`,
  //    `permissions`. Reading it as an action would produce a row with no name.
  if (parts.length === 1) {
    return { scope, action: "list", entity: normalizeEntity(parts[0]) }
  }

  // 8. The general rule.
  return { scope, action: parts[0], entity: normalizeEntity(parts.slice(1).join("-")) }
}

/** One entity's row in the editor: the thing, and every verb available on it. */
export type PermissionGroup = {
  entity: string
  permissions: ParsedPermission[]
}

/**
 * Groups a permission list by entity, both the rows and the actions inside
 * them in a stable order.
 *
 * Sorted alphabetically rather than left in server order: the endpoint returns
 * insertion order, so a permission added next release would appear in the
 * middle of an unrelated group and move every row below it. A reviewer who
 * knows where "member" sits should still find it there next month.
 */
export function groupPermissions(permissions: Permission[]): PermissionGroup[] {
  const groups = new Map<string, ParsedPermission[]>()

  for (const permission of permissions) {
    const parsed = parsePermissionName(permission.name)
    const entry: ParsedPermission = { permission, ...parsed }
    const bucket = groups.get(parsed.entity)
    if (bucket) bucket.push(entry)
    else groups.set(parsed.entity, [entry])
  }

  return [...groups.entries()]
    .map(([entity, items]) => ({
      entity,
      permissions: items.sort((a, b) => a.action.localeCompare(b.action)),
    }))
    .sort((a, b) => a.entity.localeCompare(b.entity))
}

/**
 * `member-request` → `Member request`.
 *
 * A fallback for entities and actions the dictionary has no entry for. New
 * permissions ship with the backend, not with this app, so an unrecognised one
 * must still render as something a reader can act on — a raw slug in a
 * checkbox label is legible; a missing label is a checkbox with no meaning.
 */
export function humanize(slug: string): string {
  if (!slug) return ""
  const spaced = slug.replace(/-/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
