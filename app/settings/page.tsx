import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"

import { AppearanceSection } from "./components/appearance-section"

export const metadata = {
  title: "Settings · Bajat",
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
export default function SettingsPage() {
  return (
    <AppShell>
      {/* Identity bar (§6.1) */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text">Settings</span>
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
              Settings
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              Preferences for this workspace and this device.
            </p>
          </div>

          <AppearanceSection />
        </div>
      </div>
    </AppShell>
  )
}
