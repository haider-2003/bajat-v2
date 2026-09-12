import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { OverviewClient } from "./components/overview-client"

/**
 * Home — the analytics overview, and the first screen after sign-in.
 *
 * It lives in a `(overview)` route group rather than at `app/[lang]/page.tsx`
 * so it can keep its components in a sibling `components/` folder, exactly
 * like every other screen in this app. A parenthesised segment is stripped
 * from the URL, so this still resolves to `/[lang]`.
 *
 * The shell and the title block are server-rendered; everything that reads
 * data is the one client island below.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("overview.metaTitle") }
}

export default async function OverviewPage() {
  const t = await getTranslations()

  return (
    <AppShell>
      {/* Identity bar — 56px, sticky, 1px bottom hairline (§6.2). */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <span className="truncate text-sm font-medium text-text">
          {t("nav.home")}
        </span>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9). */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
            {t("overview.title")}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t("overview.subtitle")}
          </p>
        </div>

        <OverviewClient />
      </div>
    </AppShell>
  )
}
