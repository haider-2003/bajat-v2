"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteRole } from "@/features/roles/api"
import type { Role } from "@/features/roles/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatText } from "@/utils/format"

/**
 * Delete a role — `DELETE /role/{id}`.
 *
 * ### Why it is confirmed, and what the confirmation says
 *
 * Deleting a role is not deleting a row: everyone holding it loses those
 * permissions at their next request, and some of those accounts may be left
 * with no roles at all. None of that is visible from the table, so the dialog
 * says it and restates the role so a list of similar names cannot be misread.
 */
export function DeleteRoleDialog({
  role,
  open,
  onOpenChange,
}: {
  role: Role | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteRole()
  const { reset } = remove

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!role) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("roles.deleteTitle")}
      description={t("roles.deleteDescription")}
      terms={[
        { label: t("roles.columns.name"), value: formatText(role.name) },
        { label: t("roles.columns.created"), value: formatDate(role.createdAt) },
      ]}
      note={t("roles.deleteNote")}
      confirmLabel={t("roles.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(role.id, { onSuccess: () => onOpenChange(false) })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("roles.deleteFailed")}
    />
  )
}
