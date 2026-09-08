"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteApiKey } from "@/features/api-keys/api"
import type { ApiKey } from "@/features/api-keys/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatText } from "@/utils/format"

/**
 * Delete an API key — `DELETE /access_key/{id}`.
 *
 * ### Deleting *is* revoking, which is why this one is confirmed
 *
 * There is no rotate and no disable on this resource: the only way to stop a
 * leaked secret being accepted is to delete the row. So this dialog is doing
 * two jobs at once — it is the destructive confirmation, and it is the
 * revocation flow — and the consequence lands somewhere the person clicking
 * cannot see: every request presenting that secret starts failing at once,
 * with no grace period and no warning to whoever wrote the integration.
 *
 * The restated row leads with the name and the creator for that reason. The
 * name says what will break; the creator says who to ask first.
 *
 * The secret itself is **not** restated. It is the one field that would make
 * this dialog unsafe to screen-share, and it distinguishes nothing — two keys
 * never share a name on a list this short.
 */
export function DeleteApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
}: {
  /** `null` between openings — nothing renders. */
  apiKey: ApiKey | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteApiKey()
  const { reset } = remove

  // A failure from the last row must not greet the next one.
  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!apiKey) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("apiKeys.deleteTitle")}
      description={t("apiKeys.deleteDescription")}
      terms={[
        { label: t("apiKeys.columns.name"), value: formatText(apiKey.name) },
        {
          label: t("apiKeys.columns.createdBy"),
          value: formatText(apiKey.user?.name),
        },
        {
          label: t("filters.attributes.organization"),
          value: formatText(apiKey.organization?.name),
        },
        { label: t("apiKeys.columns.created"), value: formatDate(apiKey.createdAt) },
      ]}
      note={t("apiKeys.deleteNote")}
      confirmLabel={t("apiKeys.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(apiKey.id, { onSuccess: () => onOpenChange(false) })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("apiKeys.deleteFailed")}
    />
  )
}
