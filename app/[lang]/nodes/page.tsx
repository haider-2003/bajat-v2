import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { CreateNodeDialog } from "./components/node-dialog"
import { NodesClient, NodesCount } from "./components/nodes-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("nodes.metaTitle") }
}

export default async function NodesPage() {
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
            {t("nav.nodes")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {t("nav.nodes")}
            </h1>
            {/* Split around the live count — the numeral is client-rendered so
                the rest of the sentence can stay on the server. */}
            <p className="mt-1 text-[13px] text-text-muted">
              {t("nodes.countBefore")}
              <NodesCount />
              {t("nodes.countAfter")}
            </p>
          </div>

          {/* §4.6.2 — the primary action right-aligns to the opposite gutter,
              on the title's own row rather than in the filter toolbar below. */}
          <CreateNodeDialog />
        </div>

        <NodesClient />
      </div>
    </AppShell>
  )
}
