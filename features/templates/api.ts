import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/api/client"
import { createApiFactory, type ApiError } from "@/utils/api/api-factory"
import type {
  CloneTemplateInput,
  CreateTemplateInput,
  Template,
  TemplateExport,
  UpdateTemplateInput,
} from "./types"

/**
 * Templates. See docs/api-types.md § templates for every shape, and
 * docs/network-layer.md §7 for the module convention.
 *
 * ### JSON, not multipart, even though it carries artwork
 *
 * `front_image` / `back_image` go up as **data URLs inside the JSON body**
 * (docs/photo-editor-spec.md §16.1) rather than as files, so this resource is
 * not on the FormData list and updates use a real `PUT`.
 *
 * ### What `GET /template` actually filters on
 *
 * `page`, `per_page`, `search`, `type` and `organization_id` — verified
 * against docs/identities-api.postman_collection.json, which is the authority
 * for this endpoint's query surface. Nothing else. Sending an invented field
 * name is the silent failure docs/filtering-sorting-pagination.md §6
 * describes: it becomes a real query parameter, raises no error, and leaves
 * the list quietly unfiltered.
 *
 * `type` is the ownership split (`TemplateScope` in ./types.ts):
 * `organization` returns templates owned by an organization — the caller's
 * own for an organization user, everyone's for an admin, who may narrow with
 * `organization_id` — and `global` returns the public catalogue, which has no
 * owner and ignores `organization_id`. See docs/CARD-CREATE-ASSIGN-GALLERY.md.
 *
 * ### Documented but not built
 *
 *  - `useExportTemplateAsCSV` (`GET /template/export/{id}`) and
 *    `useGetTemplatesExports` (`GET /export`) — the export half of the
 *    resource. It is asynchronous: requesting an export queues a
 *    `TemplateExport` whose `file` appears when it finishes, which is a screen
 *    (Export History) rather than a button, and that screen does not exist yet.
 *  - `usePublicTemplate` (`shareKey`) — a *different host*
 *    (`api.bajat.net/api/public/v1`), so it cannot come from this client at
 *    all. It belongs to the public self-service flow, not the dashboard.
 *  - `useGetTemplateFlow` / `useCreateTemplateFlow` — the node routing an
 *    issued card walks. That is the ID Flow screen's resource.
 *
 * They are named rather than silently missing: an exported hook reads as a
 * supported one.
 */
const templatesApi = createApiFactory<
  Template,
  CreateTemplateInput,
  UpdateTemplateInput
>({
  entityName: "template",
  endpoint: "/template",
})

export const TemplateQueryKeys = templatesApi.QueryKeys

export const useGetTemplates = templatesApi.useGetList
export const useGetTemplate = templatesApi.useGetById
export const useCreateTemplate = templatesApi.useCreate
export const useUpdateTemplate = templatesApi.useUpdate
export const useDeleteTemplate = templatesApi.useDelete

/**
 * `POST /template/clone` — copy a design onto new terms.
 *
 * Hand-written because it is a POST to a *sibling* path with the id in the
 * body, which is not a shape the factory has. The invalidation is the factory's
 * though: a clone adds a row, so every template query is stale.
 */
export const useCloneTemplate = () => {
  const queryClient = useQueryClient()

  return useMutation<Template, ApiError, CloneTemplateInput>({
    mutationFn: async (data) => {
      const response = await api.post<Template>("/template/clone", data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TemplateQueryKeys.all() })
    },
  })
}

/**
 * `PUT /template/{id}/reset` — restart this template's issuance sequences.
 *
 * Empty body; the id is the whole request. Sequences are the counters behind
 * the `incremental` variable type (docs/photo-editor-spec.md §14), so this
 * changes what the *next* card issued is numbered, not any card already cut.
 */
export const useResetTemplateSequences = () => {
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, number>({
    mutationFn: async (id) => {
      await api.put(`/template/${id}/reset`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TemplateQueryKeys.all() })
    },
  })
}

/**
 * `GET /export` — the queue of CSV exports, newest first.
 *
 * ### Its own resource, not a sub-list of templates
 *
 * The path is a sibling of `/template`, and the rows outlive the template they
 * came from: an export that has already run is a file, and deleting the
 * template it was cut from does not un-run it. So it gets its own factory and
 * its own cache namespace rather than a nested key under `["template"]` —
 * which also means editing a template does not invalidate a list of finished
 * files that could not have changed.
 *
 * Read-only, deliberately. Rows are *produced* by `GET
 * /template/export/{templateId}` on the templates screen; nothing on the
 * exports screen creates, retries or deletes one.
 */
const templateExportsApi = createApiFactory<TemplateExport>({
  entityName: "templateExport",
  endpoint: "/export",
})

export const TemplateExportQueryKeys = templateExportsApi.QueryKeys

export const useGetTemplateExports = templateExportsApi.useGetList
