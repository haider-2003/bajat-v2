import type { Metadata } from "next"

import { BrandPanel } from "./brand-panel"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Sign in · Bajat",
  description: "Sign in to the Bajat identity management dashboard.",
}

/**
 * Login — split screen (DESIGN.md §18.1).
 *
 * Form on the left, dark brand panel on the right. Below `lg` the panel drops
 * away and the form takes the full width. No app shell: sign-in sits outside
 * the sidebar layout.
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <LoginForm />
      <BrandPanel />
    </div>
  )
}
