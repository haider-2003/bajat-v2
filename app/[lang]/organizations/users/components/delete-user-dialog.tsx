"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteOrganizationUser } from "@/features/organization-users/api"
import type { OrganizationUser } from "@/features/organization-users/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatPhone, formatText } from "@/utils/format"

/**
 * Delete an organization user — `DELETE /organization_user/{id}`.
 *
 * They stop being able to sign in immediately. Work already done stays recorded
 * against their name; disabling the account keeps that history and stops the
 * sign-in, which is the reversible alternative the note points at.
 */
export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: OrganizationUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteOrganizationUser()
  const { reset } = remove

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!user) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("organizationUsers.deleteTitle")}
      description={t("organizationUsers.deleteDescription")}
      terms={[
        { label: t("members.form.name"), value: formatText(user.name) },
        {
          label: t("organizationUsers.columns.phone"),
          value: formatPhone(user.phone),
        },
        {
          label: t("filters.attributes.organization"),
          value: formatText(user.organization?.name),
        },
        {
          label: t("organizationUsers.columns.created"),
          value: formatDate(user.createdAt),
        },
      ]}
      note={t("organizationUsers.deleteNote")}
      confirmLabel={t("organizationUsers.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(user.id, { onSuccess: () => onOpenChange(false) })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("organizationUsers.deleteFailed")}
    />
  )
}
