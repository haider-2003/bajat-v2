"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDeleteNode } from "@/features/nodes/api"
import type { Node } from "@/features/nodes/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { formatText } from "@/utils/format"

/**
 * Delete a workflow node — `DELETE /node/{id}`.
 *
 * ### Why this one is confirmed, and what the confirmation says
 *
 * Deleting a node is not deleting a row: it removes a *step* from every branch
 * that handles it and from the flow of every template that routes through it,
 * and the identities currently sitting on that step have to be routed again by
 * hand. None of that is visible from the table, so the dialog says it.
 *
 * The row is restated rather than asked about generically, because on a list
 * of similar steps — "Review", "Second review" — the name and the colour are
 * the only things that distinguish the row about to go from the one beside it.
 */
export function DeleteNodeDialog({
  node,
  open,
  onOpenChange,
}: {
  /** `null` between openings — nothing renders. */
  node: Node | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteNode()
  const { reset } = remove

  // A failure from the last row must not greet the next one.
  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!node) return null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("nodes.deleteTitle")}
      description={t("nodes.deleteDescription")}
      terms={[
        { label: t("nodes.columns.name"), value: formatText(node.name) },
        // The other half of how a node is recognised. Two steps with similar
        // names are told apart on the board by colour alone.
        { label: t("nodes.columns.color"), value: node.color?.toUpperCase() ?? "" },
        {
          label: t("filters.attributes.organization"),
          value: formatText(node.organization?.name),
        },
        { label: t("nodes.columns.created"), value: formatDate(node.createdAt) },
      ]}
      note={t("nodes.deleteNote")}
      confirmLabel={t("nodes.deleteAction")}
      pendingLabel={t("common.deleting")}
      onConfirm={() =>
        remove.mutate(node.id, { onSuccess: () => onOpenChange(false) })
      }
      pending={remove.isPending}
      error={remove.isError ? remove.error : undefined}
      errorFallback={t("nodes.deleteFailed")}
    />
  )
}
