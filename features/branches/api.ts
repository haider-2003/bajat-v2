import { useQuery } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { GetResponse } from "@/types/api"
import { createApiFactory } from "@/utils/api/api-factory"
import type { Branch, CreateBranchInput, UpdateBranchInput } from "./types"

/**
 * Branches. See docs/CRUD-MIGRATION-REFERENCE.md §1.4.
 */
const branchesApi = createApiFactory<Branch, CreateBranchInput, UpdateBranchInput>({
  entityName: "branch",
  endpoint: "/branch",
})

export const BranchQueryKeys = {
  ...branchesApi.QueryKeys,
  /** Nested under `all()`, so a branch mutation refreshes these too. */
  byTemplate: (templateId: string | number) =>
    [...branchesApi.QueryKeys.all(), "template", templateId] as const,
}

export const useGetBranches = branchesApi.useGetList
export const useGetBranch = branchesApi.useGetById
export const useCreateBranch = branchesApi.useCreate
export const useUpdateBranch = branchesApi.useUpdate
export const useDeleteBranch = branchesApi.useDelete

/**
 * `GET /branch/template/{templateId}` — the branches that can issue one
 * template, for the picker on a template that requires a branch.
 *
 * Outside the factory because it is not `/{id}`: the path segment is a
 * *template* id, so `useGetBranch(templateId)` would read a branch whose id
 * happens to match a template's and return the wrong row rather than fail.
 * Returns the whole response, matching `useGetList`.
 */
export function useGetBranchesByTemplateId(
  templateId: string | number | undefined,
) {
  return useQuery<GetResponse<Branch[]>, AxiosError>({
    queryKey: BranchQueryKeys.byTemplate(templateId as string | number),
    queryFn: async () =>
      await api.get<{ data: Branch[] }>(`/branch/template/${templateId}`),
    enabled: !!templateId,
  })
}
