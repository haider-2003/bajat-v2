"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteBranch } from "@/features/branches/api"
import { branchNodeIds, type Branch } from "@/features/branches/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatText } from "@/utils/format"

/**
 * Delete a branch — `DELETE /branch/{id}`.
 *
 * Its staff lose the branch they sign in against, and any branch below it is
 * left without a parent. The dialog restates the branch and points at disabling
 * as the reversible alternative.
 */
export function DeleteBranchDialog({
  branch,
  open,
  onOpenChange,
}: {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteBranch()
  const { reset } = remove

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!branch) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("branches.deleteTitle")}
      description={t("branches.deleteDescription")}
      terms={[
        { label: t("branches.columns.name"), value: formatText(branch.name) },
        {
          label: t("branches.columns.parent"),
          value: branch.parent?.name ?? t("branches.topLevel"),
        },
        {
          label: t("branches.columns.nodes"),
          value: t("branches.nodeCount", { count: branchNodeIds(branch).length }),
        },
        {
          label: t("branches.columns.created"),
          value: formatDate(branch.createdAt),
        },
      ]}
      note={t("branches.deleteNote")}
      confirmLabel={t("branches.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(branch.id, { onSuccess: () => onOpenChange(false) })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("branches.deleteFailed")}
    />
  )
}
