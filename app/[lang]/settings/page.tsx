import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { getTranslations } from "@/i18n/server"

import { AccountSection } from "./components/account-section"
import { AppearanceSection } from "./components/appearance-section"
import { LanguageSection } from "./components/language-section"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("settings.metaTitle") }
}

/**
 * Settings.
 *
 * A single scrolling column of section cards rather than a tabbed shell: with
 * a handful of sections, tabs hide settings behind a click and give each one a
 * route to keep in sync, while a column lets ⌘F find anything on the page.
 * Each section carries an `id`, so `/settings#appearance` still deep-links.
 *
 * Server-rendered; only the interactive sections are client components. To add
 * one, drop another `<SettingsSection>` into the stack below.
 */
export default async function SettingsPage() {
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
          <span className="truncate text-sm font-medium text-text">
            {t("nav.settings")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Settings is text-heavy, so it caps rather than stretching (§4.2).
            The title block sits inside the same container as the cards, so
            both share one left edge (§4.6). */}
        <div className="mx-auto flex max-w-[820px] flex-col gap-4">
          {/* Page title block (§6.9) */}
          <div className="mb-2">
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {t("nav.settings")}
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {t("settings.subtitle")}
            </p>
          </div>

          {/* Language sits above Appearance: it changes every other word on
              this page, so someone who cannot read the page needs to reach it
              without scrolling past a section they cannot read either. */}
          <LanguageSection />
          <AppearanceSection />
          {/* Account last: it is reference, not a control — nothing on it
              changes the page you are reading it on. */}
          <AccountSection />
        </div>
      </div>
    </AppShell>
  )
}
