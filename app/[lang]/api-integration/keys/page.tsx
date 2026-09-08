import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { CreateApiKeyDialog } from "./components/api-key-dialog"
import { ApiKeysClient, ApiKeysCount } from "./components/api-keys-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("apiKeys.metaTitle") }
}

export default async function ApiKeysPage() {
  const t = await getTranslations()

  return (
    <AppShell>
      {/* Identity bar (§6.1) */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <nav
          aria-label={t("common.breadcrumb")}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="hidden text-sm text-text-secondary sm:inline">
            {t("nav.apiIntegration")}
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">
            {t("nav.apiKeys")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {t("nav.apiKeys")}
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {t("apiKeys.countBefore")}
              <ApiKeysCount />
              {t("apiKeys.countAfter")}
            </p>
          </div>

          {/* §4.6.2 — the primary action right-aligns to the opposite gutter,
              on the title's own row rather than in the filter toolbar below.

              No `Permission` gate: `/access_key` ships no permission names of
              its own (docs/CRUD-MIGRATION-REFERENCE.md §4.7), so a gate here
              would be checking a name the backend never grants and the button
              would never render for anyone. */}
          <CreateApiKeyDialog />
        </div>

        <ApiKeysClient />
      </div>
    </AppShell>
  )
}
