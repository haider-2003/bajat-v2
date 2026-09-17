import type { Metadata } from "next"

import { ComingSoon } from "@/components/layout/coming-soon"
import { getTranslations } from "@/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("delivery.metaTitle") }
}

/**
 * Delivery — not built yet. The sidebar lists it, so this holds its place
 * with the coming-soon state instead of letting the click land on a 404;
 * the real screen replaces this file when it ships.
 */
export default function DeliveryPage() {
  return (
    <ComingSoon
      sectionKey="nav.sections.operations"
      titleKey="nav.delivery"
      bodyKey="delivery.soon"
    />
  )
}
