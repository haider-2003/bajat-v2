import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"

import { PrinterClient, PrintQueueCount } from "./components/printer-client"

export const metadata = {
  title: "Printer · Bajat",
}

export default function PrinterPage() {
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
          <span className="truncate text-sm font-medium text-text">Printer</span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {/* Page title block (§6.9) */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
            Printer
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {/* Reads the same query as the table, so it shares the cache
                rather than firing a second request. */}
            <PrintQueueCount /> cards approved and waiting on the press.
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
