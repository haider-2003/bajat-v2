import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateUserInput, UpdateUserInput, User } from "./types"

/**
 * Platform admins. See docs/CRUD-MIGRATION-REFERENCE.md §1.7.
 *
 * `/user` is the admin table specifically — organization and branch users have
 * their own endpoints. There is no organization concept here at all: an admin
 * is platform-wide, which is why this module has no org selector and no
 * dependent lookups.
 */
const usersApi = createApiFactory<User, CreateUserInput, UpdateUserInput>({
  entityName: "user",
  endpoint: "/user",
})

export const UserQueryKeys = usersApi.QueryKeys

export const useGetUsers = usersApi.useGetList
export const useGetUser = usersApi.useGetById
export const useCreateUser = usersApi.useCreate
export const useUpdateUser = usersApi.useUpdate
export const useDeleteUser = usersApi.useDelete

/**
 * `POST /user/{id}/reset` — clears the user's TOTP secret so they enrol a new
 * authenticator at next login.
 *
 * ### It invalidates the list, unlike the original
 *
 * The app this was ported from fired this call and refreshed nothing
 * (docs/CRUD-MIGRATION-REFERENCE.md §3.7), leaving the table showing
 * "2FA enrolled" for an account that no longer is — the one row on this screen
 * whose whole purpose is to say whether a reset is still needed. Since
 * `tfaEnabled` is a column here, the reset invalidates like every other
 * mutation.
 */
export function useResetUserMfa(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string | number>({
    mutationFn: async (userId) => {
      await api.post(`/user/${userId}/reset`)
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UserQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
