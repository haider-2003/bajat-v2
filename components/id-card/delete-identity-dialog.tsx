"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteId } from "@/features/ids/api"
import { identityName } from "@/features/ids/fields"
import { statusMeta } from "@/features/ids/status"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatText } from "@/utils/format"

/**
 * Delete — `DELETE /identity/{id}`.
 *
 * Shared by the two ledger screens (Requests and ID Flow), which are two
 * views of the same rows: a card deleted from either is gone from both, and
 * the factory's invalidation of `["identity"]` is what makes the other list
 * notice (docs/IDS-FLOW-EXPORTS-ROUTES.md §8).
 *
 * ### The failure is in the dialog, not nowhere
 *
 * The reference client fired the delete with no handlers on either list —
 * no message on success, and a failure surfaced only as an unhandled
 * rejection in the console (spec §9.5). Here a failure keeps the dialog open
 * with the server's reason in it, and success closes it, which is the only
 * two things a confirmation can honestly do.
 */
export function DeleteIdentityDialog({
  card,
  open,
  onOpenChange,
  onDeleted,
}: {
  card: IDCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After the row is gone — a detail page uses it to leave. */
  onDeleted?: () => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteId()
  const { reset } = remove

  // A failure from the last row must not greet the next one.
  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!card) return null

  const status = statusMeta(t, card.status)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("ids.deleteTitle")}
      description={t("ids.deleteDescription")}
      terms={[
        { label: t("ids.columns.cardholder"), value: formatText(identityName(card)) },
        { label: t("templates.singular"), value: formatText(card.template?.title) },
        { label: t("common.status"), value: status.label },
        { label: t("ids.columns.issued"), value: formatDate(card.createdAt) },
      ]}
      note={t("ids.deleteNote")}
      confirmLabel={t("ids.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(card.id, {
          onSuccess: () => {
            onOpenChange(false)
            onDeleted?.()
          },
        })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("ids.deleteFailed")}
    />
  )
}
