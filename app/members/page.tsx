import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"

import { CreateMemberDialog } from "./components/create-member-dialog"
import { MembersClient, MembersCount } from "./components/members-client"

export const metadata = {
  title: "App Users · Bajat",
}

export default function MembersPage() {
  return (
    <AppShell>
      {/* Identity bar (§6.1) */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <span className="hidden text-sm text-text-secondary sm:inline">
            Operations
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">App Users</span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              App Users
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {/* Reads the same query as the table, so it shares the cache
                  rather than firing a second request. */}
              <MembersCount /> members across your organizations.
            </p>
          </div>

          {/* §4.6.2 — the primary action right-aligns to the opposite gutter,
              on the title's own row rather than in the filter toolbar below. */}
          <CreateMemberDialog />
        </div>

        <MembersClient />
      </div>
    </AppShell>
  )
}
