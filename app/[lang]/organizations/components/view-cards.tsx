"use client"

import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import type { Organization } from "@/features/organizations/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE, formatText } from "@/utils/format"

import { OrganizationActions } from "./columns"

/**
 * Card view — DESIGN.md §8.12 and §9. Also the responsive fallback below `lg`.
 */
function Detail({ label, value }: { label: string; value: string }) {
  if (value === EMPTY_VALUE) return null
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd className="truncate text-[13px] text-text-secondary">{value}</dd>
    </div>
  )
}

function OrganizationCard({
  organization,
  onEdit,
  onDelete,
}: {
  organization: Organization
  onEdit: (organization: Organization) => void
  onDelete: (organization: Organization) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const website = organization.website?.trim()

  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-subtle text-[13px] font-semibold text-text-muted">
          {organization.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied logo on an arbitrary host
            <img
              src={organization.logo}
              alt=""
              className="size-full object-contain"
            />
          ) : (
            formatText(organization.name).slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-text">
            {formatText(organization.name)}
          </h3>
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="mt-0.5 block truncate text-xs text-accent-violet underline-offset-4 hover:underline rtl:text-end"
            >
              {website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border-subtle pt-4">
        <SoftBadge tone={organization.isEnabled ? "success" : "danger"}>
          {organization.isEnabled ? t("common.enabled") : t("common.disabled")}
        </SoftBadge>
        <SoftBadge
          tone={organization.isJoinRequestsEnabled ? "success" : "neutral"}
        >
          {t("organizations.columns.joinRequests")}:{" "}
          {organization.isJoinRequestsEnabled
            ? t("organizations.joinOpen")
            : t("organizations.joinClosed")}
        </SoftBadge>
      </div>

      <dl className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
        <Detail
          label={t("organizations.form.descriptionLabel")}
          value={formatText(organization.description)}
        />
        <Detail
          label={t("organizations.columns.created")}
          value={formatDate(organization.createdAt)}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="font-mono text-xs tracking-[0.02em] text-text-placeholder">
          #{organization.id}
        </span>
        <OrganizationActions
          organization={organization}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}

export function CardView({
  table,
  onEdit,
  onDelete,
  emptyTitle,
  emptyHint,
}: {
  table: TanTable<Features, Organization>
  onEdit: (organization: Organization) => void
  onDelete: (organization: Organization) => void
  emptyTitle: string
  emptyHint?: string
}) {
  const organizations = table.getRowModel().rows.map((row) => row.original)

  if (organizations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {organizations.map((organization) => (
        <OrganizationCard
          key={organization.id}
          organization={organization}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
