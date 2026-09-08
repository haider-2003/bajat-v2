"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteBranchUser } from "@/features/branch-users/api"
import type { BranchUser } from "@/features/branch-users/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatPhone, formatText } from "@/utils/format"

/**
 * Delete a branch user — `DELETE /branch_user/{id}`.
 *
 * They stop being able to sign in immediately. Disabling the account keeps its
 * history and stops the sign-in, which is the reversible alternative.
 */
export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: BranchUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteBranchUser()
  const { reset } = remove

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!user) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("branchUsers.deleteTitle")}
      description={t("branchUsers.deleteDescription")}
      terms={[
        { label: t("members.form.name"), value: formatText(user.name) },
        {
          label: t("branchUsers.columns.phone"),
          value: formatPhone(user.phone),
        },
        {
          label: t("branchUsers.columns.branch"),
          value: formatText(user.branch?.name),
        },
        {
          label: t("branchUsers.columns.created"),
          value: formatDate(user.createdAt),
        },
      ]}
      note={t("branchUsers.deleteNote")}
      confirmLabel={t("branchUsers.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(user.id, { onSuccess: () => onOpenChange(false) })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("branchUsers.deleteFailed")}
    />
  )
}
