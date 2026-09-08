import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { PrinterClient, PrintQueueCount } from "./components/printer-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("printer.metaTitle") }
}

export default async function PrinterPage() {
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
            {t("nav.printer")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
            {t("nav.printer")}
          </h1>
          {/* Split around the live count — see the note on App Users. */}
          <p className="mt-1 text-[13px] text-text-muted">
            {t("printer.countBefore")}
            <PrintQueueCount />
            {t("printer.countAfter")}
          </p>
        </div>

        {/* No primary action beside the title: nothing is *created* here. A
            card reaches this screen by being approved somewhere else, and the
            only verbs are printing it and moving it along. */}
        <PrinterClient />
      </div>
    </AppShell>
  )
}
