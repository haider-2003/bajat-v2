import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { FlowClient, FlowCount } from "./components/flow-client"

/**
 * ID Flow — the approval inbox (docs/IDS-FLOW-EXPORTS-ROUTES.md §3).
 *
 * Rows come from `GET /identity/node`: the cards parked at an approval step
 * the signed-in user is assigned to. Scoping is the token's, so there is no
 * "whose inbox" control — this page is always *mine*.
 *
 * No primary action: work arrives here by being issued from a template whose
 * flow names one of my nodes, and leaves by being reviewed.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("idsFlow.metaTitle") }
}

export default async function FlowPage() {
  const t = await getTranslations()

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
          <span className="truncate text-sm font-medium text-text">
            {t("nav.idFlow")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
            {t("nav.idFlow")}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t("idsFlow.countBefore")}
            <FlowCount />
            {t("idsFlow.countAfter")}
          </p>
        </div>

        <FlowClient />
      </div>
    </AppShell>
  )
}
