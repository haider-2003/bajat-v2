import type { Metadata } from "next"

import { PhotoEditor } from "@/components/photo-editor/editor"
import { getTranslations } from "@/i18n/server"

/**
 * Edit an existing card template — docs/photo-editor-spec.md §4.1, edit mode.
 *
 * §4.1 requires `id > 0 && !isNaN(id)`; anything else falls back to create mode
 * rather than erroring, because a mistyped URL should still leave the operator
 * somewhere they can work.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("templates.editMetaTitle") }
}

export default async function EditTemplatePage({
  params,
}: PageProps<"/[lang]/id-issuance/templates/[id]/edit">) {
  const { id } = await params
  const parsed = Number.parseInt(id, 10)
  const valid = Number.isFinite(parsed) && parsed > 0

  return valid ? (
    <PhotoEditor mode="edit" templateId={parsed} />
  ) : (
    <PhotoEditor mode="create" />
  )
}
