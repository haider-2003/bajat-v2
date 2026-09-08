import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  CreateOrganizationUserInput,
  OrganizationUser,
  UpdateOrganizationUserInput,
} from "./types"

/**
 * Organization users. See docs/CRUD-MIGRATION-REFERENCE.md §1.6.
 */
const organizationUsersApi = createApiFactory<
  OrganizationUser,
  CreateOrganizationUserInput,
  UpdateOrganizationUserInput
>({
  entityName: "organization-user",
  endpoint: "/organization_user",
})

export const OrganizationUserQueryKeys = organizationUsersApi.QueryKeys

export const useGetOrganizationUsers = organizationUsersApi.useGetList
export const useGetOrganizationUser = organizationUsersApi.useGetById
export const useCreateOrganizationUser = organizationUsersApi.useCreate
export const useUpdateOrganizationUser = organizationUsersApi.useUpdate
export const useDeleteOrganizationUser = organizationUsersApi.useDelete

/** `POST /organization_user/{id}/reset`. See the note in features/users/api.ts. */
export function useResetOrganizationUserMfa(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string | number>({
    mutationFn: async (userId) => {
      await api.post(`/organization_user/${userId}/reset`)
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OrganizationUserQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
