import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"

export default function Home() {
  return (
    <AppShell>
      {/* Identity bar — 56px, sticky, 1px bottom hairline (§6.2).
          The drawer trigger is the first item in the row (§18.3), so it never
          overlaps the title the way a floating button did. */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <span className="truncate text-sm font-medium text-text">Home</span>
      </header>

      <div className="p-4 sm:p-6">
        <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
          Overview
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Sidebar scaffold is in place. Content panel is a placeholder.
        </p>
      </div>
    </AppShell>
  )
}
