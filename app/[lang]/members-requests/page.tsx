import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { CreateRequestDialog } from "./components/create-request-dialog"
import { RequestsClient, RequestsCount } from "./components/requests-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("requests.metaTitle") }
}

export default async function MembersRequestsPage() {
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
            {t("requests.breadcrumbParent")}
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">
            {t("nav.requests")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {t("nav.membersRequests")}
            </h1>
            {/* Split around the live count for the same reason App Users is:
                `t()` returns a string, which cannot contain a React element. */}
            <p className="mt-1 text-[13px] text-text-muted">
              {t("requests.countBefore")}
              <RequestsCount />
              {t("requests.countAfter")}
            </p>
          </div>

          {/* §4.6.2 — the primary action right-aligns to the opposite gutter,
              on the title's own row rather than in the filter toolbar below:
              creating a request is not a way of looking at the list. */}
          <CreateRequestDialog />
        </div>

        <RequestsClient />
      </div>
    </AppShell>
  )
}
