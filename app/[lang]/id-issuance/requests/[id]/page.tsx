import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { LocaleLink } from "@/i18n/link"
import { getTranslations } from "@/i18n/server"

import { RequestDetail } from "./components/request-detail"

/**
 * One issued card — `GET /identity/{id}` (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4).
 *
 * A route rather than the record sheet the other lists open, for the reasons
 * the flow builder gives: a card has operations on it (a status decision, the
 * hand-off to the printer, per-field edits), an artwork stage that wants the
 * height, and it is the thing a reviewer sends someone a link to.
 *
 * Inside the shell, unlike the editor and the flow builder: nothing here has
 * unsaved state that a stray click on the rail would throw away, and the
 * ledger it came from is one link over.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/id-issuance/requests/[id]">): Promise<Metadata> {
  const t = await getTranslations()
  const { id } = await params
  return { title: t("ids.detailMetaTitle", { id }) }
}

export default async function RequestPage({
  params,
}: PageProps<"/[lang]/id-issuance/requests/[id]">) {
  const t = await getTranslations()
  const { id } = await params
  const cardId = Number.parseInt(id, 10)

  // `/identity/abc` would 404 on the server anyway; failing here does so
  // without the round trip.
  if (!Number.isFinite(cardId) || cardId <= 0) notFound()

  return (
    <AppShell>
      {/* Identity bar (§6.1) — the trail back to the ledger is a real link. */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <nav
          aria-label={t("common.breadcrumb")}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="hidden text-sm text-text-secondary sm:inline">
            {t("nav.sections.idIssuance")}
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <LocaleLink
            href="/id-issuance/requests"
            className="truncate text-sm text-text-secondary outline-none hover:text-text focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nav.requests")}
          </LocaleLink>
          <span className="text-sm text-text-placeholder">/</span>
          <span className="truncate text-sm font-medium text-text">
            {t("ids.cardNumber", { id: cardId })}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        <RequestDetail id={cardId} />
      </div>
    </AppShell>
  )
}
