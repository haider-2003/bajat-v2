import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { EndpointSection } from "./components/endpoint-section"
import { SignatureSection } from "./components/signature-section"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("webhooks.metaTitle") }
}

/**
 * Webhooks.
 *
 * Not a table. `/webhook` is a **singleton** — one organization has one
 * endpoint, `GET` reads it and `PUT` upserts it, and there is no collection to
 * page through (docs/CRUD-MIGRATION-REFERENCE.md §1.14). So this screen takes
 * the settings shape: a capped column of section cards, which is what the app
 * already uses for "configure one thing" (see `/settings`).
 *
 * The endpoint comes before the signature because the signature does not exist
 * until an endpoint has been saved — reading top to bottom is the order the
 * two are actually set up in.
 */
export default async function WebhooksPage() {
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
            {t("nav.webhooks")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Text-heavy, so it caps rather than stretching (§4.2). The title
            block sits inside the same container as the cards, so both share
            one left edge (§4.6). */}
        <div className="mx-auto flex max-w-[820px] flex-col gap-4">
          {/* Page title block (§6.9) */}
          <div className="mb-2">
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {t("webhooks.title")}
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {t("webhooks.subtitle")}
            </p>
          </div>

          <EndpointSection />
          <SignatureSection />
        </div>
      </div>
    </AppShell>
  )
}
