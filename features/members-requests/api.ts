import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/api/client"
import { createApiFactory } from "@/utils/api/api-factory"
import type {
  ChangeMemberStatusInput,
  CreateMembersInput,
  MemberRequest,
  UpdateMembersInput,
} from "./types"

/**
 * Member requests. See docs/api-types.md § members-requests for every shape,
 * and docs/network-layer.md §7 for the module convention.
 *
 * Hook names follow the documented API surface, which is a little uneven:
 * `useGetMembersRequests` is the *list*, `useGetMemberRequests` the *detail*.
 * Import them explicitly rather than by memory.
 */
const membersRequestsApi = createApiFactory<
  MemberRequest,
  CreateMembersInput,
  UpdateMembersInput
>({
  entityName: "member-request",
  endpoint: "/member_request",
  // Applications carry an avatar and an attachment, so writes are multipart —
  // which is also why updates POST with `_method=PUT` (PHP can't parse a
  // multipart body on a real PUT). The factory handles that.
  isFormData: true,
})

export const MemberRequestQueryKeys = membersRequestsApi.QueryKeys

export const useGetMembersRequests = membersRequestsApi.useGetList
export const useGetMemberRequests = membersRequestsApi.useGetById
export const useCreateMemberRequests = membersRequestsApi.useCreate
export const useUpdateMemberRequests = membersRequestsApi.useUpdate
export const useDeleteMemberRequests = membersRequestsApi.useDelete

/**
 * Approve / reject both PUT the same endpoint with a different status. Note
 * the path takes the **member** id, not the request id.
 */
const useChangeStatus = (status: ChangeMemberStatusInput["status"]) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, note }: { memberId: number | string; note?: string }) => {
      const response = await api.put(`/member_request/change_status/${memberId}`, {
        status,
        note,
      })
      return response.data as MemberRequest
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MemberRequestQueryKeys.all() })
    },
  })
}

export const useApproveMember = () => useChangeStatus("approved")
export const useRejectMember = () => useChangeStatus("rejected")
