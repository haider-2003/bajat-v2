"use client"

import * as React from "react"
import {
  ChevronLeft,
  Download,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Settings2,
  Undo2,
} from "lucide-react"
import { useT } from "@/i18n/context"
import { Link } from "@/i18n/navigation"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ZOOM_DEFAULT, ZOOM_STEP } from "@/features/templates/editor-constants"
import { useEditorStore } from "@/features/templates/editor-store"
import { cn } from "@/lib/utils"

import { Divider, Float, IconButton } from "./materials"

/** Where the editor returns to. The sidebar already points here. */
export const TEMPLATES_HREF = "/id-issuance/templates"

/**
 * The floating chrome around the stage.
 *
 * ### Lanes, not four independent absolutes
 *
 * `editor.tsx` lays the top three slabs out as one flex row — document left,
 * property bar centre, actions right — so they cannot overlap whatever their
 * contents grow to. They were each absolutely positioned once, and the centred
 * property bar duly slid under the document slab as soon as a selection gave it
 * enough controls.
 *
 * The left column (rail + panel) starts *below* that row for the same reason,
 * and the zoom slab owns the bottom-right corner alone.
 */

export function DocBar() {
  const t = useT()
  const config = useEditorStore((s) => s.config)
  const doc = useEditorStore((s) => s.doc)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const historyIndex = useEditorStore((s) => s.historyIndex)
  const historyLength = useEditorStore((s) => s.history.length)

  return (
    <Float className="pointer-events-auto order-1 flex min-w-0 shrink items-center gap-1 py-1.5 pe-2 ps-1.5 sm:gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={TEMPLATES_HREF}
              aria-label={t("editor.backToTemplates")}
              className={cn(
                "flex size-[30px] shrink-0 items-center justify-center rounded-[9px] text-text-secondary",
                "transition-colors duration-120 hover:bg-[var(--editor-hover)] hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {/* Points back along the reading direction, so it turns
                  around under RTL. */}
              <ChevronLeft data-flip-rtl className="size-4" strokeWidth={1.8} />
            </Link>
          }
        />
        <TooltipContent side="bottom">{t("editor.backToTemplates")}</TooltipContent>
      </Tooltip>

      {/* The title is the first thing to give ground when the row runs short —
          the property bar in the centre lane is working space, this is a label.
          Capped so a long template name cannot squeeze that lane either, and
          below `sm` it steps out altogether: the back arrow and the history
          buttons are the two things on this slab you cannot do without.

          The dimensions go one step earlier than the title. They are a fact
          about the document that the page panel also states, and the property
          bar reads them out for whatever is selected. */}
      <span className="hidden min-w-0 max-w-[128px] flex-col leading-tight sm:flex lg:max-w-[190px]">
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
          {config.title || t("editor.untitled")}
        </span>
        <span className="hidden font-mono text-[10.5px] whitespace-nowrap text-text-placeholder lg:block">
          {doc.width} × {doc.height} px
        </span>
      </span>

      <Divider />

      <Tooltip>
        <TooltipTrigger
          render={
            <IconButton
              icon={Undo2}
              label={t("editor.undo")}
              disabled={historyIndex < 0}
              onClick={undo}
            />
          }
        />
        <TooltipContent side="bottom">{t("editor.undoHint")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <IconButton
              icon={Redo2}
              label={t("editor.redo")}
              disabled={historyIndex >= historyLength - 1}
              onClick={redo}
            />
          }
        />
        <TooltipContent side="bottom">{t("editor.redoHint")}</TooltipContent>
      </Tooltip>
    </Float>
  )
}

export function ActionBar({
  onOpenSettings,
  onExport,
  onSave,
}: {
  onOpenSettings: () => void
  onExport: () => void
  onSave: () => void
}) {
  const t = useT()
  const dirty = useEditorStore((s) => s.dirty)
  const hasConfigured = useEditorStore((s) => s.hasConfigured)

  return (
    <Float className="pointer-events-auto order-2 ms-auto flex shrink-0 items-center gap-1 px-1.5 py-1.5 lg:order-3 lg:gap-1.5 lg:px-2">
      {/* Save state: a dot at every width, the word only where there is room
          for it. The dot carries the meaning; the word is the courtesy. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex items-center gap-1.5 px-1 text-xs whitespace-nowrap text-text-muted xl:pe-1">
              <span
                className={cn(
                  "block size-[5px] shrink-0 rounded-full",
                  dirty ? "bg-warning" : "bg-success"
                )}
              />
              <span className="hidden xl:inline">
                {dirty ? t("editor.unsaved") : t("editor.saved")}
              </span>
            </span>
          }
        />
        <TooltipContent side="bottom">
          {dirty ? t("editor.unsavedChanges") : t("editor.allSaved")}
        </TooltipContent>
      </Tooltip>

      <button
        type="button"
        onClick={onOpenSettings}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-medium text-text-secondary lg:px-2.5",
          "transition-colors duration-120 hover:bg-[var(--editor-hover)] hover:text-text",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Settings2 className="size-4" strokeWidth={1.7} />
        <span className="hidden lg:inline">{t("nav.settings")}</span>
      </button>

      {/* §4.3 — nothing can leave the editor before the metadata exists. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              disabled={!hasConfigured}
              onClick={onExport}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-medium text-text-secondary lg:px-2.5",
                "transition-colors duration-120 hover:bg-[var(--editor-hover)] hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-40"
              )}
            >
              <Download className="size-4" strokeWidth={1.7} />
              <span className="hidden lg:inline">{t("editor.export")}</span>
            </button>
          }
        />
        <TooltipContent side="bottom">{t("editor.exportHint")}</TooltipContent>
      </Tooltip>

      <button
        type="button"
        disabled={!hasConfigured}
        onClick={onSave}
        className={cn(
          "inline-flex h-8 shrink-0 items-center rounded-[10px] bg-primary px-3 text-[13px] font-medium text-primary-foreground sm:px-3.5",
          "transition-opacity duration-120 hover:opacity-90 active:translate-y-px",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-30"
        )}
      >
        {/* The primary action never becomes an icon — it only loses a word. */}
        <span className="hidden sm:inline">{t("editor.saveTemplate")}</span>
        <span className="sm:hidden">{t("common.save")}</span>
      </button>
    </Float>
  )
}

export function ZoomBar() {
  const t = useT()
  const zoom = useEditorStore((s) => s.zoom)
  const zoomAboutCentre = useEditorStore((s) => s.zoomAboutCentre)
  const fitView = useEditorStore((s) => s.fitView)

  return (
    <Float className="pointer-events-auto z-60 flex items-center gap-0.5 p-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <IconButton
              icon={Minus}
              label={t("editor.zoomOut")}
              onClick={() => zoomAboutCentre(zoom - ZOOM_STEP)}
            />
          }
        />
        <TooltipContent side="top">{t("editor.zoomOut")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => zoomAboutCentre(ZOOM_DEFAULT)}
              className={cn(
                "h-[30px] min-w-[56px] rounded-[9px] px-1.5 font-mono text-xs tabular-nums text-text-secondary",
                "transition-colors duration-120 hover:bg-[var(--editor-hover)] hover:text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {Math.round(zoom * 100)}%
            </button>
          }
        />
        <TooltipContent side="top">
          {t("editor.zoomReset", { percent: Math.round(ZOOM_DEFAULT * 100) })}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <IconButton
              icon={Plus}
              label={t("editor.zoomIn")}
              onClick={() => zoomAboutCentre(zoom + ZOOM_STEP)}
            />
          }
        />
        <TooltipContent side="top">{t("editor.zoomIn")}</TooltipContent>
      </Tooltip>

      <Divider />

      <Tooltip>
        <TooltipTrigger
          render={
            <IconButton
              icon={Maximize2}
              label={t("editor.fitBothFaces")}
              onClick={fitView}
            />
          }
        />
        <TooltipContent side="top">{t("editor.fitBothFaces")}</TooltipContent>
      </Tooltip>
    </Float>
  )
}
