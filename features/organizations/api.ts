import { createApiFactory } from "@/utils/api/api-factory"
import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from "./types"

/**
 * Organizations. See docs/CRUD-MIGRATION-REFERENCE.md §1.10 and
 * docs/network-layer.md §7 for the module convention.
 *
 * The tenant every other entity hangs off, which is why this module is read by
 * nearly every screen in the app — the organization pickers on the member,
 * node, branch and black-list forms all come from `useGetOrganizations`.
 *
 * ### Multipart, and the `_method` spoof that comes with it
 *
 * `isFormData` is set because writes carry a `logo` file. The factory then
 * sends updates as `POST /organization/{id}` with `_method=PUT` in the body,
 * since PHP cannot parse a multipart body on a real `PUT`. That is the
 * documented contract for this endpoint, not a workaround this client invented
 * — the Postman collection sends the same field.
 */
const organizationsApi = createApiFactory<
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput
>({
  entityName: "organization",
  endpoint: "/organization",
  isFormData: true,
})

export const OrganizationQueryKeys = organizationsApi.QueryKeys

export const useGetOrganizations = organizationsApi.useGetList
export const useGetOrganization = organizationsApi.useGetById
export const useCreateOrganization = organizationsApi.useCreate
export const useUpdateOrganization = organizationsApi.useUpdate
export const useDeleteOrganization = organizationsApi.useDelete
