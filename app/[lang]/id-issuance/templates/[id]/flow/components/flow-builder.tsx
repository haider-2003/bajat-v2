"use client"

import * as React from "react"
import axios from "axios"
import {
  AlertCircle,
  AlignCenterVertical,
  ArrowLeft,
  Layers,
  Loader2,
  RotateCcw,
  Workflow,
} from "lucide-react"

import { LoadFailed, LoadingState } from "@/components/table/load-states"
import { Button } from "@/components/ui/button"
import { useGetNodes } from "@/features/nodes/api"
import type { Node } from "@/features/nodes/types"
import { useGetTemplateFlow, useSaveTemplateFlow } from "@/features/template-flow/api"
import { useGetTemplate } from "@/features/templates/api"
import { useT } from "@/i18n/context"
import { Link } from "@/i18n/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import { buildFilter } from "@/utils/api/filters"
import type { ApiErrorBody } from "@/types/api"

import { FlowCanvas, type CanvasView } from "./flow-canvas"
import {
  hydrateLayout,
  makeStep,
  nextFreeSpot,
  orderedSteps,
  settleEnds,
  tidyLayout,
  writeLayout,
  BLOCK_H,
  CARD_W,
  TERMINAL_UID,
  TRIGGER_UID,
  type FlowLayout,
  type FlowStep,
} from "./flow-model"
import { FlowNodeCard } from "./flow-node-card"
import { NodePalette } from "./node-palette"
import { useFlowDrag, type FlowDragSource } from "./use-flow-drag"

/**
 * The template flow builder — library rail, canvas, and one save.
 *
 * Reads `GET /template/flow/{templateId}`, writes `POST /template/flow`. See
 * docs/CRUD-MIGRATION-REFERENCE.md §1.18 and the note on
 * `features/template-flow/types.ts` for why the chain is a list rather than a
 * graph.
 *
 * ### The draft is local until it is saved
 *
 * Every edit — insert, move, remove — changes a local array, not the server.
 * Nothing here writes on each gesture: a flow is composed, looked at, and then
 * committed, and a canvas that saved on every drop would leave a half-built
 * chain live to every operator issuing an identity while it was being
 * rearranged. Since `POST` *replaces* the whole flow, a per-gesture save is
 * also a per-gesture full rewrite, so there is nothing cheap about it either.
 *
 * ### Which means leaving with unsaved work has to be caught
 *
 * `beforeunload` covers closing the tab or reloading. It deliberately does not
 * cover in-app navigation: the App Router has no navigation-blocking API that
 * works with client-side transitions, so rather than a half-guard that fires
 * in some directions and not others, the header keeps the unsaved state
 * visible and one press away from being committed.
 *
 * ### The search box filters the server, the grouping is local
 *
 * `GET /node?search=` is what narrows the library, so a long list stays one
 * request rather than one big page filtered in the browser. The in-flow /
 * available split is computed from the draft, which the server has never seen
 * — so it is local by necessity, not by choice.
 */

/** Typing shouldn't fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * One page of 100 is the library. The rail is a picker, not a table: paging it
 * would mean a step you know exists is missing because it is on page two,
 * which is what the search box is for.
 */
const LIBRARY_PAGE_SIZE = 100

/** Same id twice is legal on the wire; this just counts them. */
function countByNode(steps: FlowStep[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const step of steps) {
    counts.set(step.node.id, (counts.get(step.node.id) ?? 0) + 1)
  }
  return counts
}

/** The chain as the server will see it: node ids, top to bottom. */
function chainIds(steps: FlowStep[]): number[] {
  return orderedSteps(steps).map((step) => step.node.id)
}

function sameChain(a: number[], b: number[]) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export function FlowBuilder({ templateId }: { templateId: number }) {
  const t = useT()

  /* -- Server state ---------------------------------------------------- */

  const templateQuery = useGetTemplate(templateId)
  const flowQuery = useGetTemplateFlow(templateId, {
    // A template with no flow yet is a 404 on this endpoint, and a new
    // template is the common case — retrying it four times just delays an
    // empty canvas that is already the correct answer.
    retry: false,
  })
  const saveFlow = useSaveTemplateFlow()

  const [libraryQuery, setLibraryQuery] = React.useState("")
  const librarySearch = useDebounce(libraryQuery.trim(), SEARCH_DEBOUNCE_MS)

  /**
   * The library is this template's organization's steps, not every step.
   *
   * `GET /node?organization_id={template.organization.id}` — the spec's own
   * call (docs/IDS-TEMPLATES-CARD-ACTIONS.md §6.1). Unscoped, an admin's rail
   * offers every tenant's nodes, and a flow assembled from them routes a card
   * to desks in an organization that has nothing to do with it.
   *
   * A global template owns no organization, and there `organizationId` is
   * `undefined`, which `buildFilter` drops — so the request goes out unscoped
   * and the backend scopes it by the token. That is the right answer, not a
   * gap: it is the only scope a global template has. What it must not do is
   * send the string `"undefined"`, which is what `String(...)` on a missing
   * organization produces and what the spec flags at §13.4.
   */
  const organizationId = templateQuery.data?.organization?.id

  const nodesQuery = useGetNodes(
    {
      page: 1,
      pageSize: LIBRARY_PAGE_SIZE,
      filter: buildFilter({ search: librarySearch, organizationId }),
    },
    {
      // Held until the template has answered. Firing first would fetch the
      // unscoped list, cache it under its own key, show it, and then replace
      // it once the scope arrived — a rail that briefly offers steps the
      // template cannot use, which is worse than a rail that is still loading.
      enabled: templateQuery.isSuccess,
    }
  )

  const library = React.useMemo(
    () => nodesQuery.data?.data.data ?? [],
    [nodesQuery.data]
  )

  /* -- Draft ----------------------------------------------------------- */

  /**
   * The chain being edited, and the chain the server last confirmed.
   *
   * Both are kept: the second is what "unsaved changes" is measured against
   * and what Discard restores to. Deriving the baseline from the query on
   * every render would make a background refetch silently redefine what
   * "unchanged" means, mid-edit.
   */
  /** Every placed thing: the steps, and the two ends. */
  const [draft, setDraft] = React.useState<FlowLayout>({
    steps: [],
    trigger: { x: 0, y: 0 },
    terminal: { x: 0, y: 0 },
  })
  /** Node ids only: the baseline is what the *server* holds, and it holds no
      positions. Moving a card is not an unsaved change. */
  const [baseline, setBaseline] = React.useState<number[]>([])
  /** Where the next pick from the rail lands, set by a `+` on a wire. */
  const [armed, setArmed] = React.useState<{
    index: number
    x: number
    y: number
  } | null>(null)
  const [fitSignal, setFitSignal] = React.useState(0)

  /** Lets the owner turn a drop point into canvas coordinates. */
  const viewRef = React.useRef<CanvasView | null>(null)

  /**
   * Hydrate once per server payload, and never over unsaved work.
   *
   * `hydratedRef` holds the flow row the draft was seeded from. A refetch that
   * returns the same row must not reset the canvas under someone who has been
   * editing for a minute; a genuinely new row — after a save — should.
   */
  const hydratedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (flowQuery.isPending) return

    const nodes = flowQuery.data ?? []
    // The chain itself is the identity — there is no single row id to key on,
    // because the read comes back as a list of join rows (features/
    // template-flow/types.ts). Two fetches that return the same chain in the
    // same order are the same chain, which is exactly what this needs to know.
    const stamp = nodes.map((n) => n.id).join(",")
    if (hydratedRef.current === stamp) return

    hydratedRef.current = stamp
    // Restores each card to where it was last left on this machine, falling
    // back to a straight column. See `flow-model.ts`.
    setDraft(hydrateLayout(templateId, nodes))
    setBaseline(nodes.map((n) => n.id))
    setArmed(null)
    setFitSignal((n) => n + 1)
  }, [flowQuery.isPending, flowQuery.data, templateId])

  const dirty = !sameChain(chainIds(draft.steps), baseline)
  const usedCounts = React.useMemo(() => countByNode(draft.steps), [draft.steps])

  /* -- Edits ----------------------------------------------------------- */

  /**
   * Layout is remembered per template, on this machine.
   *
   * Written on every change rather than on save, because it is not part of
   * what "save" means here — the server never sees a coordinate, so a moved
   * card is not an unsaved change and must not light up the Save button.
   */
  React.useEffect(() => {
    if (flowQuery.isPending) return
    writeLayout(templateId, draft)
  }, [draft, templateId, flowQuery.isPending])

  const addStep = React.useCallback((node: Node, x: number, y: number) => {
    setDraft((prev) =>
      settleEnds({ ...prev, steps: [...prev.steps, makeStep(node, x, y)] })
    )
    setArmed(null)
  }, [])

  /**
   * A press in the rail: into the armed spot if one was chosen, otherwise
   * below the last card.
   */
  const pickFromLibrary = React.useCallback(
    (node: Node) => {
      setDraft((prev) => {
        const spot = armed ?? nextFreeSpot(prev)
        return settleEnds({
          ...prev,
          steps: [...prev.steps, makeStep(node, spot.x, spot.y)],
        })
      })
      setArmed(null)
    },
    [armed]
  )

  /**
   * One card moved, whichever it was.
   *
   * The two ends answer to reserved uids rather than living in the step list:
   * they are not steps — never saved, never ordered — but they are placed and
   * remembered exactly like one, so the canvas moves all three through a
   * single handler.
   */
  const moveCard = React.useCallback((uid: string, x: number, y: number) => {
    setDraft((prev) => {
      if (uid === TRIGGER_UID) return { ...prev, trigger: { x, y } }
      if (uid === TERMINAL_UID) return { ...prev, terminal: { x, y } }
      return {
        ...prev,
        steps: prev.steps.map((step) =>
          step.uid === uid ? { ...step, x, y } : step
        ),
      }
    })
  }, [])

  /**
   * Reordering, for the arrow buttons: two cards exchange positions.
   *
   * Once the saved order is read off the layout, a "move up" that did not
   * move the card would be a lie — the number in the caption would change
   * while the picture stayed put. Swapping is the honest version, and it is
   * also what the drag does when you drop one card where another was.
   */
  const swapSteps = React.useCallback((aUid: string, bUid: string) => {
    setDraft((prev) => {
      const a = prev.steps.find((s) => s.uid === aUid)
      const b = prev.steps.find((s) => s.uid === bUid)
      if (!a || !b) return prev
      return {
        ...prev,
        steps: prev.steps.map((step) => {
          if (step.uid === aUid) return { ...step, x: b.x, y: b.y }
          if (step.uid === bUid) return { ...step, x: a.x, y: a.y }
          return step
        }),
      }
    })
  }, [])

  /**
   * The rail-to-canvas drag.
   *
   * It lives here because a step is picked up in the rail and put down on the
   * canvas, and those are siblings. Unlike the canvas's own card drag — which
   * is free positioning and stays local — this one only has to answer "where
   * did it land", which it does by asking the canvas to convert the drop
   * point out of screen space.
   */
  const { drag, begin, consumeClick, ghostRef } = useFlowDrag(
    React.useCallback(
      (source: FlowDragSource, clientX: number, clientY: number) => {
        if (source.kind !== "library") return
        const view = viewRef.current
        // Released outside the canvas — over the rail, or off the window.
        // That is a cancel, not an append somewhere arbitrary.
        if (!view || !view.contains(clientX, clientY)) return
        const point = view.toCanvas(clientX, clientY)
        // Dropped centred on the cursor, which is where the ghost was.
        addStep(source.node, point.x - CARD_W / 2, point.y - BLOCK_H / 2)
      },
      [addStep]
    )
  )

  /**
   * Straighten: put every card back into one column, and nothing else.
   *
   * Deliberately not a mode. An earlier pass made this a lock — tidy, then
   * refuse drags until you unlocked it — which is a second state that every
   * later change has to reason about, in exchange for a rule nobody asked
   * for. This only moves cards. The chain is untouched (the column is laid
   * out in the order that was already there), nothing is removed, nothing is
   * discarded, and every card stays draggable the instant it lands.
   */
  const straighten = React.useCallback(() => {
    setDraft((layout) => tidyLayout(layout.steps))
    setArmed(null)
    // Re-fit, because the diagram it was framed around has just changed
    // shape — and seeing the result is the whole point of pressing this.
    setFitSignal((n) => n + 1)
  }, [])

  const removeStep = React.useCallback((uid: string) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.uid !== uid),
    }))
    setArmed(null)
  }, [])

  const discard = React.useCallback(() => {
    setDraft(hydrateLayout(templateId, flowQuery.data ?? []))
    setArmed(null)
    setFitSignal((n) => n + 1)
  }, [templateId, flowQuery.data])

  /* -- Save ------------------------------------------------------------ */

  const [saveError, setSaveError] = React.useState<string | null>(null)

  const save = () => {
    setSaveError(null)
    saveFlow.mutate(
      // Top to bottom, which is the only ordering there is — see
      // `flow-model.ts`. The card positions themselves are not sent because
      // there is no field for them.
      { templateId, nodeIds: chainIds(draft.steps) },
      {
        onSuccess: () => {
          // Trust what came back over what was sent: the server may reorder,
          // deduplicate, or reject a step. Positions are re-derived from
          // storage against that confirmed order, so a card the server moved
          // does not keep the coordinate it had under the old one.
          // The create response is the saved row, not the chain, so the
          // draft stands as the confirmed state and the refetch that
          // `useCreate` triggers reconciles anything the server changed.
          const nodes = orderedSteps(draft.steps).map((step) => step.node)
          setDraft(hydrateLayout(templateId, nodes))
          setBaseline(nodes.map((n) => n.id))
          hydratedRef.current = nodes.map((n) => n.id).join(",")
        },
        onError: (error) => {
          // The mutation's own `isError` would do for a generic line, but the
          // backend's message is the only thing that says *which* step it
          // objected to, and this endpoint has no field to attach it to.
          const body = axios.isAxiosError(error)
            ? (error.response?.data as ApiErrorBody | undefined)
            : undefined
          setSaveError(
            body?.message ??
              (axios.isAxiosError(error) && !error.response
                ? t("common.cannotReachServer")
                : t("common.serverRejected"))
          )
        },
      }
    )
  }

  // Closing the tab mid-edit. See the note at the top for why in-app
  // navigation is not blocked alongside it.
  React.useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  /* -- Layout ---------------------------------------------------------- */

  // The rail is a rail at `lg` and a sheet below it — one instance either way,
  // so the search box does not lose what was typed into it when the window is
  // resized across the breakpoint.
  /** Mirrored from the canvas, only so the drag ghost can match its scale. */
  const [canvasZoom, setCanvasZoom] = React.useState(1)

  const [isDesktop, setIsDesktop] = React.useState(true)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  /**
   * Arming a gap, plus the one thing that has to happen alongside it below
   * `lg`: the rail a step is picked from is behind a button there, so opening
   * it is part of the same gesture rather than a second thing to discover.
   *
   * In the handler and not in an effect watching the armed spot. An effect
   * would also fire when the breakpoint changed under an already-armed gap,
   * which would throw the sheet open over the canvas on a window resize.
   */
  const armGap = React.useCallback(
    (next: { index: number; x: number; y: number } | null) => {
      setArmed(next)
      if (next && !isDesktop) setSheetOpen(true)
    },
    [isDesktop]
  )

  const templateTitle = templateQuery.data?.title ?? t("templates.singular")

  /**
   * A template that did not load is a rail that cannot be scoped.
   *
   * Since the node query waits on the template, a template that never answers
   * leaves it disabled — and a disabled query is pending, so the rail would
   * spin for good with nothing saying why. Its failure is the library's
   * failure, shown and retried as one.
   */
  const libraryError = templateQuery.isError
    ? templateQuery.error
    : nodesQuery.isError
      ? nodesQuery.error
      : null

  const palette = (
    <NodePalette
      nodes={library}
      organizationId={organizationId}
      // `isPending` covers the gated wait too: a disabled query is pending, so
      // the rail reads as loading from the first paint rather than flashing
      // "no steps" while the template is still in flight.
      loading={nodesQuery.isPending}
      error={libraryError}
      retrying={templateQuery.isFetching || nodesQuery.isFetching}
      onRetry={() => {
        if (templateQuery.isError) void templateQuery.refetch()
        void nodesQuery.refetch()
      }}
      query={libraryQuery}
      onQueryChange={setLibraryQuery}
      usedCounts={usedCounts}
      armedIndex={armed?.index ?? null}
      onCancelArm={() => setArmed(null)}
      onPick={(node) => {
        pickFromLibrary(node)
        if (!isDesktop) setSheetOpen(false)
      }}
      onDragStart={begin}
      consumeClick={consumeClick}
      variant={isDesktop ? "rail" : "sheet"}
      onClose={isDesktop ? undefined : () => setSheetOpen(false)}
    />
  )

  return (
    <div className="flex h-full flex-col">
      {/* Identity bar — the same 56px header every screen carries (§6.1). */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
        {/* The way out.

            This was a bare 32px glyph sitting between the sidebar trigger and
            the breadcrumb, and it read as decoration — two icons in a row at
            the start of a header are a toolbar, not an exit. It is now a
            labelled control with a border, which is the only thing on this
            side of the header that looks pressable.

            It matters more here than on other screens: the canvas fills the
            viewport, and below `lg` the sidebar collapses into a drawer, so
            for a stretch of widths this button is the *only* visible way to
            leave the route. */}
        <Link
          href="/id-issuance/templates"
          aria-label={t("flow.backToTemplates")}
          title={t("flow.backToTemplates")}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2",
            "border border-border bg-surface text-[13px] font-medium text-text-secondary",
            "shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none",
            "transition-colors duration-120 outline-none",
            "hover:border-border-strong hover:bg-muted hover:text-text",
            "focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {/* The arrow points the way out, which is the start edge in English
              and the end edge in Arabic. */}
          <ArrowLeft
            className="size-4 shrink-0 rtl:rotate-180"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="hidden sm:inline">{t("nav.templates")}</span>
        </Link>

        {/* The breadcrumb no longer repeats "Templates" — the button beside
            it says that, and says it as somewhere you can go. */}
        <nav
          aria-label={t("common.breadcrumb")}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="truncate text-sm font-medium text-text">
            {templateTitle}
          </span>
          <span className="text-sm text-text-placeholder">/</span>
          <span className="shrink-0 text-sm text-text-secondary">
            {t("flow.breadcrumb")}
          </span>
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          {/* The unsaved marker is a word, not a dot: a coloured dot beside a
              Save button says the same thing twice and neither says what is
              unsaved. */}
          {dirty && (
            <span className="hidden text-[12px] font-medium text-warning sm:inline">
              {t("flow.unsaved")}
            </span>
          )}

          {!isDesktop && (
            <Button
              variant="outline"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
            >
              <Layers data-icon="inline-start" strokeWidth={1.75} />
              {t("flow.openLibrary")}
            </Button>
          )}

          {/* Straighten.

              In the header rather than tucked into the canvas's corner
              toolbar with the zoom controls, where it was a 28px glyph past
              the percentage readout — findable only if you already knew it
              was there, and the first casualty of anything overlapping the
              bottom-right of the window.

              An `outline` button, not a `ghost` one: it does something to the
              flow, where Discard only undoes. It is never disabled — a flow
              that is already straight is straightened again to no effect,
              which is a cheaper thing to explain than a greyed-out control. */}
          <Button
            variant="outline"
            onClick={straighten}
            title={t("flow.straightenHint")}
          >
            <AlignCenterVertical data-icon="inline-start" strokeWidth={1.75} />
            <span className="hidden sm:inline">{t("flow.straighten")}</span>
          </Button>

          <Button
            variant="ghost"
            onClick={discard}
            disabled={!dirty || saveFlow.isPending}
            title={t("flow.discard")}
          >
            <RotateCcw data-icon="inline-start" strokeWidth={1.75} />
            <span className="hidden sm:inline">{t("flow.discard")}</span>
          </Button>

          {/* No `Permission` gate. The flow endpoints have no permission name
              of their own in the vocabulary this app checks against
              (features/permissions/utils.ts), and guessing one would hide the
              only Save button on the screen from everybody if the guess were
              wrong. The backend enforces it; a refusal surfaces below. */}
          <Button onClick={save} disabled={!dirty || saveFlow.isPending}>
            {saveFlow.isPending ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin"
                strokeWidth={1.75}
              />
            ) : (
              <Workflow data-icon="inline-start" strokeWidth={1.75} />
            )}
            {saveFlow.isPending ? t("common.saving") : t("flow.save")}
          </Button>
        </div>
      </header>

      {saveError && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-3 border-b border-border bg-danger-bg px-4 py-2.5"
        >
          <AlertCircle className="size-4 shrink-0 text-danger" strokeWidth={1.5} />
          <p className="min-w-0 flex-1 text-[13px] text-danger">{saveError}</p>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className={cn(
              "shrink-0 rounded-sm text-[13px] font-medium text-danger underline-offset-4",
              "outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {t("common.close")}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {isDesktop && palette}

        {/* A flow that failed to load must not read as a flow with no steps.
            "This template routes through nothing" and "we could not find out"
            are different answers, and only one of them means the canvas is
            correctly empty. A 404 is not a failure here — it is a template
            that has never had a flow, which is exactly an empty canvas. */}
        {flowQuery.isError && flowQuery.error?.response?.status !== 404 ? (
          // On the canvas ground and without the block's own box: this is the
          // whole canvas, not a card sitting on it, so it stands the way the
          // 404 does — illustration, copy, one button, nothing framing them.
          <div className="flex flex-1 items-center justify-center bg-background-subtle p-6">
            <LoadFailed
              title={t("flow.loadFailed")}
              error={flowQuery.error}
              onRetry={() => flowQuery.refetch()}
              retrying={flowQuery.isFetching}
              className="w-full max-w-lg border-0 bg-transparent"
            />
          </div>
        ) : flowQuery.isPending ? (
          // Same footing as the failure beside it: the canvas ground, no
          // box, the card being written where the flow is about to be.
          <div className="flex flex-1 items-center justify-center bg-background-subtle p-6">
            <LoadingState
              label={t("flow.loading")}
              className="w-full max-w-lg border-0 bg-transparent"
            />
          </div>
        ) : (
          <FlowCanvas
            layout={draft}
            onCardMove={moveCard}
            onRemove={removeStep}
            armed={armed}
            onArm={armGap}
            onSwap={swapSteps}
            onZoomChange={setCanvasZoom}
            fitSignal={fitSignal}
            templateTitle={templateTitle}
            viewRef={viewRef}
          />
        )}
      </div>

      {/* The card under the cursor.

          A real `FlowNodeCard`, not a token standing in for one: what is
          being moved is that card, and a small chip flying over a canvas of
          full-size cards reads as a different object being dropped onto the
          flow rather than as the step itself changing places.

          Three things make it track properly:

           - `position: fixed`, mounted here rather than inside the canvas, so
             it is never clipped by the canvas's `overflow-hidden` — a drag
             that starts in the rail has to be visible before it arrives.
           - `translate` is written imperatively by `useFlowDrag`, once per
             frame, so following the cursor costs no React renders. Nothing
             in this JSX sets it; see the note in that file.
           - `scale(canvasZoom)` so it is exactly the size of the cards it is
             flying over, and `translate(-50%, -50%)` to sit centred on the
             pointer. Percentages there resolve against the unscaled box,
             which — with the default centre transform-origin — lands the
             scaled card centred on the cursor at any zoom.

          `pointer-events-none` is load-bearing rather than tidy: the drop
          target is found with `elementFromPoint`, and a ghost under the
          cursor would be the only thing it ever found. */}
      {drag && (
        <div
          ref={ghostRef}
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-[70] will-change-transform"
        >
          <div
            style={{ transform: `translate(-50%, -50%) scale(${canvasZoom})` }}
            className="opacity-90 drop-shadow-[0_16px_32px_rgba(0,0,0,0.35)]"
          >
            <FlowNodeCard
              variant="step"
              color={drag.source.node.color}
              caption={t("flow.createStep")}
              title={drag.source.node.name}
              detailLabel={t("flow.sectionStage")}
              detailBody={
                drag.source.node.organization?.name ??
                t("flow.stepSubtitleFallback")
              }
            />
          </div>
        </div>
      )}

      {/* The rail as a sheet, below `lg`. §18.6 — it comes in from the start
          edge, over a backdrop that dismisses it. */}
      {!isDesktop && sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-(--overlay)"
          />
          <div className="absolute inset-y-0 start-0 flex">{palette}</div>
        </div>
      )}
    </div>
  )
}
