import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { PaymentsClient, PaymentsCount } from "./components/payments-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("payments.metaTitle") }
}

export default async function PaymentsPage() {
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
            {t("nav.sections.operations")}
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">
            {t("nav.payments")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9). No primary action: this screen is a record
            of what the payment provider did, and there is nothing here to
            create — see the note in payments-client.tsx. */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
            {t("nav.payments")}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t("payments.countBefore")}
            <PaymentsCount />
            {t("payments.countAfter")}
          </p>
        </div>

        <PaymentsClient />
      </div>
    </AppShell>
  )
}
