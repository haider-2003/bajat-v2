"use client"

import { Copy, RotateCcw, Trash2, Workflow } from "lucide-react"

import { RowActions } from "@/components/table/row-actions"
import type { Template } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import { useLocaleRouter } from "@/i18n/navigation"

/**
 * What can be done to one template.
 *
 * ### This used to be two different controls, and now it is one
 *
 * The gallery carried a row of tinted tiles — a blue Preview, a violet
 * Duplicate, a grey overflow — and the table carried a bordered split control,
 * and neither looked like anything else in the product. The tinted row was the
 * better-looking of the two and still the wrong answer: it was a colour
 * vocabulary that existed on exactly one screen, so a template's actions were
 * something you had to learn separately from every other row's.
 *
 * Both surfaces now render `RowActions`, which is what the other ten screens
 * render. What is left that is specific to templates is the *verbs*, which is
 * all this file is.
 *
 * ### Preview is not one of them
 *
 * It was in the tile row, on the artwork, *and* in the overflow menu — one
 * action, three ways to reach it, in a space small enough to see all three at
 * once. Opening a template is now what clicking its row does, and in the
 * gallery, what clicking its artwork does. Neither needs a button, and the
 * menu is for what is not already on the surface.
 *
 * ### Edit is a link, not a handler
 *
 * Editing a template is a navigation to the editor, so the surface segment is
 * a real `Link` — it middle-clicks and opens in a new tab like any other.
 * `RowActions` takes `editHref` for exactly this.
 *
 * ### The screen owns the dialogs
 *
 * Handlers are passed in rather than owned here: the dialogs are mounted once
 * by the client, not once per row. Thirty rows each holding a mounted `Dialog`
 * is thirty portals waiting to be opened.
 *
 * ### Manage flow is the exception that pushes instead
 *
 * It is a navigation, like Edit, and it would rather be a real `Link` for the
 * same reason — middle-click, open in a new tab. `RowActionItem` only carries
 * an `onSelect`, because every other menu entry in the app opens a dialog, so
 * this one routes by hand. Worth widening that type the second a screen needs
 * two of these; one is not yet a pattern.
 */
export type TemplateActionHandlers = {
  onPreview: (template: Template) => void
  onDuplicate: (template: Template) => void
  onResetSequences: (template: Template) => void
  onDelete: (template: Template) => void
}

export function TemplateActions({
  template,
  handlers,
  className,
}: {
  template: Template
  handlers: TemplateActionHandlers
  className?: string
}) {
  const t = useT()
  const router = useLocaleRouter()

  return (
    <RowActions
      label={template.title}
      editHref={`/id-issuance/templates/${template.id}/edit`}
      editLabel={t("common.edit")}
      items={[
        {
          key: "flow",
          label: t("templates.manageFlow"),
          icon: Workflow,
          onSelect: () =>
            router.push(`/id-issuance/templates/${template.id}/flow`),
        },
        {
          key: "duplicate",
          label: t("templates.duplicate"),
          icon: Copy,
          onSelect: () => handlers.onDuplicate(template),
        },
        {
          key: "reset",
          label: t("templates.resetSequences"),
          icon: RotateCcw,
          onSelect: () => handlers.onResetSequences(template),
        },
        {
          key: "delete",
          label: t("templates.delete"),
          icon: Trash2,
          destructive: true,
          onSelect: () => handlers.onDelete(template),
        },
      ]}
      className={className}
    />
  )
}

/**
 * The gallery tile's footer.
 *
 * The same control as the table's, given the full width of the tile. It is a
 * separate export only so the gallery can say so at the call site — there is
 * no second set of verbs behind it, which is the whole point.
 */
export function TemplateActionRow({
  template,
  handlers,
  className,
}: {
  template: Template
  handlers: TemplateActionHandlers
  className?: string
}) {
  return (
    <TemplateActions
      template={template}
      handlers={handlers}
      className={className}
    />
  )
}
