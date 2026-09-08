import type { Metadata } from "next"
import { Plus } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { LocaleLink } from "@/i18n/link"
import { getTranslations } from "@/i18n/server"

import {
  TemplatesClient,
  TemplatesCount,
} from "./components/templates-client"

/**
 * Templates — the card designs an identity is issued from.
 *
 * Rows come from `GET /template`, paged and filtered by the server
 * (docs/api-types.md § templates). The editor at `./new` and `./[id]/edit`
 * authors the design; this screen is everything around it — finding one,
 * copying one, retiring one.
 *
 * The layout is the standard list-page shell: identity bar, title block with
 * the one primary action, then the client. What is different is underneath —
 * see the note on `TemplatesClient` for why this list opens as a gallery.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("templates.metaTitle") }
}

export default async function TemplatesPage() {
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
            {t("nav.templates")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {t("nav.templates")}
            </h1>
            {/* Split around the live count — see the note on App Users. */}
            <p className="mt-1 text-[13px] text-text-muted">
              {t("templates.countBefore")}
              <TemplatesCount />
              {t("templates.countAfter")}
            </p>
          </div>

          {/* §4.6.2 — the primary action right-aligns to the opposite gutter,
              on the title's own row rather than in the filter toolbar below.
              A link, not a dialog: a new template is authored in the editor,
              which is a full-viewport tool.

              `LocaleLink` rather than `next/link`: every route lives under
              `/[lang]`, so a bare `/id-issuance/templates/new` matches nothing. */}
          <Button
            size="lg"
            className="h-11 w-full sm:h-9 sm:w-auto"
            nativeButton={false}
            render={<LocaleLink href="/id-issuance/templates/new" />}
          >
            <Plus data-icon="inline-start" strokeWidth={1.75} />
            {t("templates.new")}
          </Button>
        </div>

        <TemplatesClient />
      </div>
    </AppShell>
  )
}
