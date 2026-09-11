"use client"

import {
  Building2,
  Copy,
  IdCard,
  Pencil,
  RotateCcw,
  Trash2,
  Workflow,
} from "lucide-react"

import { RowActions, type RowActionItem } from "@/components/table/row-actions"
import { useAuthStore } from "@/features/auth/store"
import type { Template, TemplateScope } from "@/features/templates/types"
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
 * ### The verbs depend on which tab the row is on
 *
 * docs/CARD-CREATE-ASSIGN-GALLERY.md §5.6. A row on the **organization** tab
 * is a card an identity is issued from, so its verbs are the issuing ones:
 * Edit, Issue, Manage flow, Duplicate, Reset sequences, Delete. A row on the
 * **public** tab is a blueprint owned by nobody — it cannot be issued from,
 * has no flow and no sequences to reset — so it has exactly one verb for an
 * organization user, *adopt it*, and for an admin, who authors the catalogue,
 * Edit on the surface with *assign it* and Delete behind the menu.
 *
 * The surface segment is therefore not always Edit: `RowActions` takes a
 * `primary` for the case where a screen's main verb is something else, and on
 * the public tab an organization user's main verb is the clone.
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
 * `RowActions` takes `href` on the primary for exactly this. When the grant is
 * missing it becomes a disabled button instead: a link cannot be disabled.
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
 *
 * ### Gates: disabled where the verb is the point, hidden where it is not
 *
 * docs/CARD-CREATE-ASSIGN-GALLERY.md §7 is the matrix. Edit, Issue and
 * Manage flow go *disabled* without their grants rather than vanishing: they
 * are what a template is for, and a clerk who cannot do them needs to know the
 * button is real and the grant is missing, not wonder whether the feature
 * shipped. Delete is *hidden* without `delete-template`, the way every other
 * screen hides its destructive verb — nobody needs to be told they cannot
 * remove something. On the public tab, Edit and Delete are hidden for anyone
 * who is not an admin: the catalogue is not theirs to change, and their copy
 * (once adopted) is where those verbs live.
 *
 * `<Permission>` is not used because a `DropdownMenuItem` is described by data
 * here rather than by a wrapped child; `can()` is the same check the component
 * makes. Like every client-side gate it is display only — the server is the
 * authority.
 *
 * Adopting a public card has **no client gate** — the backend defines
 * `clone-template` but the reference client never checked it (spec §4.2), so
 * the server's refusal is surfaced by the dialog rather than a hidden button.
 */
export type TemplateActionHandlers = {
  onPreview: (template: Template) => void
  onIssue: (template: Template) => void
  /** Clone — into the same organization from the org tab, into one from the public tab. */
  onDuplicate: (template: Template) => void
  onResetSequences: (template: Template) => void
  onDelete: (template: Template) => void
}

export function TemplateActions({
  template,
  scope,
  handlers,
  className,
}: {
  template: Template
  /** Which tab the row is on — decides the verbs. */
  scope: TemplateScope
  handlers: TemplateActionHandlers
  className?: string
}) {
  const t = useT()
  const router = useLocaleRouter()
  const can = useAuthStore((s) => s.can)
  const isAdmin = useAuthStore((s) => s.user?.type === "admin")

  const editHref = `/id-issuance/templates/${template.id}/edit`

  if (scope === "global") {
    // Organization user: the only thing they can do with a public card is
    // take a copy, so that is the whole control — one segment, no menu.
    if (!isAdmin) {
      return (
        <RowActions
          label={template.title}
          primary={{
            label: t("templates.useForOrganization"),
            icon: Copy,
            onSelect: () => handlers.onDuplicate(template),
          }}
          className={className}
        />
      )
    }

    // Admin: authors the catalogue, so Edit stays on the surface (when the
    // grant allows) and the hand-off to an organization sits behind it.
    const items: RowActionItem[] = [
      {
        key: "assign",
        label: t("templates.assignToOrganization"),
        icon: Building2,
        onSelect: () => handlers.onDuplicate(template),
      },
    ]
    if (can("delete-template")) {
      items.push({
        key: "delete",
        label: t("templates.delete"),
        icon: Trash2,
        destructive: true,
        onSelect: () => handlers.onDelete(template),
      })
    }

    return (
      <RowActions
        label={template.title}
        primary={
          can("update-template")
            ? { label: t("common.edit"), icon: Pencil, href: editHref }
            : {
                label: t("templates.assignToOrganization"),
                icon: Building2,
                onSelect: () => handlers.onDuplicate(template),
              }
        }
        // With Assign already on the surface it is not repeated in the menu.
        items={can("update-template") ? items : items.slice(1)}
        className={className}
      />
    )
  }

  // Organization tab — the issuing verbs.
  const canEdit = can("update-template") && can("show-template")

  const items: RowActionItem[] = [
    {
      key: "issue",
      label: t("issue.action"),
      icon: IdCard,
      disabled: !can("create-identity"),
      onSelect: () => handlers.onIssue(template),
    },
    {
      key: "flow",
      label: t("templates.manageFlow"),
      icon: Workflow,
      disabled: !(can("update-flow") && can("show-flow")),
      onSelect: () => router.push(`/id-issuance/templates/${template.id}/flow`),
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
  ]
  if (can("delete-template")) {
    items.push({
      key: "delete",
      label: t("templates.delete"),
      icon: Trash2,
      destructive: true,
      onSelect: () => handlers.onDelete(template),
    })
  }

  return (
    <RowActions
      label={template.title}
      primary={
        canEdit
          ? { label: t("common.edit"), icon: Pencil, href: editHref }
          : { label: t("common.edit"), icon: Pencil, disabled: true }
      }
      items={items}
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
  scope,
  handlers,
  className,
}: {
  template: Template
  scope: TemplateScope
  handlers: TemplateActionHandlers
  className?: string
}) {
  return (
    <TemplateActions
      template={template}
      scope={scope}
      handlers={handlers}
      className={className}
    />
  )
}
