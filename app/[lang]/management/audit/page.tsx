import type { Metadata } from "next"

import { ComingSoon } from "@/components/layout/coming-soon"
import { getTranslations } from "@/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("auditLog.metaTitle") }
}

/**
 * Audit log — not built yet. The sidebar lists it, so this holds its place
 * with the coming-soon state instead of letting the click land on a 404;
 * the real screen replaces this file when it ships.
 */
export default function AuditLogPage() {
  return (
    <ComingSoon
      sectionKey="nav.sections.management"
      titleKey="nav.auditLog"
      bodyKey="auditLog.soon"
    />
  )
}
