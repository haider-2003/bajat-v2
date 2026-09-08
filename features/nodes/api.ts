import { createApiFactory } from "@/utils/api/api-factory"
import type { CreateNodeInput, Node, UpdateNodeInput } from "./types"

/**
 * Workflow nodes. See docs/CRUD-MIGRATION-REFERENCE.md §1.3 and
 * docs/network-layer.md §7 for the module convention.
 *
 * Plain JSON on every verb — nothing here uploads a file, so the `_method=PUT`
 * spoof multipart resources need never comes up and updates are real `PUT`s.
 */
const nodesApi = createApiFactory<Node, CreateNodeInput, UpdateNodeInput>({
  entityName: "node",
  endpoint: "/node",
})

export const NodeQueryKeys = nodesApi.QueryKeys

export const useGetNodes = nodesApi.useGetList
export const useGetNode = nodesApi.useGetById
export const useCreateNode = nodesApi.useCreate
export const useUpdateNode = nodesApi.useUpdate
export const useDeleteNode = nodesApi.useDelete
