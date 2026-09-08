import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateRoleInput, Role, UpdateRoleInput } from "./types"

/**
 * Roles. See docs/CRUD-MIGRATION-REFERENCE.md §1.8.
 *
 * ### One endpoint, three screens
 *
 * `/role` holds admin, organization and branch roles alike, separated only by
 * `type`. The three screens that edit them (`/management/roles`,
 * `/organizations/roles`, `/branches/roles`) force that field rather than
 * exposing it — a role's scope decides which permissions may be attached to
 * it, so letting it change under an already-checked tree would save a set of
 * permissions the new scope cannot hold.
 *
 * That forcing lives in the screens, not here: this module is the transport,
 * and a hook that silently rewrote `type` would make the other two screens
 * unreachable through it.
 */
const rolesApi = createApiFactory<Role, CreateRoleInput, UpdateRoleInput>({
  entityName: "role",
  endpoint: "/role",
})

export const RoleQueryKeys = rolesApi.QueryKeys

export const useGetRoles = rolesApi.useGetList
export const useGetRole = rolesApi.useGetById
export const useCreateRole = rolesApi.useCreate
export const useUpdateRole = rolesApi.useUpdate
export const useDeleteRole = rolesApi.useDelete
