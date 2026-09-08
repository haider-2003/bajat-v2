import type { Metadata } from "next"

import { getTranslations } from "@/i18n/server"

import { BrandPanel } from "./brand-panel"
import { LoginForm } from "./login-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return {
    title: t("auth.metaTitle"),
    description: t("auth.metaDescription"),
  }
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
