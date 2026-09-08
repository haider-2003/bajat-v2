"use client"

import * as React from "react"
import {
  FlipHorizontal,
  Image as ImageIcon,
  Plus,
  QrCode,
  Type as TypeIcon,
  Upload,
  Variable,
  X,
} from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/translate"
import {
  DEFAULT_QR_MARGIN,
  EDITOR_SWATCHES,
  ID_CARD_HEIGHT,
  ID_CARD_WIDTH,
  SIZE_PRESETS,
  TEXT_PRESETS,
  pxToUnit,
} from "@/features/templates/editor-constants"
import { newId, placeElement, useEditorStore } from "@/features/templates/editor-store"
import type {
  CanvasElement,
  DisplayUnit,
  PanelKey,
} from "@/features/templates/editor-types"
import { cn } from "@/lib/utils"

import { Callout, FieldLabel, Float, Hint, IconButton, Swatch, Toggle, Well } from "./materials"
import { PanelHead, VariablesPanel } from "./panel-variables"

/**
 * The authoring panels and the rail that switches them —
 * docs/photo-editor-spec.md's sidebar.
 *
 * Five panels: Text, Image, QR, Variables, Page. Shapes exist in the model and
 * arrive via JSON import, but the spec has their panel disabled, so it is not
 * offered here either — an entry point for something the product has decided
 * not to expose is worse than no entry point.
 */

const PANELS: {
  key: PanelKey
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  labelKey: TranslationKey
}[] = [
  { key: "text", icon: TypeIcon, labelKey: "editor.panels.text" },
  { key: "image", icon: ImageIcon, labelKey: "editor.panels.image" },
  { key: "qr", icon: QrCode, labelKey: "editor.panels.qr" },
  { key: "variables", icon: Variable, labelKey: "editor.panels.variables" },
  { key: "page", icon: FlipHorizontal, labelKey: "editor.panels.page" },
]

export function PanelRail() {
  const t = useT()
  const panel = useEditorStore((s) => s.panel)
  const setPanel = useEditorStore((s) => s.setPanel)

  return (
    <Float
      className="pointer-events-auto z-50 flex flex-none flex-col gap-px p-1.5"
      role="tablist"
      aria-label={t("editor.panels.railLabel")}
    >
      {PANELS.map((p) => (
        <Tooltip key={p.key}>
          <TooltipTrigger
            render={
              <IconButton
                icon={p.icon}
                label={t(p.labelKey)}
                pressed={panel === p.key}
                // Clicking the open panel closes it. On a desktop that buys
                // back some canvas; on a tablet, where the panel is a drawer
                // over the work, it is the way out of it.
                onClick={() => setPanel(panel === p.key ? null : p.key)}
              />
            }
          />
          <TooltipContent side="right">{t(p.labelKey)}</TooltipContent>
        </Tooltip>
      ))}
    </Float>
  )
}

export function Panel({
  onResetSequence,
  onNotify,
}: {
  onResetSequence: (v: import("@/features/templates/editor-types").EditorVariable) => void
  onNotify: (message: string, tone?: "ok" | "bad") => void
}) {
  const t = useT()
  const panel = useEditorStore((s) => s.panel)
  const setPanel = useEditorStore((s) => s.setPanel)

  if (!panel) return null

  return (
    <Float
      className={cn(
        // Content height, not full height. A panel pinned to the bottom was a
        // 284px column of empty white whatever it held — the one surface in the
        // editor that did not float so much as loom. It grows with its content
        // and only starts scrolling when it runs out of the band it sits in.
        "pointer-events-auto z-50 flex max-h-full flex-col overflow-hidden",
        // Beside the work at `lg` and up; **over** it below that. Which one it
        // is decides whether the canvas has to make room for it: an in-flow
        // panel narrows the free area the card is centred in (that is what the
        // spacer beside it measures), while a drawer floats and the card stays
        // centred in the whole band. Getting this wrong is not cosmetic — an
        // absolute panel counted as layout leaves a 106px slot for the card on
        // a phone, and the card duly shrinks to fit it.
        "absolute top-0 start-[58px] lg:relative lg:top-auto lg:start-auto",
        // 284 on a desktop, narrower on a laptop, and on a phone whatever is
        // left beside the rail — a drawer that runs off the screen is worse
        // than no drawer, and this one never can.
        "w-[min(284px,calc(100vw-90px))] lg:w-[264px] xl:w-[284px]"
      )}
    >
      {/* Below `lg` the panel covers the work rather than sitting beside it, so
          it needs a way out that does not require finding the rail button that
          opened it. */}
      <div className="absolute top-2.5 end-2.5 z-10 lg:hidden">
        <IconButton
          icon={X}
          size="sm"
          label={t("editor.panels.close")}
          onClick={() => setPanel(null)}
        />
      </div>

      {panel === "text" && <TextPanel onNotify={onNotify} />}
      {panel === "image" && <ImagePanel onNotify={onNotify} />}
      {panel === "qr" && <QrPanel onNotify={onNotify} />}
      {panel === "variables" && (
        <VariablesPanel onResetSequence={onResetSequence} onNotify={onNotify} />
      )}
      {panel === "page" && <PagePanel onNotify={onNotify} />}
    </Float>
  )
}

function PanelBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3.5 scrollbar-quiet">{children}</div>
  )
}

function Row({
  onClick,
  children,
  meta,
}: {
  onClick: () => void
  children: React.ReactNode
  meta?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-start",
        "transition-colors duration-100 hover:bg-[var(--editor-hover)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <span className="min-w-0 flex-1 truncate text-text">{children}</span>
      {meta && <span className="shrink-0 font-mono text-[10.5px] text-text-placeholder">{meta}</span>}
    </button>
  )
}

/* ── Text — §9.1 ──────────────────────────────────────────────────────── */

function TextPanel({ onNotify }: { onNotify: (m: string, t?: "ok" | "bad") => void }) {
  const t = useT()
  const addElement = useEditorStore((s) => s.addElement)
  const doc = useEditorStore((s) => s.doc)
  const activePage = useEditorStore((s) => s.activePage)

  const add = (preset: (typeof TEXT_PRESETS)[number]) => {
    const size = {
      width: Math.min(200, doc.width - 50),
      height: preset.fontSize + 10,
    }
    const spot = placeElement(doc, activePage, size)
    const element: CanvasElement = {
      id: newId("t"),
      kind: "text",
      name: preset.key,
      x: spot.x,
      y: spot.y,
      width: size.width,
      height: size.height,
      rotation: 0,
      opacity: 1,
      text: t(preset.textKey),
      fontSize: preset.fontSize,
      fontFamily: "Arial",
      fontWeight: preset.fontWeight,
      fontStyle: "normal",
      textDecoration: "",
      fill: "#000000",
      align: "left",
    }
    addElement(element)
    onNotify(t("editor.text.added", { name: t(preset.labelKey) }), "ok")
  }

  return (
    <>
      <PanelHead title={t("editor.panels.text")} />
      <PanelBody>
        {TEXT_PRESETS.map((preset) => (
          <Row key={preset.key} onClick={() => add(preset)} meta={`${preset.fontSize}px`}>
            <span
              style={{
                fontSize: Math.min(17, preset.fontSize * 0.72),
                fontWeight: preset.fontWeight === "bold" ? 600 : 400,
              }}
            >
              {t(preset.labelKey)}
            </span>
          </Row>
        ))}
        <Hint>{t("editor.text.presetsHint")}</Hint>
      </PanelBody>
    </>
  )
}

/* ── Image — §9.2 ─────────────────────────────────────────────────────── */

function ImagePanel({ onNotify }: { onNotify: (m: string, t?: "ok" | "bad") => void }) {
  const t = useT()

  return (
    <>
      <PanelHead title={t("editor.panels.image")} />
      <PanelBody>
        <button
          type="button"
          onClick={() => onNotify(t("editor.image.uploadNotWired"))}
          className={cn(
            "w-full rounded-xl bg-[var(--editor-well)] px-3.5 py-5 text-center",
            "shadow-[inset_0_0_0_1.5px_var(--editor-line)]",
            "transition-[box-shadow,background-color] duration-120",
            "hover:bg-accent-soft hover:shadow-[inset_0_0_0_1.5px_var(--color-accent-border)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <Upload className="mx-auto mb-1.5 size-5 text-text-placeholder" strokeWidth={1.6} />
          <span className="block text-[12.5px] font-medium text-text-secondary">
            {t("editor.image.dropHint")}
          </span>
          <span className="mt-0.5 block font-mono text-[11px] text-text-placeholder">
            PNG · JPEG · WEBP · SVG · max 10 MB
          </span>
        </button>

        <div className="mt-3">
          {/* Split around the two emphasised tokens: `t()` returns a string
              and cannot carry the <strong>s. */}
          <Callout>
            {t("editor.image.storageBefore")}{" "}
            <strong className="font-medium text-text">
              {t("editor.image.storageEmphasis")}
            </strong>{" "}
            {t("editor.image.storageMiddle")}{" "}
            <strong className="font-medium text-text">
              {t("editor.image.storageSize")}
            </strong>{" "}
            {t("editor.image.storageAfter")}
          </Callout>
        </div>
      </PanelBody>
    </>
  )
}

/* ── QR — §9.4, and the only structural save gate (§16.1) ─────────────── */

function QrPanel({ onNotify }: { onNotify: (m: string, t?: "ok" | "bad") => void }) {
  const t = useT()
  const hasQR = useEditorStore((s) => s.hasQR())
  const addElement = useEditorStore((s) => s.addElement)
  const doc = useEditorStore((s) => s.doc)
  const activePage = useEditorStore((s) => s.activePage)
  const [color, setColor] = React.useState("#000000")
  // Defaults for the *next* QR. §9.4 fixes the colour before insertion; the
  // quiet zone and transparency stay editable afterwards from the property bar,
  // because unlike the colour they do not change what the code encodes.
  const [margin, setMargin] = React.useState(DEFAULT_QR_MARGIN)
  const [transparent, setTransparent] = React.useState(false)

  return (
    <>
      <PanelHead title={t("editor.panels.qr")} />
      <PanelBody>
        <Callout tone={hasQR ? "info" : "danger"}>
          {hasQR ? (
            <>
              {t("editor.qr.presentBefore")}{" "}
              <strong className="font-medium text-text">
                {t("editor.qr.presentEmphasis")}
              </strong>{" "}
              {t("editor.qr.presentAfter")}
            </>
          ) : (
            <>
              <strong className="font-medium text-danger">
                {t("editor.qr.missingEmphasis")}
              </strong>{" "}
              {t("editor.qr.missingAfter")}
            </>
          )}
        </Callout>

        <div className="mt-3.5">
          <FieldLabel>{t("editor.qr.color")}</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {["#000000", "#151b2e", "#1c1c1c", "#7c3aed", "#2563eb"].map((c) => (
              <Swatch
                key={c}
                color={c}
                label={c}
                open={color === c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <Hint>
            {t("editor.qr.colorHintBefore")}{" "}
            <strong className="font-medium text-text">
              {t("editor.qr.colorHintEmphasis")}
            </strong>{" "}
            {t("editor.qr.colorHintAfter")}
          </Hint>
        </div>

        <div className="mt-3.5">
          <FieldLabel>{t("editor.qr.quietZone")}</FieldLabel>
          <Well className="w-full">
            {[0, 1, 2, 4].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={margin === m}
                onClick={() => setMargin(m)}
                className={cn(
                  "h-7 flex-1 rounded-[7px] font-mono text-[11.5px] text-text-muted",
                  "transition-[background-color,color,box-shadow] duration-120",
                  "hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  margin === m &&
                    "bg-[var(--editor-float)] text-text shadow-[var(--editor-shadow-chip)]"
                )}
              >
                {m === 0 ? t("editor.qr.none") : m}
              </button>
            ))}
          </Well>
          <Hint>
            {t("editor.qr.quietZoneHintBefore")}{" "}
            <strong className="font-medium text-text">{t("editor.qr.none")}</strong>{" "}
            {t("editor.qr.quietZoneHintAfter")}
          </Hint>
        </div>

        <div className="mt-2.5">
          <Toggle
            checked={transparent}
            onToggle={() => setTransparent(!transparent)}
            title={t("editor.qr.transparent")}
            description={
              transparent
                ? t("editor.qr.transparentOn")
                : t("editor.qr.transparentOff")
            }
          />
        </div>

        {transparent && (
          <div className="mt-2.5">
            <Callout tone="danger">
              {t("editor.qr.contrastBefore")}{" "}
              <strong className="font-medium text-danger">
                {t("editor.qr.contrastEmphasis")}
              </strong>{" "}
              {t("editor.qr.contrastAfter")}
            </Callout>
          </div>
        )}

        <div className="mt-2.5">
          <Row
            meta="50 × 50"
            onClick={() => {
              // §9.4 wants the code low-left; the cascade only moves it if that
              // corner is already taken.
              const spot = placeElement(
                doc,
                activePage,
                { width: 50, height: 50 },
                { x: 14, y: doc.height - 64 }
              )
              addElement({
                id: newId("q"),
                kind: "image",
                name: "QR",
                x: spot.x,
                y: spot.y,
                width: 50,
                height: 50,
                rotation: 0,
                opacity: 1,
                isQR: true,
                qrValue: "no-data",
                qrColor: color,
                qrMargin: margin,
                qrTransparent: transparent,
              })
              onNotify(t("editor.qr.added"), "ok")
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="size-4 text-text-muted" strokeWidth={2} />
              {t("editor.qr.add")}
            </span>
          </Row>
        </div>
      </PanelBody>
    </>
  )
}

/* ── Page — §14 ───────────────────────────────────────────────────────── */

function PagePanel({ onNotify }: { onNotify: (m: string, t?: "ok" | "bad") => void }) {
  const t = useT()
  const doc = useEditorStore((s) => s.doc)
  const activePage = useEditorStore((s) => s.activePage)
  const unit = useEditorStore((s) => s.unit)
  const setUnit = useEditorStore((s) => s.setUnit)
  const setActivePage = useEditorStore((s) => s.setActivePage)
  const setPageBackground = useEditorStore((s) => s.setPageBackground)
  const setDocumentSize = useEditorStore((s) => s.setDocumentSize)
  const flipOrientation = useEditorStore((s) => s.flipOrientation)

  const fmt = (px: number) => `${pxToUnit(px, unit)} ${unit}`

  return (
    <>
      <PanelHead title={t("editor.panels.page")} />
      <PanelBody>
        <FieldLabel>{t("editor.page.background")}</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {EDITOR_SWATCHES.slice(0, 6).map((c) => (
            <Swatch
              key={c}
              color={c}
              label={c}
              open={doc.pages[activePage].background === c}
              onClick={() => setPageBackground(activePage, c)}
            />
          ))}
        </div>

        <div className="mt-3.5">
          <FieldLabel>{t("editor.page.unit")}</FieldLabel>
          <Well className="w-full">
            {(["px", "cm", "mm"] as DisplayUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => setUnit(u)}
                className={cn(
                  "h-7 flex-1 rounded-[7px] text-[12.5px] font-medium text-text-muted",
                  "transition-[background-color,color,box-shadow] duration-120",
                  "hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  unit === u &&
                    "bg-[var(--editor-float)] text-text shadow-[var(--editor-shadow-chip)]"
                )}
              >
                {u}
              </button>
            ))}
          </Well>
          <Hint>{t("editor.page.unitHint")}</Hint>
        </div>

        <div className="mt-3.5">
          <FieldLabel>{t("editor.page.size")}</FieldLabel>
          {SIZE_PRESETS.map((preset) => {
            const active = preset.width === doc.width && preset.height === doc.height
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => setDocumentSize(preset.width, preset.height)}
                className={cn(
                  "flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-start",
                  "transition-colors duration-100 hover:bg-[var(--editor-hover)]",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-accent-soft"
                )}
              >
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-text",
                    active && "font-medium text-accent-violet"
                  )}
                >
                  {t(preset.labelKey)}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-text-placeholder">
                  {fmt(preset.width)} × {fmt(preset.height)}
                </span>
              </button>
            )
          })}
          <Hint>{t("editor.page.sizeHint")}</Hint>
        </div>

        <div className="mt-2">
          <Row onClick={flipOrientation}>
            <span className="inline-flex items-center gap-2">
              <FlipHorizontal className="size-4 text-text-muted" strokeWidth={1.7} />
              {t("editor.page.flip")}
            </span>
          </Row>
        </div>

        <div className="mt-3.5">
          <FieldLabel>{t("editor.page.faces")}</FieldLabel>
          <div className="flex gap-1.5">
            {doc.pages.map((page, i) => (
              <button
                key={page.id}
                type="button"
                aria-pressed={i === activePage}
                onClick={() => setActivePage(i)}
                className={cn(
                  "h-8 flex-1 rounded-[9px] bg-[var(--editor-well)] text-[12.5px] font-medium text-text-muted",
                  "transition-[background-color,color,box-shadow] duration-120",
                  "hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === activePage &&
                    "bg-accent-soft text-accent-violet shadow-[inset_0_0_0_1px_var(--color-accent-border)]"
                )}
              >
                {i === 0 ? t("printer.front") : t("printer.back")}
              </button>
            ))}
          </div>
          <Hint>{t("editor.page.facesHint")}</Hint>
        </div>

        <div className="mt-3">
          <Row onClick={() => onNotify(t("editor.page.importNote"))}>
            <span className="inline-flex items-center gap-2">
              <Upload className="size-4 text-text-muted" strokeWidth={1.7} />
              {t("editor.page.importJson")}
            </span>
          </Row>
        </div>

        {(doc.width !== ID_CARD_WIDTH || doc.height !== ID_CARD_HEIGHT) && (
          <div className="mt-3">
            <Callout>{t("editor.page.nonStandardSize")}</Callout>
          </div>
        )}
      </PanelBody>
    </>
  )
}
