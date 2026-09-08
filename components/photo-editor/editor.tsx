"use client"

import * as React from "react"
import { AlertTriangle, Check, Info } from "lucide-react"

import { TooltipProvider } from "@/components/ui/tooltip"
import { useT } from "@/i18n/context"
import { useLocaleRouter } from "@/i18n/navigation"
import { useEditorStore } from "@/features/templates/editor-store"
import type { EditorVariable } from "@/features/templates/editor-types"
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
 * ### What is not wired yet
 *
 * Save and export are local — there is no `features/templates/api.ts` in this
 * repo yet, and inventing endpoints would be worse than an honest stub. The
 * QR-presence gate (§16.1) *is* enforced, because it is a rule about the
 * document rather than about transport.
 */

type Toast = { id: number; message: string; tone: "ok" | "bad" | "info" }

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
  const hasConfigured = useEditorStore((s) => s.hasConfigured)
  const hasQR = useEditorStore((s) => s.hasQR())
  const variables = useEditorStore((s) => s.variables)
  const config = useEditorStore((s) => s.config)
  const markSaved = useEditorStore((s) => s.markSaved)
  const setPanel = useEditorStore((s) => s.setPanel)

  const setSafeArea = useEditorStore((s) => s.setSafeArea)

  const [settingsOpen, setSettingsOpen] = React.useState(mode === "create")
  const [resetTarget, setResetTarget] = React.useState<EditorVariable | null>(null)
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const root = React.useRef<HTMLDivElement>(null)
  const free = React.useRef<HTMLDivElement>(null)

  /** §4.2 — always first, and exactly once. */
  React.useEffect(() => {
    reset()
    if (templateId) setTemplateId(templateId)
    // A panel that opens over the card is right on a desktop and wrong on a
    // tablet, where it *is* the card's space. Below the drawer breakpoint the
    // editor opens on the work instead.
    if (window.matchMedia("(max-width: 1023px)").matches) setPanel(null)
    // Loading an existing template's design belongs here, once the templates
    // API exists. Until then edit mode opens an empty document with its id set.
  }, [reset, setTemplateId, setPanel, templateId])

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
   * §16.1 — the only structural validation there is.
   *
   * So it earns real treatment: refuse the save, open the QR panel, and say the
   * rule. Three things from one failure, and the operator never has to work out
   * where to go next.
   */
  const save = () => {
    if (!hasConfigured) {
      setSettingsOpen(true)
      return
    }
    if (!hasQR) {
      setPanel("qr")
      notify(t("editor.qrRequired"), "bad")
      return
    }
    markSaved()
    notify(t("editor.savedLocally", { count: variables.length }), "ok")
  }

  const exportJson = () => {
    notify(
      // The filename stem falls back to a slug, not a sentence, so it stays
      // filesystem-safe in either language.
      `${config.title || "id-card-template"}-${new Date().toISOString().slice(0, 10)}.json`,
      "ok"
    )
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

            The layer ignores pointer events; each slab takes them back. */}
        <div className="pointer-events-none absolute inset-0 z-60 flex flex-col gap-4 p-4">
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
        </div>
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
        onConfirm={() => {
          setResetTarget(null)
          notify(t("editor.sequenceReset"), "bad")
        }}
      />
    </TooltipProvider>
  )
}
