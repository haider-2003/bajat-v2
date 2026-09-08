import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AxiosError } from "axios"

import api from "@/api/client"
import type { UpdateWebhookInput, Webhook } from "./types"

/**
 * The webhook singleton. See docs/CRUD-MIGRATION-REFERENCE.md §1.14.
 *
 * Hand-rolled rather than generated: the CRUD factory addresses rows by id and
 * this resource has none. What it keeps from the factory's contract is the one
 * thing call sites depend on — a write invalidates the read, so the form
 * re-reads what the server actually stored instead of trusting what it sent.
 */

export const WebhookQueryKeys = {
  all: () => ["webhook"] as const,
}

/** `GET /webhook`. Returns the entity unwrapped, like `useGetById` does. */
export function useGetWebhook() {
  return useQuery<Webhook, AxiosError>({
    queryKey: WebhookQueryKeys.all(),
    queryFn: async () => {
      const response = await api.get<Webhook>("/webhook")
      return response.data
    },
  })
}

/**
 * `PUT /webhook`. One endpoint for both create and update — there is nothing
 * to create *into*, so the first save and every later one are the same call.
 */
export function useUpdateWebhook(options?: {
  onSuccess?: () => void
  onError?: (error: AxiosError) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<Webhook, AxiosError, UpdateWebhookInput>({
    mutationFn: async (data) => {
      // `webhookUrl` decamelizes to `webhook_url`, which is the name the
      // endpoint reads. See the note on `UpdateWebhookInput`.
      const response = await api.put<Webhook>("/webhook", data)
      return response.data
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WebhookQueryKeys.all() })
      options?.onSuccess?.()
    },
  })
}
