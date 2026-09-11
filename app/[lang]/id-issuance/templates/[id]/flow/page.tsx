import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AuthWrapper } from "@/components/auth/auth-wrapper"
import { getTranslations } from "@/i18n/server"

import { FlowBuilder } from "./components/flow-builder"

/**
 * The approval flow of one template — `GET|POST /template/flow`.
 *
 * A route rather than a modal on the gallery. Three reasons, in order of how
 * much they mattered:
 *
 *  1. A canvas needs the window. §19.13's widest dialog is 640px, which is not
 *     quite two cards side by side, and the flow builder is a 288px rail plus
 *     a pan-and-zoom surface.
 *  2. A flow is a thing you send someone. `/templates/7/flow` is a link;
 *     "open the gallery, find the template, choose Manage flow" is directions.
 *  3. Composing a chain is a task with unsaved state in it. A dialog invites
 *     the backdrop click that throws it away.
 *
 * ### Full-bleed, with no sidebar
 *
 * This started inside `AppShell` and the nav rail was wrong here. The builder
 * is already two panels — a step library and a canvas — and a third column of
 * links beside them leaves the canvas as a strip. It is also a screen with
 * unsaved state in it, so a rail of one-click exits is an invitation to lose
 * work.
 *
 * So it takes the photo editor's shape instead: the whole window, and one
 * labelled way out in the header. `AuthWrapper` still wraps it — dropping the
 * shell drops the chrome, not the route guard (docs/authentication.md §5).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("flow.metaTitle") }
}

export default async function TemplateFlowPage({
  params,
}: PageProps<"/[lang]/id-issuance/templates/[id]/flow">) {
  const { id } = await params
  const templateId = Number.parseInt(id, 10)

  // Unlike the editor — which falls back to create mode on a bad id, because
  // there is something useful to do there — a flow with no template is
  // nothing. `/template/flow/abc` would 404 on the server anyway; failing here
  // means it does so without the round trip.
  if (!Number.isFinite(templateId) || templateId <= 0) notFound()

  return (
    <AuthWrapper>
      {/* `h-svh`, not `h-full`: with no shell above it there is no sized
          ancestor to be full *of*, and the canvas has to own the viewport for
          its fit-to-view maths to mean anything. */}
      <div className="h-svh overflow-hidden bg-surface">
        <FlowBuilder templateId={templateId} />
      </div>
    </AuthWrapper>
  )
}
