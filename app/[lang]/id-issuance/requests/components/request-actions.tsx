"use client"

import { IdCard, Trash2 } from "lucide-react"

import { RowActions, type RowActionItem } from "@/components/table/row-actions"
import { useAuthStore } from "@/features/auth/store"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"

/** The path of a card's own page. */
export function requestHref(id: number | string) {
  return `/id-issuance/requests/${id}`
}

/**
 * What can be done to one row of the ledger.
 *
 * ### Open is a link, not a handler
 *
 * Every other screen opens its record in a sheet over the table, so the row
 * click is the whole of "read this" and the action control holds only verbs.
 * A card is different: its record is a *page* — it has operations, an audit
 * trail and a print sheet on it, and it is the thing a reviewer sends someone
 * a link to. So the surface segment is a real `Link`, middle-clickable, the
 * way the templates screen's Edit is; the row click goes to the same place
 * for the pointer.
 *
 * ### Gates: disabled where the verb is the point, hidden where it is not
 *
 * Open goes *disabled* without `show-identity` rather than vanishing — it is
 * what the row is for, and a clerk who cannot open it needs to know the grant
 * is missing, not wonder whether the feature shipped. Delete is *hidden*
 * without `delete-identity`, the way every screen hides its destructive verb.
 * Like every client-side gate it is display only — the server is the
 * authority (docs/IDS-FLOW-EXPORTS-ROUTES.md §1.6).
 *
 * ### The screen owns the dialogs
 *
 * `onDelete` is passed in rather than owned here: the confirmation is mounted
 * once by the client, not once per row.
 */
export type RequestActionHandlers = {
  onDelete: (card: IDCard) => void
}

export function RequestActions({
  card,
  handlers,
  className,
}: {
  card: IDCard
  handlers: RequestActionHandlers
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
        can("show-identity")
          ? { label: t("common.open"), icon: IdCard, href: requestHref(card.id) }
          : { label: t("common.open"), icon: IdCard, disabled: true }
      }
      items={items}
      className={className}
    />
  )
}
