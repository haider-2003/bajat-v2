"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteOrganization } from "@/features/organizations/api"
import type { Organization } from "@/features/organizations/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatText } from "@/utils/format"

/**
 * Delete an organization — `DELETE /organization/{id}`.
 *
 * The heaviest delete in the app: its members, branches, staff accounts,
 * templates and issued identities go with it, and nothing is recoverable. The
 * dialog says so, restates the tenant, and points at disabling as the reversible
 * alternative.
 */
export function DeleteOrganizationDialog({
  organization,
  open,
  onOpenChange,
}: {
  organization: Organization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteOrganization()
  const { reset } = remove

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!organization) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("organizations.deleteTitle")}
      description={t("organizations.deleteDescription")}
      terms={[
        {
          label: t("organizations.columns.name"),
          value: formatText(organization.name),
        },
        {
          label: t("organizations.columns.website"),
          value: formatText(organization.website),
          wide: true,
        },
        {
          label: t("organizations.columns.created"),
          value: formatDate(organization.createdAt),
        },
      ]}
      note={t("organizations.deleteNote")}
      confirmLabel={t("organizations.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(organization.id, {
          onSuccess: () => onOpenChange(false),
        })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("organizations.deleteFailed")}
    />
  )
}
