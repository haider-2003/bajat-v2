import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { RequestsClient, RequestsCount } from "./components/requests-client"

/**
 * Requests — the ledger of every identity ever issued
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §2).
 *
 * Rows come from `GET /identity`, paged and filtered by the server. This is
 * the *status* axis of a card: where it is on the global ladder from
 * `PENDING` to `DELIVERED`. The other axis — which approval step it is
 * parked at — is the ID Flow screen beside it in the sidebar.
 *
 * No primary action beside the title: nothing is *created* here. A card is
 * issued from a template (the Templates screen's Issue action), and the only
 * verbs on this screen are opening one and removing one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("ids.metaTitle") }
}

export default async function RequestsPage() {
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
            {t("nav.sections.idIssuance")}
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">
            {t("nav.requests")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
            {t("nav.requests")}
          </h1>
          {/* Split around the live count — see the note on App Users. */}
          <p className="mt-1 text-[13px] text-text-muted">
            {t("ids.countBefore")}
            <RequestsCount />
            {t("ids.countAfter")}
          </p>
        </div>

        <RequestsClient />
      </div>
    </AppShell>
  )
}
