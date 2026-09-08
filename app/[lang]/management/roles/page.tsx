import type { Metadata } from "next"

import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { CreateRoleDialog } from "@/components/roles/role-dialog"
import { RoleCount, RoleList } from "@/components/roles/role-list"
import { getTranslations } from "@/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("roles.adminMetaTitle") }
}

export default async function AdminRolesPage() {
  const t = await getTranslations()

  return (
    <AppShell>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <nav
          aria-label={t("common.breadcrumb")}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="hidden text-sm text-text-secondary sm:inline">
            {t("nav.sections.management")}
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">
            {t("nav.adminRoles")}
          </span>
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.015em] text-text sm:text-xl">
              {t("nav.adminRoles")}
            </h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {t("roles.countBefore")}
              <RoleCount scope="admin" />
              {t("roles.adminCountAfter")}
            </p>
          </div>

          <CreateRoleDialog scope="admin" />
        </div>

        <RoleList scope="admin" />
      </div>
    </AppShell>
  )
}
