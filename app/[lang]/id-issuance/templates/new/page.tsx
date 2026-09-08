import type { Metadata } from "next"

import { PhotoEditor } from "@/components/photo-editor/editor"
import { getTranslations } from "@/i18n/server"

/**
 * New card template — docs/photo-editor-spec.md §4.1, create mode.
 *
 * No `AppShell`: the editor is a full-viewport tool, and the sidebar would take
 * 248px away from the canvas. It is reached from the templates list, and its
 * own back arrow returns there.
 *
 * The editor is a client component but renders fine on the server — nothing
 * touches `window` during render, only in effects — so it needs no `dynamic`
 * wrapper. The QR canvas paints on mount.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("templates.newMetaTitle") }
}

export default function NewTemplatePage() {
  return <PhotoEditor mode="create" />
}
