import { AuthWrapper } from "@/components/auth/auth-wrapper"

import { Sidebar } from "./sidebar"
import { ShellProvider } from "./shell-context"

/**
 * App shell — DESIGN.md §5.3 Variant B ("white sidebar", inverted tones).
 *
 * The sidebar runs the full viewport height against a grey ground; the content
 * region is white and sits flush beside it, separated by a single 1px seam.
 * No radius and no surrounding gutter, so the window reads as two halves —
 * grey left, white right — rather than a white card floating on grey.
 *
 * Wrapped in `AuthWrapper`, the client-side route guard: no session means a
 * redirect to /login (docs/authentication.md §5).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthWrapper>
      <ShellProvider>
        <div className="flex h-svh overflow-hidden bg-background">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto border-border bg-surface lg:border-l">
            {children}
          </main>
        </div>
      </ShellProvider>
    </AuthWrapper>
  )
}
