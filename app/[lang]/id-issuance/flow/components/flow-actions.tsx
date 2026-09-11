"use client"

import { ClipboardCheck, Trash2 } from "lucide-react"

import { RowActions, type RowActionItem } from "@/components/table/row-actions"
import { useAuthStore } from "@/features/auth/store"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"

/** The path of a card's review page. */
export function flowHref(id: number | string) {
  return `/id-issuance/flow/${id}`
}

/**
 * What can be done to one row of the inbox.
 *
 * ### Review, not Open, and gated on `update-identity`
 *
 * The destination is an *action* page — approve or reject at this node —
 * not a record to read, so the verb is Review and the gate is the one for
 * changing a card, not the one for seeing it (docs/IDS-FLOW-EXPORTS-ROUTES.md
 * §3.3). A reviewer without the grant sees the segment disabled: the row is
 * in their inbox, and a silent dead row would read as a bug.
 *
 * A real `Link`, middle-clickable, for the same reason the ledger's Open is.
 * Delete is hidden without `delete-identity`, as everywhere.
 */
export type FlowActionHandlers = {
  onDelete: (card: IDCard) => void
}

export function FlowActions({
  card,
  handlers,
  className,
}: {
  card: IDCard
  handlers: FlowActionHandlers
  className?: string
}) {
  const t = useT()
  const can = useAuthStore((s) => s.can)

  const items: RowActionItem[] = []
  if (can("delete-identity")) {
    items.push({
      key: "delete",
      label: t("common.delete"),
      icon: Trash2,
      destructive: true,
      onSelect: () => handlers.onDelete(card),
    })
  }

  return (
    <RowActions
      label={t("ids.cardNumber", { id: card.id })}
      primary={
        can("update-identity")
          ? { label: t("idsFlow.review"), icon: ClipboardCheck, href: flowHref(card.id) }
          : { label: t("idsFlow.review"), icon: ClipboardCheck, disabled: true }
      }
      items={items}
      className={className}
    />
  )
}
