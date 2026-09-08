"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteUser } from "@/features/users/api"
import type { User } from "@/features/users/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatPhone, formatText } from "@/utils/format"

/**
 * Delete a platform admin — `DELETE /user/{id}`.
 *
 * The note warns against deleting the last enabled admin — nobody would be left
 * who can administer the platform. Disabling is the reversible alternative.
 */
export function DeleteAdminDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteUser()
  const { reset } = remove

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!user) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admins.deleteTitle")}
      description={t("admins.deleteDescription")}
      terms={[
        { label: t("members.form.name"), value: formatText(user.name) },
        { label: t("admins.columns.phone"), value: formatPhone(user.phone) },
        {
          label: t("admins.columns.created"),
          value: formatDate(user.createdAt),
        },
      ]}
      note={t("admins.deleteNote")}
      confirmLabel={t("admins.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(user.id, { onSuccess: () => onOpenChange(false) })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("admins.deleteFailed")}
    />
  )
}
