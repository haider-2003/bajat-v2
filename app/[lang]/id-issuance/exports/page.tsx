import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { ExportsClient, ExportsCount } from "./components/exports-client"

/**
 * Export History — the queue of export jobs
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §4).
 *
 * Rows come from `GET /export`. Each one was started by the Export action on
 * a template card; this is where the finished file is picked up. Read-only:
 * no primary action, and nothing on the rows retries or deletes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("exports.metaTitle") }
}

export default async function ExportsPage() {
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
            {t("nav.exportHistory")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
            {t("nav.exportHistory")}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t("exports.countBefore")}
            <ExportsCount />
            {t("exports.countAfter")}
          </p>
        </div>

        <ExportsClient />
      </div>
    </AppShell>
  )
}
