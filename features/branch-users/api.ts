import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  BranchUser,
  CreateBranchUserInput,
  UpdateBranchUserInput,
} from "./types"

/**
 * Branch users. See docs/CRUD-MIGRATION-REFERENCE.md §1.5.
 */
const branchUsersApi = createApiFactory<
  BranchUser,
  CreateBranchUserInput,
  UpdateBranchUserInput
>({
  entityName: "branch-user",
  endpoint: "/branch_user",
})

export const BranchUserQueryKeys = branchUsersApi.QueryKeys

export const useGetBranchUsers = branchUsersApi.useGetList
export const useGetBranchUser = branchUsersApi.useGetById
export const useCreateBranchUser = branchUsersApi.useCreate
export const useUpdateBranchUser = branchUsersApi.useUpdate
export const useDeleteBranchUser = branchUsersApi.useDelete

/** `POST /branch_user/{id}/reset`. See the note in features/users/api.ts. */
export function useResetBranchUserMfa(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string | number>({
    mutationFn: async (userId) => {
      await api.post(`/branch_user/${userId}/reset`)
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BranchUserQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
