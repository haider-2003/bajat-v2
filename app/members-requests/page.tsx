import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"

import { RequestsClient } from "./requests-client"
import { requests } from "./data"

export const metadata = {
  title: "Members Requests · Bajat",
}

export default function MembersRequestsPage() {
  return (
    <AppShell>
      {/* Identity bar (§6.1) */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <span className="hidden text-sm text-text-secondary sm:inline">
            Members
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">Requests</span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              Members Requests
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {requests.length} ID requests awaiting review, printing, and
              delivery.
            </p>
          </div>
        </div>

        <RequestsClient />
      </div>
    </AppShell>
  )
}
