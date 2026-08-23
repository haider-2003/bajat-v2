import { createApiFactory } from "@/utils/api/api-factory"
import type { Organization } from "./types"

/**
 * Organizations. See docs/api-types.md § organizations for the shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * The tenant every other entity hangs off. So far this feature is only *read*
 * — screens filter by organization and label rows with one; nothing here
 * creates or edits them. The factory generates the write hooks anyway, but
 * they are deliberately not re-exported: the create/update payloads (a `logo`
 * upload among them) are undocumented here, and an exported hook reads as a
 * supported one.
 */
const organizationsApi = createApiFactory<Organization>({
  entityName: "organization",
  endpoint: "/organization",
  // Writes carry a logo, so the resource is multipart — kept accurate even
  // though only the read hooks are exposed.
  isFormData: true,
})

export const OrganizationQueryKeys = organizationsApi.QueryKeys

export const useGetOrganizations = organizationsApi.useGetList
export const useGetOrganization = organizationsApi.useGetById
