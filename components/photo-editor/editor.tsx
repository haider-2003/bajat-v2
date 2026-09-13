"use client"

import * as React from "react"
import axios from "axios"
import { AlertTriangle, Check, Info, Loader2 } from "lucide-react"

import { TooltipProvider } from "@/components/ui/tooltip"
import { useT } from "@/i18n/context"
import { useLocaleRouter } from "@/i18n/navigation"
import {
  useCreateTemplate,
  useGetTemplate,
  useResetTemplateSequences,
  useUpdateTemplate,
} from "@/features/templates/api"
import {
  buildDesignAssets,
  buildTemplatePayload,
  downloadJson,
  exportFileName,
  serializeExport,
  templateToEditor,
} from "@/features/templates/editor-io"
import { useEditorStore } from "@/features/templates/editor-store"
import type { EditorVariable } from "@/features/templates/editor-types"
import type { ApiErrorBody } from "@/types/api"
import { cn } from "@/lib/utils"

import { ActionBar, DocBar, TEMPLATES_HREF, ZoomBar } from "./chrome"
import { ResetSequenceDialog, SettingsDialog } from "./dialogs"
import { Panel, PanelRail } from "./panels"
import { PropertyBar } from "./property-bar"
import { Stage } from "./stage"

/**
 * The card-template editor — composition root.
 *
 * See docs/photo-editor-spec.md. The pieces:
 *
 *   stage.tsx         the two stacked faces, drag/snap, Alt measurements
 *   property-bar.tsx  the contextual bar, rebuilt per element kind (§13)
 *   panels.tsx        the five authoring panels and the rail
 *   panel-variables   the variable system (§10) — the domain half of the tool
 *   dialogs.tsx       template metadata (§15) and the sequence reset (§10.7)
 *
 * State lives in `features/templates/editor-store.ts`, which is module-global,
 * so §4.2's first instruction is the one thing this component must not skip:
 * **reset before anything else**, or a second visit inherits the previous
 * template's variables.
 *
 * ### Persistence
 *
 * `features/templates/editor-io.ts` owns both directions of the JSON (§19,
 * §20); this file owns only *when* they run. Three moments:
 *
 *   load    edit mode, once `GET /template/{id}` resolves — §16.1's inverse
 *   save    `POST /template` or `PUT /template/{id}`, behind two gates (§16.1)
 *   export  the same document, to a file, with the metadata alongside (§16.2)
 *
 * A successful create does **not** navigate to `/templates/{id}/edit`. It flips
 * this editor into edit mode in place, exactly as §16.1 step 6 specifies:
 * routing would remount the component, `reset()` would wipe the document, and
 * the design would have to be fetched back from the server it was just sent to.
 */

type Toast = { id: number; message: string; tone: "ok" | "bad" | "info" }

/** An Axios rejection, reduced to one line somebody can act on. */
function readError(error: unknown, fallback: string, offline: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const body = error.response?.data as ApiErrorBody | undefined
  const first = Object.values(body?.errors ?? {})[0]?.[0]
  // `first` and `body.message` are the server's own wording and pass through
  // untranslated — only the strings this app writes itself are localised.
  return first ?? body?.message ?? (error.response ? fallback : offline)
}

export function PhotoEditor({
  templateId,
  mode,
}: {
  templateId?: number
  mode: "create" | "edit"
}) {
  const t = useT()
  // `/id-issuance/templates` is not a route on its own — every path lives
  // under `/[lang]`.
  const router = useLocaleRouter()
  const reset = useEditorStore((s) => s.reset)
  const setTemplateId = useEditorStore((s) => s.setTemplateId)
  const hydrate = useEditorStore((s) => s.hydrate)
  const hasConfigured = useEditorStore((s) => s.hasConfigured)
  const hasQR = useEditorStore((s) => s.hasQR())
  const markSaved = useEditorStore((s) => s.markSaved)
  const setPanel = useEditorStore((s) => s.setPanel)

  const setSafeArea = useEditorStore((s) => s.setSafeArea)

  const [settingsOpen, setSettingsOpen] = React.useState(mode === "create")
  const [resetTarget, setResetTarget] = React.useState<EditorVariable | null>(null)
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [busy, setBusy] = React.useState(false)

  const templateQuery = useGetTemplate(mode === "edit" ? templateId : undefined)
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const resetSequences = useResetTemplateSequences()

  /** Nothing may be edited while the design is still being fetched. */
  const loading = mode === "edit" && templateQuery.isPending && !!templateId
  const saving = busy || createTemplate.isPending || updateTemplate.isPending

  const root = React.useRef<HTMLDivElement>(null)
  const free = React.useRef<HTMLDivElement>(null)

  /**
   * §4.2 — reset on the way in, **and on the way out**.
   *
   * The cleanup is the half that was missing, and the reason a second visit to
   * /new opened with the last template's title and description already in the
   * settings form.
   *
   * Resetting on mount cannot fix that on its own, because "on mount" is not
   * early enough. A `useState` initializer in a child runs while the tree is
   * being built, and every effect in that tree runs afterwards — so a child
   * that seeds itself from the store reads whatever the store holds *before*
   * this effect gets to clear it. `SettingsForm` seeds exactly like that
   * (`useState(config)`) and create mode opens it on the very first render, so
   * it captured the previous editor's config and kept it; the store was
   * cleared a moment later, but the draft had already been taken.
   *
   * The store is module-global and outlives this component, so the fix is for
   * the component to leave nothing behind: wipe it on unmount and the next
   * editor's children seed from a blank store no matter how early they read
   * it. That also stops the previous design flashing onto the canvas for a
   * frame, which was the same race with a different symptom.
   *
   * The mount-side reset stays. It costs nothing and it still covers the case
   * the cleanup cannot — a `templateId` that changes without a remount.
   */
  React.useEffect(() => {
    reset()
    if (templateId) setTemplateId(templateId)
    // A panel that opens over the card is right on a desktop and wrong on a
    // tablet, where it *is* the card's space. Below the drawer breakpoint the
    // editor opens on the work instead.
    if (window.matchMedia("(max-width: 1023px)").matches) setPanel(null)

    return () => reset()
  }, [reset, setTemplateId, setPanel, templateId])

  /**
   * §20 — the loaded design, once per template *and per document*.
   *
   * "Already loaded" is read off the store, not remembered in a ref: the
   * store holds this template's design exactly when `hasConfigured` is true
   * for this id, and `reset()` clears both together. The ref this replaced
   * outlived the reset it was meant to track, which was a bug with a very
   * specific shape — an editor that opened empty on every *return* visit to
   * a template, and only in development. Under Strict Mode's mount → unmount
   * → mount, pass one hydrated and marked the id, the simulated unmount ran
   * the reset above and wiped the document, and pass two saw the mark and
   * skipped. A first visit was fine because the row arrived from the network
   * after all that; a return visit was not, because the row was already in
   * the query cache and arrived on the first pass.
   *
   * Reading the store here rather than subscribing to it is deliberate: this
   * must not re-run because the operator drew something. A background
   * refetch hands back the same row, the store still says it holds this id,
   * and nothing is thrown away.
   *
   * `row.id !== templateId` guards the other direction — a row for some
   * other template must never be poured into this one's editor.
   */
  React.useEffect(() => {
    const row = templateQuery.data
    if (!row || row.id !== templateId) return
    const held = useEditorStore.getState()
    if (held.hasConfigured && held.templateId === row.id) return
    hydrate({ ...templateToEditor(row), templateId: row.id })
  }, [templateQuery.data, templateId, hydrate])

  /**
   * Report the free area — the middle band's spacer — to the store.
   *
   * The stage is full-bleed on purpose (panning and zooming should use the
   * whole window), so it cannot work out on its own which part of itself is
   * under a panel. This is that missing half: one measured rectangle, from
   * which `fitView` and centred zoom get a centre worth having.
   */
  React.useLayoutEffect(() => {
    const el = free.current
    const box = root.current
    if (!el || !box) return

    const measure = () => {
      const area = el.getBoundingClientRect()
      const outer = box.getBoundingClientRect()
      setSafeArea({
        top: Math.max(0, Math.round(area.top - outer.top)),
        left: Math.max(0, Math.round(area.left - outer.left)),
        right: Math.max(0, Math.round(outer.right - area.right)),
        bottom: Math.max(0, Math.round(outer.bottom - area.bottom)),
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    observer.observe(box)
    return () => observer.disconnect()
  }, [setSafeArea])

  const notify = React.useCallback((message: string, tone: "ok" | "bad" = "ok") => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 3400)
  }, [])

  /* §12 — window-level shortcuts, ignored while a field has focus. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /input|textarea|select/i.test(target.tagName)) return
      if (target?.isContentEditable) return

      const state = useEditorStore.getState()
      const selected = state.selected()

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selected) return
        e.preventDefault()
        state.removeElement(selected.id)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        if (!selected) return
        e.preventDefault()
        state.duplicateElement(selected.id)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (!selected || selected.locked) return

      const step = e.shiftKey ? 10 : 1
      const { width, height } = state.doc
      const clampX = (v: number) => Math.max(0, Math.min(v, width - selected.width))
      const clampY = (v: number) => Math.max(0, Math.min(v, height - selected.height))

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        state.pushHistory(`${selected.id}:nudge`)
        state.updateElement(selected.id, { x: clampX(selected.x - step) })
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        state.pushHistory(`${selected.id}:nudge`)
        state.updateElement(selected.id, { x: clampX(selected.x + step) })
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        state.pushHistory(`${selected.id}:nudge`)
        state.updateElement(selected.id, { y: clampY(selected.y - step) })
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        state.pushHistory(`${selected.id}:nudge`)
        state.updateElement(selected.id, { y: clampY(selected.y + step) })
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /**
   * §4.3 — nothing leaves the editor before the metadata exists.
   *
   * A refusal that opens the form it is asking for, rather than a disabled
   * button the operator has to reverse-engineer.
   */
  const configured = (): boolean => {
    if (hasConfigured) return true
    setSettingsOpen(true)
    return false
  }

  /**
   * §16.1 — the only structural validation there is, and it gates the **save**
   * alone.
   *
   * Export is deliberately not behind it: a file is not a published template,
   * and refusing to let somebody take a work-in-progress design off the screen
   * because it has no QR yet protects nothing.
   *
   * It earns real treatment rather than a disabled button: refuse, open the QR
   * panel, and say the rule. Three things from one failure, and the operator
   * never has to work out where to go next.
   */
  const hasQrElement = (): boolean => {
    if (hasQR) return true
    setPanel("qr")
    notify(t("editor.qrRequired"), "bad")
    return false
  }

  /**
   * Create, or update — decided by whether an id exists, not by `mode`.
   *
   * A create that has already succeeded leaves `templateId` set, so the second
   * press of Save updates the row the first one made instead of cutting a
   * duplicate template. That is the whole reason the id and not the prop is the
   * discriminator.
   */
  const save = async () => {
    if (saving || !configured() || !hasQrElement()) return

    // `doc` is read here rather than subscribed to: a component that re-renders
    // on every pixel of every drag is the one thing a canvas editor cannot
    // afford, and the save only needs the document as it is at the click.
    const { doc, variables: vars, config: meta, templateId: id } = useEditorStore.getState()

    setBusy(true)
    try {
      const assets = await buildDesignAssets(doc, vars)
      const payload = buildTemplatePayload(doc, vars, meta, assets)

      if (id) {
        await updateTemplate.mutateAsync({ id, data: payload })
        markSaved()
        notify(t("editor.saveUpdated"), "ok")
      } else {
        const created = await createTemplate.mutateAsync(payload)
        // §16.1 step 6 — edit mode from here on, without leaving the page.
        setTemplateId(created.id)
        markSaved()
        notify(t("editor.saveCreated", { count: vars.length }), "ok")
      }
    } catch (error) {
      notify(
        readError(error, t("editor.saveFailed"), t("common.cannotReachServer")),
        "bad"
      )
    } finally {
      setBusy(false)
    }
  }

  /** §16.2 — the same document, to a file, with the metadata beside it. */
  const exportJson = async () => {
    if (saving || !configured()) return

    const { doc, variables: vars, config: meta } = useEditorStore.getState()

    setBusy(true)
    try {
      const assets = await buildDesignAssets(doc, vars)
      const name = exportFileName(meta.title)
      downloadJson(name, serializeExport(doc, vars, meta, assets))
      notify(t("editor.exported", { file: name }), "ok")
    } catch {
      notify(t("editor.exportFailed"), "bad")
    } finally {
      setBusy(false)
    }
  }

  /**
   * §10.7 — `PUT /template/{id}/reset`.
   *
   * The dialog already refuses to arm on an unsaved template, so an id exists
   * by the time this runs; the check is here because `templateId` is state and
   * a guard that reads the value it acts on is worth more than a comment.
   */
  const resetSequence = () => {
    const id = useEditorStore.getState().templateId
    if (!id) return
    resetSequences.mutate(id, {
      onSuccess: () => {
        setResetTarget(null)
        notify(t("editor.sequenceReset"), "bad")
      },
      onError: (error) =>
        notify(
          readError(error, t("editor.resetFailed"), t("common.cannotReachServer")),
          "bad"
        ),
    })
  }

  return (
    <TooltipProvider delay={300}>
      <div ref={root} className="relative h-svh min-h-[480px] overflow-hidden bg-[var(--editor-ground)]">
        {/* The stage paints its own dot grid, because the grid has to travel
            and scale with the pan/zoom transform rather than with the frame. */}
        <Stage />

        {/* The chrome, as one layout rather than four absolutes.
     
            Everything used to be positioned from an edge with a hard-coded
            offset — the rail at `top-[76px]` because that is where the top row
            happened to end. That number is a lie the moment the row wraps to
            two lines on a narrow window, so the chrome is a column now: a top
            row, a middle band, a bottom row, laid out by flex. The rail sits
            below the top row because it is *after* it, at any width.

            The layer ignores pointer events; each slab takes them back.

            ### Why 48 and not 60

            Everything that leaves the page — a dialog's backdrop, a dropdown,
            a tooltip — is portalled to `<body>` at `z-50`. This layer is a
            sibling of that portal, so at 60 it sat *over* all of them: the
            settings dialog dimmed the canvas and left the rail, the panel and
            the toolbar bright and clickable behind its own backdrop, and a
            font menu opened from the property bar disappeared under the
            variables panel. 48 clears the stage's guides and measurements
            (40–47) and stays under the portal layer, which is the whole
            ordering: work, chrome, then anything modal over both. */}
        <div className="pointer-events-none absolute inset-0 z-48 flex flex-col gap-4 p-4">
          {/* Three lanes: document, contextual properties, actions.
     
              They keep their intrinsic widths (the document slab truncates its
              title first) and the property bar fits itself to what is left —
              see property-bar.tsx. Below `lg` there is no "what is left" worth
              having, so the bar wraps onto its own full-width line rather than
              being squeezed to nothing: `order` puts the actions back up beside
              the document, and the lane goes underneath. */}
          <div className="flex flex-none flex-wrap items-start gap-2 lg:gap-3">
            <DocBar />
            <PropertyBar />
            <ActionBar
              onOpenSettings={() => setSettingsOpen(true)}
              onExport={exportJson}
              onSave={save}
            />
          </div>

          {/* The middle band: the left chrome column, and the free space beside
              it. That spacer is measured, not decorative — it is what tells the
              stage where the card can actually be centred (§5.1). */}
          <div className="flex min-h-0 flex-1 gap-4">
            {/* `relative` is what the drawer positions against below `lg`. */}
            <div className="relative flex min-h-0 items-start gap-4">
              <PanelRail />
              <Panel onResetSequence={setResetTarget} onNotify={notify} />
            </div>
            <div ref={free} className="min-w-0 flex-1" aria-hidden />
          </div>

          <div className="flex flex-none justify-end">
            <ZoomBar />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-5 left-1/2 z-[140] flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px]",
                "bg-[var(--editor-float)] shadow-[var(--editor-shadow-pop)]",
                toast.tone === "bad" ? "text-danger" : "text-text"
              )}
            >
              {toast.tone === "bad" ? (
                <AlertTriangle className="size-4 shrink-0" strokeWidth={1.9} />
              ) : toast.tone === "ok" ? (
                <Check className="size-4 shrink-0 text-success" strokeWidth={2.2} />
              ) : (
                <Info className="size-4 shrink-0 text-info" strokeWidth={1.8} />
              )}
              {toast.message}
            </div>
          ))}

          {/* A load that failed — stated rather than toasted.

              The editor stays usable on purpose (§4.1 prefers a working blank
              editor to an error page), but "blank" and "blank because the
              fetch failed" are different situations and only one of them is a
              reason not to start drawing over a template that already exists.
              So it persists until the retry succeeds, and it carries the
              retry, which a toast could not. */}
          {templateQuery.isError && (
            <div
              role="alert"
              className={cn(
                "pointer-events-auto flex items-center gap-2.5 rounded-xl py-2.5 pe-1.5 ps-3.5 text-[13px] text-danger",
                "bg-[var(--editor-float)] shadow-[var(--editor-shadow-pop)]"
              )}
            >
              <AlertTriangle className="size-4 shrink-0" strokeWidth={1.9} />
              {t("editor.loadFailed")}
              <button
                type="button"
                onClick={() => templateQuery.refetch()}
                className={cn(
                  "shrink-0 rounded-[9px] px-2 py-1 text-[12.5px] font-medium text-text-secondary",
                  "transition-colors duration-120 hover:bg-[var(--editor-hover)] hover:text-text",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                {t("common.retry")}
              </button>
            </div>
          )}
        </div>

        {/* The two moments the editor is not the operator's to touch: the
            design is still arriving, or it is on its way out.

            One veil for both, above the chrome and below the portal layer, so a
            dialog opened before the save started still sits over it. It takes
            pointer events deliberately — a drag begun mid-save would be applied
            to a document that has already been serialized. */}
        {(loading || saving) && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "absolute inset-0 z-49 flex items-center justify-center",
              // `bg-editor-ground` rather than `bg-[var(--editor-ground)]`: the
              // token is registered in the theme, which is what makes the `/55`
              // opacity modifier resolve at all.
              "bg-editor-ground/55 backdrop-blur-[1px]",
              // The load veil is opaque enough to hide a blank document that is
              // about to be replaced; the save veil only has to stop the hands.
              loading && "bg-editor-ground/80"
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] text-text",
                "bg-[var(--editor-float)] shadow-[var(--editor-shadow-pop)]"
              )}
            >
              <Loader2 className="size-4 shrink-0 animate-spin text-accent-violet" strokeWidth={2} />
              {loading ? t("editor.loading") : t("editor.saving")}
            </span>
          </div>
        )}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        // §4.3 — in create mode the form is the gate and cannot be dismissed.
        dismissible={mode === "edit" || hasConfigured}
        onCancel={() => router.push(TEMPLATES_HREF)}
      />

      <ResetSequenceDialog
        variable={resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
        busy={resetSequences.isPending}
        onConfirm={resetSequence}
      />
    </TooltipProvider>
  )
}
