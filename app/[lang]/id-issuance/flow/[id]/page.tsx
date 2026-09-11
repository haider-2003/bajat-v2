import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { LocaleLink } from "@/i18n/link"
import { getTranslations } from "@/i18n/server"

import { FlowReview } from "./components/flow-review"

/**
 * Reviewing one card at its node — docs/IDS-FLOW-EXPORTS-ROUTES.md §3.5.
 *
 * A route for the same reasons the ledger's detail is one, plus the one
 * that matters most here: a review is the thing a reviewer is *sent*. The
 * link in a message is this page.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/id-issuance/flow/[id]">): Promise<Metadata> {
  const t = await getTranslations()
  const { id } = await params
  return { title: t("idsFlow.detailMetaTitle", { id }) }
}

export default async function FlowReviewPage({
  params,
}: PageProps<"/[lang]/id-issuance/flow/[id]">) {
  const t = await getTranslations()
  const { id } = await params
  const cardId = Number.parseInt(id, 10)

  if (!Number.isFinite(cardId) || cardId <= 0) notFound()

  return (
    <AppShell>
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
            href="/id-issuance/flow"
            className="truncate text-sm text-text-secondary outline-none hover:text-text focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nav.idFlow")}
          </LocaleLink>
          <span className="text-sm text-text-placeholder">/</span>
          <span className="truncate text-sm font-medium text-text">
            {t("ids.cardNumber", { id: cardId })}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        <FlowReview id={cardId} />
      </div>
    </AppShell>
  )
}
