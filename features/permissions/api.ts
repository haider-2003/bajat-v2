import { createApiFactory } from "@/utils/api/api-factory"
import type { Permission } from "@/features/roles/types"

/**
 * Permissions. See docs/CRUD-MIGRATION-REFERENCE.md §1.9.
 *
 * Read-only, and read for exactly one reason: to populate the checkbox tree in
 * the role editor. The list is a fixed vocabulary the backend ships with — it
 * is not user data, nothing creates a permission, and it is always fetched a
 * hundred at a time filtered to one role type.
 */
const permissionsApi = createApiFactory<Permission>({
  entityName: "permission",
  endpoint: "/permission",
})

export const PermissionQueryKeys = permissionsApi.QueryKeys

export const useGetPermissions = permissionsApi.useGetList
