"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Building2, CalendarDays, KeyRound, Trash2, User } from "lucide-react"

import { DateCell, HeadCell, TextCell } from "@/components/table/cells"
import { RowActions } from "@/components/table/row-actions"
import type { ApiKey } from "@/features/api-keys/types"
import { useT } from "@/i18n/context"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"

import { SecretCell } from "./secret-cell"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * A factory rather than a constant, because the action cell needs callbacks
 * the screen owns: which key is being renamed or deleted is the screen's
 * state, not the row's. Memoize the result — a fresh array every render
 * remounts every cell.
 *
 * ### The name leads even though the secret is the value
 *
 * The opposite call to the black list, and for the opposite reason. There, the
 * phone is what the backend acts on and the name is a label, so the number
 * leads. Here the secret is never *read* off the table — it is masked, and the
 * question this screen gets asked is "which integration is this and can I
 * delete it". That question is answered by the name, so the name leads.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 */
export function createColumns(
  t: Translator,
  onRename: (apiKey: ApiKey) => void,
  onDelete: (apiKey: ApiKey) => void
): ColumnDef<Features, ApiKey, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: () => (
        <HeadCell icon={KeyRound}>{t("apiKeys.columns.name")}</HeadCell>
      ),
      // What identifies the row, so it leads and never drops (§8.6).
      cell: ({ row }) => <TextCell value={row.original.name} emphasis="primary" />,
      size: 240,
      meta: { priority: 110, label: t("apiKeys.columns.name") },
    },
    {
      accessorKey: "key",
      header: () => (
        <HeadCell icon={KeyRound}>{t("apiKeys.columns.secret")}</HeadCell>
      ),
      // Masked by default — see the note in secret-cell.tsx.
      cell: ({ row }) => (
        <SecretCell secret={row.original.key} name={row.original.name} />
      ),
      size: 260,
      enableSorting: false,
      meta: { priority: 100, label: t("apiKeys.columns.secret") },
    },
    {
      id: "user",
      accessorFn: (row) => row.user?.name ?? "",
      header: () => <HeadCell icon={User}>{t("apiKeys.columns.createdBy")}</HeadCell>,
      // Who to ask before deleting it. The one field on this row that says
      // whether the integration behind the key is still someone's problem.
      cell: ({ row }) => <TextCell value={row.original.user?.name} />,
      size: 180,
      meta: { priority: 70, label: t("apiKeys.columns.createdBy") },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>{t("filters.attributes.organization")}</HeadCell>
      ),
      // Assigned server-side from the token, never chosen — so for an
      // org-scoped account this repeats one name down the page, and the screen
      // hides it in that case.
      cell: ({ row }) => <TextCell value={row.original.organization?.name} />,
      size: 200,
      meta: { priority: 50, label: t("filters.attributes.organization") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("apiKeys.columns.created")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 60, label: t("apiKeys.columns.created") },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ApiKeyActions
            apiKey={row.original}
            onRename={onRename}
            onDelete={onDelete}
          />
        </div>
      ),
      size: 150,
      enableSorting: false,
      meta: { priority: 99, label: t("common.actions") },
    },
  ]
}

/**
 * The row's verbs — Rename on the surface, Delete behind the overflow (§15.5).
 *
 * The default action is labelled **Rename**, not Edit: the name is the only
 * mutable field on this resource, and "Edit" on a row whose secret is right
 * there implies the secret is what opens. It is not, and it cannot be.
 *
 * Exported so the card view renders the identical control rather than a second
 * set that could drift from this one.
 */
export function ApiKeyActions({
  apiKey,
  onRename,
  onDelete,
  className,
}: {
  apiKey: ApiKey
  onRename: (apiKey: ApiKey) => void
  onDelete: (apiKey: ApiKey) => void
  className?: string
}) {
  const t = useT()

  return (
    <RowActions
      label={apiKey.name}
      editLabel={t("common.rename")}
      onEdit={() => onRename(apiKey)}
      items={[
        {
          key: "delete",
          label: t("common.delete"),
          icon: Trash2,
          destructive: true,
          onSelect: () => onDelete(apiKey),
        },
      ]}
      className={className}
    />
  )
}
