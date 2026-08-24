import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateMembersInput, Member, UpdateMembersInput } from "./types"

/**
 * Members. See docs/api-types.md § members for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### Not multipart
 *
 * Unlike `member_request`, this resource is **not** listed as a FormData
 * endpoint (docs/api-types.md § entity index), so writes go out as JSON and
 * updates use a real `PUT` rather than the `_method=PUT` spoof PHP needs for
 * multipart bodies. `Member.avatar` is a URL the API returns, not a file this
 * endpoint takes.
 *
 * ### Documented but not built
 *
 * Three hooks in the doc's table have no implementation here:
 *
 *  - `useUploadMembers` (`POST /member/excel`) — the bulk Excel import. It is
 *    the one write on this resource that *is* multipart, so it cannot come
 *    from the factory above; it needs a hand-written mutation and a screen to
 *    call it, and there is no import UI yet.
 *  - `useGetMemberIdentities` (`GET /member/{id}/identity`) — returns
 *    `IDCard[]`, and no `features/ids` module exists to type them against.
 *  - `useGetMemberOrganizations` (`GET /member/{id}/organization`) — the
 *    member's orgs are already on the row as `organizations`, so nothing
 *    needs a second request for them yet.
 *
 * They are named here rather than silently missing: an exported hook reads as
 * a supported one, and the same reasoning governs `features/organizations`.
 */
const membersApi = createApiFactory<Member, CreateMembersInput, UpdateMembersInput>({
  entityName: "member",
  endpoint: "/member",
})

export const MemberQueryKeys = membersApi.QueryKeys

export const useGetMembers = membersApi.useGetList
export const useGetMember = membersApi.useGetById
export const useCreateMember = membersApi.useCreate
export const useUpdateMember = membersApi.useUpdate
export const useDeleteMember = membersApi.useDelete
