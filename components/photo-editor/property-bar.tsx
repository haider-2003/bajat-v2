"use client"

import * as React from "react"
import {
  Blend,
  Bold,
  Brush,
  Copy,
  Italic,
  Link2,
  MoreHorizontal,
  QrCode,
  SlidersHorizontal,
  Trash2,
  Underline,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  blockedFaces,
  clampEmphasis,
  DEFAULT_FONT_FAMILY,
  DEFAULT_QR_MARGIN,
  EDITOR_SWATCHES,
  FONT_FAMILIES,
  FONT_GROUP_LABELS,
  FONT_GROUPS,
  variableMeta,
} from "@/features/templates/editor-constants"
import { fontStack } from "@/features/templates/editor-fonts"
import { useEditorStore } from "@/features/templates/editor-store"
import { useT } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/translate"
import type { CanvasElement, TextAlign } from "@/features/templates/editor-types"
import { cn } from "@/lib/utils"

import { Chip, Divider, IconButton, NumberField, Swatch, Well } from "./materials"

/**
 * The contextual property bar — docs/photo-editor-spec.md §13.
 *
 * It rebuilds per element kind, which is the entire argument for floating
 * chrome over a fixed inspector: a docked panel has to reserve width for the
 * union of every type's controls, so it is mostly empty whatever is selected.
 * This bar is only ever as wide as the selection needs.
 *
 * ### Why the bar knows its own width
 *
 * The bar sits in the middle lane of the top row (editor.tsx), between the
 * document slab and the actions slab. That lane is `flex-1`, so a bar that
 * simply grows takes the lane and then some — which is what it did: the whole
 * control set was rendered unconditionally inside `overflow-x-auto`, so a text
 * selection produced a full-width slab with a scrollbar through the middle of
 * the chrome. Sideways scrolling is not a layout; it is the absence of one.
 *
 * So the bar is a **fit**, not a scroller. Every control in it has a declared
 * width (materials.tsx), which makes the width of a group a number this file
 * can add up rather than measure. One `ResizeObserver` on the lane supplies the
 * space available; `fit()` walks the sections in priority order and hands the
 * ones that do not fit to the overflow popover. Nothing is clipped, the bar
 * never exceeds the lane, and the lane never exceeds the row.
 *
 * The priority order *is* the design: geometry first, because it is the reason
 * the bar exists; then rotation; then whatever the kind makes editable; then
 * opacity; and last the binding, which is a readout rather than a control.
 *
 * ### The costs below have to stay true
 *
 * `fit()` trusts them, so a control whose width changes in materials.tsx has to
 * change here too. That is the price of not measuring, and it is worth paying:
 * measuring the bar's own contents would feed back into the lane width that
 * decides them, which is how a toolbar ends up oscillating on resize.
 */

/* Control widths, in px, exactly as materials.tsx renders them. */
const CONTROL = 30 /* every control in the bar is 30px tall, icons 30px square */
const FIELD = 58
const WIDE_FIELD = 74 /* three-character keys: PAD */
const SWATCH = 26
const FONT_CHIP = 116
const OPACITY_CHIP = 68
const BINDING_CHIP = 124
const SEGMENT = 3 * 26 + 2 * 2 + 4 /* Well: three 26px buttons, gaps, padding */

/* Layout costs. `gap-0.5` between children, `p-[7px]` around them. */
const GAP = 2
const DIV = 1 + 8 + 2 * GAP /* hairline + its mx-1 + the flex gap either side */
const PADDING = 2 * 7
const ACTIONS = DIV + CONTROL + GAP + CONTROL /* copy-style + more, always shown */
const OVERFLOW = DIV + CONTROL /* the popover trigger, present only when needed */

/** A group of related controls that can live in the bar or in the popover. */
type Section = {
  id: string
  /** Width the section occupies in the bar, including its leading divider. */
  cost: number
  bar: React.ReactNode
  sheet: React.ReactNode
}

/**
 * Split the sections into what the bar shows and what the popover takes.
 *
 * Greedy in priority order, and it stops at the first section that does not fit
 * rather than skipping ahead to a cheaper one — a bar whose contents reorder
 * themselves as the window resizes is harder to use than a shorter bar.
 */
function fit(sections: Section[], available: number) {
  const total = sections.reduce((sum, s) => sum + s.cost, 0)
  if (total <= available) return { inBar: sections, inSheet: [] as Section[] }

  const budget = available - OVERFLOW
  const inBar: Section[] = []
  const inSheet: Section[] = []
  let used = 0
  for (const section of sections) {
    if (inSheet.length === 0 && used + section.cost <= budget) {
      inBar.push(section)
      used += section.cost
    } else {
      inSheet.push(section)
    }
  }
  return { inBar, inSheet }
}

/** Width of the lane the bar has to fit into. `null` until first measured. */
function useLaneWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width)
      setWidth((current) => (current === next ? current : next))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return width
}

/**
 * Text alignment.
 *
 * `value` is the stored one — `left`/`right` are the **document's** geometry,
 * which the renderer writes into the printed card, so they stay physical even
 * under an RTL UI. Only the tooltip is translated.
 */
const ALIGNMENTS: {
  value: TextAlign
  labelKey: TranslationKey
  path: string
}[] = [
  { value: "left", labelKey: "editor.align.left", path: "M4 6h16M4 12h10M4 18h13" },
  { value: "center", labelKey: "editor.align.center", path: "M4 6h16M7 12h10M6 18h12" },
  { value: "right", labelKey: "editor.align.right", path: "M4 6h16M10 12h10M7 18h13" },
]

function AlignIcon({ path }: { path: string }) {
  return function Icon({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={className}>
        <path d={path} />
      </svg>
    )
  }
}

export function PropertyBar() {
  const t = useT()
  const selectedId = useEditorStore((s) => s.selectedId)
  const doc = useEditorStore((s) => s.doc)
  const styleSource = useEditorStore((s) => s.styleSource)
  const variables = useEditorStore((s) => s.variables)

  const update = useEditorStore((s) => s.updateElement)
  const push = useEditorStore((s) => s.pushHistory)
  const remove = useEditorStore((s) => s.removeElement)
  const duplicate = useEditorStore((s) => s.duplicateElement)
  const reorder = useEditorStore((s) => s.reorderElement)
  const armStyle = useEditorStore((s) => s.armStyle)

  const lane = React.useRef<HTMLDivElement>(null)
  const laneWidth = useLaneWidth(lane)

  const element = React.useMemo(() => {
    for (const page of doc.pages) {
      const found = page.elements.find((e) => e.id === selectedId)
      if (found) return found
    }
    return null
  }, [doc, selectedId])

  /* §13 — with nothing selected there is nothing contextual to say, and a slab
     of disabled X/Y/W/H is worse than silence. The card's name and size live in
     the document slab on the left, so going quiet loses nothing. */
  if (!element) return <Lane ref={lane} />

  /** Every geometry edit coalesces per field, so typing 1000 is one entry (§8). */
  const geo = (patch: Partial<CanvasElement>, key: string) => {
    push(`${element.id}:${key}`)
    update(element.id, patch)
  }
  const discrete = (patch: Partial<CanvasElement>) => {
    push()
    update(element.id, patch)
  }

  const clampX = (v: number) => Math.max(0, Math.min(v, doc.width - element.width))
  const clampY = (v: number) => Math.max(0, Math.min(v, doc.height - element.height))
  const variable = element.variable ? variables.find((v) => v.name === element.variable) : null

  /* ---- the controls. Each is built once and rendered in exactly one place,
     because `fit` puts every section in the bar or in the sheet, never both. */

  const x = (
    <NumberField fieldKey="X" label={t("editor.props.xPosition")} width={FIELD} value={element.x} onCommit={(v) => geo({ x: clampX(v) }, "x")} />
  )
  const y = (
    <NumberField fieldKey="Y" label={t("editor.props.yPosition")} width={FIELD} value={element.y} onCommit={(v) => geo({ y: clampY(v) }, "y")} />
  )
  const w = (
    <NumberField
      fieldKey="W"
      width={FIELD}
      label={t("editor.props.width")}
      value={element.width}
      onCommit={(v) => geo({ width: Math.max(5, Math.min(v, doc.width - element.x)) }, "w")}
    />
  )
  const h = (
    <NumberField
      fieldKey="H"
      width={FIELD}
      label={t("editor.props.height")}
      value={element.height}
      onCommit={(v) => geo({ height: Math.max(5, Math.min(v, doc.height - element.y)) }, "h")}
    />
  )
  const rotation = (
    <NumberField
      fieldKey="°"
      width={FIELD}
      label={t("editor.props.rotation")}
      value={element.rotation}
      onCommit={(v) => geo({ rotation: v }, "rot")}
    />
  )

  /* Position and size are separate sections so geometry gives way in two
     steps rather than one — at the widths where only half of it fits, where an
     element is is more useful than how big it is. */
  const sections: Section[] = [
    {
      id: "position",
      cost: 2 * FIELD + GAP,
      bar: (
        <Group>
          {x}
          {y}
        </Group>
      ),
      sheet: (
        <SheetRow label={t("editor.props.position")}>
          {x}
          {y}
        </SheetRow>
      ),
    },
    {
      id: "size",
      cost: GAP + 2 * FIELD + GAP,
      bar: (
        <Group>
          {w}
          {h}
        </Group>
      ),
      sheet: (
        <SheetRow label={t("editor.page.size")}>
          {w}
          {h}
        </SheetRow>
      ),
    },
    {
      id: "rotation",
      cost: GAP + FIELD,
      bar: rotation,
      sheet: <SheetRow label={t("editor.props.rotation")}>{rotation}</SheetRow>,
    },
  ]

  if (element.kind === "text") {
    const family = element.fontFamily ?? DEFAULT_FONT_FAMILY
    const isBold = element.fontWeight === "bold"
    const isItalic = element.fontStyle === "italic"
    /**
     * Switching family can strand the element on a face the renderer has no
     * file for, so the emphasis comes along to the nearest one that exists —
     * in the same history step, because it is one operator action.
     */
    const pickFamily = (next: string) => {
      const kept = clampEmphasis(next, { bold: isBold, italic: isItalic })
      discrete({
        fontFamily: next,
        fontWeight: kept.bold ? "bold" : "normal",
        fontStyle: kept.italic ? "italic" : "normal",
      })
    }
    const font = (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Chip label={family} className="w-[116px]" />} />
        <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
          {FONT_GROUPS.map((group, index) => (
            <React.Fragment key={group}>
              {index > 0 && <DropdownMenuSeparator />}
              {/* The label has to live inside the group — it is what supplies
                  the group its accessible name, and Base UI throws without
                  one rather than rendering an unlabelled heading. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t(FONT_GROUP_LABELS[group])}</DropdownMenuLabel>
                {FONT_FAMILIES.filter((f) => f.group === group).map((f) => (
                  <DropdownMenuItem
                    key={f.family}
                    onClick={() => pickFamily(f.family)}
                    className={cn(family === f.family && "font-medium text-text")}
                  >
                    {/* The specimen is the point of the row — each name is set
                        in its own face, so the list is browsable by eye rather
                        than by recalling what "Corbel" looks like. */}
                    <span style={{ fontFamily: fontStack(f.family) }}>{f.family}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const size = (
      <NumberField
        fieldKey="SZ"
        width={FIELD}
        label={t("editor.props.fontSize")}
        value={element.fontSize ?? 16}
        onCommit={(v) => geo({ fontSize: Math.max(1, Math.min(200, v)) }, "size")}
      />
    )
    const colour = (
      <ColorControl color={element.fill ?? "#000000"} label={t("editor.props.textColor")} onPick={(c) => discrete({ fill: c })} />
    )
    /**
     * A face the renderer has no file for is not offered at all.
     *
     * The alternative is worse than a greyed button: the browser would happily
     * fake it, and the operator would approve a card that prints upright.
     * The tooltip says which face is missing rather than just refusing.
     */
    const blocked = blockedFaces(family, { bold: isBold, italic: isItalic })
    const emphasis = (
      <>
        <FaceToggle
          icon={Bold}
          label={t("editor.props.bold")}
          blockedLabel={isItalic ? t("editor.props.noBoldItalic") : t("editor.props.noBold")}
          pressed={isBold}
          blocked={blocked.bold}
          onClick={() => discrete({ fontWeight: isBold ? "normal" : "bold" })}
        />
        <FaceToggle
          icon={Italic}
          label={t("editor.props.italic")}
          blockedLabel={isBold ? t("editor.props.noBoldItalic") : t("editor.props.noItalic")}
          pressed={isItalic}
          blocked={blocked.italic}
          onClick={() => discrete({ fontStyle: isItalic ? "normal" : "italic" })}
        />
        <Tip label={t("editor.props.underline")}>
          <IconButton
            icon={Underline}
            label={t("editor.props.underline")}
            pressed={element.textDecoration === "underline"}
            onClick={() =>
              discrete({ textDecoration: element.textDecoration === "underline" ? "" : "underline" })
            }
          />
        </Tip>
      </>
    )
    const align = (
      <Well>
        {ALIGNMENTS.map((a) => (
          <Tip key={a.value} label={t(a.labelKey)}>
            <IconButton
              icon={AlignIcon({ path: a.path })}
              label={t(a.labelKey)}
              pressed={(element.align ?? "left") === a.value}
              onClick={() => discrete({ align: a.value })}
              className="size-[26px] rounded-[9px]"
            />
          </Tip>
        ))}
      </Well>
    )

    sections.push(
      {
        id: "typeface",
        cost: DIV + FONT_CHIP + GAP + FIELD,
        bar: (
          <Group divided>
            {font}
            {size}
          </Group>
        ),
        sheet: (
          <>
            <SheetRow label={t("editor.props.typeface")}>{font}</SheetRow>
            <SheetRow label={t("editor.page.size")}>{size}</SheetRow>
          </>
        ),
      },
      {
        id: "colour",
        cost: DIV + SWATCH,
        bar: <Group divided>{colour}</Group>,
        sheet: <SheetRow label={t("editor.qr.color")}>{colour}</SheetRow>,
      },
      {
        id: "emphasis",
        cost: DIV + 3 * CONTROL + 2 * GAP,
        bar: <Group divided>{emphasis}</Group>,
        sheet: <SheetRow label={t("editor.props.style")}>{emphasis}</SheetRow>,
      },
      {
        id: "align",
        cost: DIV + SEGMENT,
        bar: <Group divided>{align}</Group>,
        sheet: <SheetRow label={t("editor.props.alignment")}>{align}</SheetRow>,
      }
    )
  }

  if (element.kind === "shape") {
    const fill = (
      <ColorControl color={element.fill ?? "#000000"} label={t("editor.props.fill")} onPick={(c) => discrete({ fill: c })} />
    )
    const radius = (
      <NumberField
        fieldKey="R"
        width={FIELD}
        label={t("editor.props.cornerRadius")}
        value={element.cornerRadius ?? 0}
        onCommit={(v) => geo({ cornerRadius: Math.max(0, v) }, "radius")}
      />
    )
    const stroke = (
      <NumberField
        fieldKey="SW"
        width={FIELD}
        label={t("editor.props.strokeWidth")}
        value={element.strokeWidth ?? 0}
        onCommit={(v) => geo({ strokeWidth: Math.max(0, v) }, "sw")}
      />
    )

    sections.push(
      {
        id: "fill",
        cost: DIV + SWATCH,
        bar: <Group divided>{fill}</Group>,
        sheet: <SheetRow label={t("editor.props.fill")}>{fill}</SheetRow>,
      },
      {
        id: "outline",
        cost: DIV + FIELD + GAP + FIELD,
        bar: (
          <Group divided>
            {radius}
            {stroke}
          </Group>
        ),
        sheet: (
          <>
            <SheetRow label={t("editor.props.cornerRadius")}>{radius}</SheetRow>
            <SheetRow label={t("editor.props.stroke")}>{stroke}</SheetRow>
          </>
        ),
      }
    )
  }

  if (element.kind === "image" && !element.isQR) {
    const radius = (
      <NumberField
        fieldKey="R"
        width={FIELD}
        label={t("editor.props.cornerRadius")}
        value={element.cornerRadius ?? 0}
        onCommit={(v) => geo({ cornerRadius: Math.max(0, v) }, "radius")}
      />
    )
    sections.push({
      id: "radius",
      cost: DIV + FIELD,
      bar: <Group divided>{radius}</Group>,
      sheet: <SheetRow label={t("editor.props.cornerRadius")}>{radius}</SheetRow>,
    })
  }

  /* §9.4 fixes the QR's colour before insertion, but the quiet zone and
     transparency stay editable — unlike the colour, neither changes what the
     code encodes. */
  if (element.isQR) {
    const quietZone = (
      <NumberField
        fieldKey="PAD"
        label={t("editor.qr.quietZone")}
        width={WIDE_FIELD}
        value={element.qrMargin ?? DEFAULT_QR_MARGIN}
        onCommit={(v) => geo({ qrMargin: Math.max(0, Math.min(8, Math.round(v))) }, "qrpad")}
      />
    )
    const transparent = (
      <Tip
        label={
          element.qrTransparent
            ? t("editor.props.transparentWarn")
            : t("editor.qr.transparentOff")
        }
      >
        <IconButton
          icon={Blend}
          label={t("editor.qr.transparent")}
          pressed={!!element.qrTransparent}
          onClick={() => discrete({ qrTransparent: !element.qrTransparent })}
        />
      </Tip>
    )
    sections.push({
      id: "qr",
      cost: DIV + WIDE_FIELD + GAP + CONTROL,
      bar: (
        <Group divided>
          {quietZone}
          {transparent}
        </Group>
      ),
      sheet: (
        <>
          <SheetRow label={t("editor.qr.quietZone")}>{quietZone}</SheetRow>
          <SheetRow label={t("editor.props.transparent")}>{transparent}</SheetRow>
        </>
      ),
    })
  }

  /* §13.1 — 0–100 in steps of 5, stored 0–1. */
  const opacity = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Chip mono label={`${Math.round(element.opacity * 100)}%`} className="w-[68px]" />}
      />
      <DropdownMenuContent align="start" className="max-h-72 w-28 overflow-y-auto">
        {Array.from({ length: 21 }, (_, i) => 100 - i * 5).map((pct) => (
          <DropdownMenuItem
            key={pct}
            onClick={() => discrete({ opacity: pct / 100 })}
            className={cn(
              "font-mono text-xs",
              Math.round(element.opacity * 100) === pct && "font-medium text-text"
            )}
          >
            {pct}%
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  sections.push({
    id: "opacity",
    cost: DIV + OPACITY_CHIP,
    bar: <Group divided>{opacity}</Group>,
    sheet: <SheetRow label={t("editor.props.opacity")}>{opacity}</SheetRow>,
  })

  /* §13.1 — a binding is *information*, not a control. There is no editing a
     definition after creation, so this is a chip and never a dropdown — and it
     is last in priority for the same reason. */
  if (element.variable || element.isQR) {
    const binding = (
      <Tip
        label={
          element.isQR
            ? t("editor.props.qrPayload")
            : variable
              ? t("editor.props.boundTo", {
                  label: variable.label,
                  type: t(variableMeta(variable.type).labelKey),
                })
              : t("editor.props.bound")
        }
      >
        <span
          className={cn(
            "inline-flex h-[26px] max-w-[124px] items-center gap-1.5 rounded-lg pe-2 ps-[7px]",
            "font-mono text-[11.5px] whitespace-nowrap",
            element.isQR
              ? "bg-accent-soft text-accent-violet shadow-[inset_0_0_0_1px_var(--color-accent-border)]"
              : "bg-info-bg text-info shadow-[inset_0_0_0_1px_var(--color-accent-border)]"
          )}
        >
          {element.isQR ? (
            <QrCode className="size-3 shrink-0" />
          ) : (
            <Link2 className="size-3 shrink-0" />
          )}
          {/* `no-data` is the literal payload the renderer looks for, so it
              stays verbatim in both languages. */}
          <span className="truncate">
            {element.isQR ? "QR · no-data" : element.variable}
          </span>
        </span>
      </Tip>
    )
    sections.push({
      id: "binding",
      cost: DIV + BINDING_CHIP,
      bar: <Group divided>{binding}</Group>,
      sheet: <SheetRow label={t("editor.props.boundLabel")}>{binding}</SheetRow>,
    })
  }

  /* Before the first measurement there is no lane width to fit to. The layout
     effect runs before paint, so nothing of this pass is seen — and wide is the
     honest default, being what the bar wants to be. */
  const available =
    laneWidth === null ? Number.POSITIVE_INFINITY : laneWidth - PADDING - ACTIONS

  /* Below the width of "trigger + actions" there is no bar to draw. Withdrawing
     is the one honest answer left: a clipped slab would show half a control and
     imply the other half is reachable. */
  if (available < OVERFLOW) return <Lane ref={lane} />

  const { inBar, inSheet } = fit(sections, available)

  return (
    <Lane ref={lane}>
      {inBar.map((section) => (
        <React.Fragment key={section.id}>{section.bar}</React.Fragment>
      ))}

      {inSheet.length > 0 && (
        <Group divided>
          <Popover>
            {/* Plural forms rather than an `=== 1` branch — English has two,
                Arabic six. */}
            <Tip label={t("editor.props.moreCount", { count: inSheet.length })}>
              <PopoverTrigger
                render={
                  <IconButton
                    icon={SlidersHorizontal}
                    label={t("editor.props.moreProperties")}
                  />
                }
              />
            </Tip>
            <PopoverContent
              align="center"
              sideOffset={8}
              className={cn(
                "w-[264px] rounded-[14px] p-1.5 ring-0",
                "bg-[var(--editor-float)] shadow-[var(--editor-shadow-pop)]"
              )}
            >
              <div className="px-1.5 pt-1 pb-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-text-placeholder uppercase">
                {t("editor.props.properties")}
              </div>
              {inSheet.map((section) => (
                <React.Fragment key={section.id}>{section.sheet}</React.Fragment>
              ))}
            </PopoverContent>
          </Popover>
        </Group>
      )}

      <Divider />

      <Tip
        label={
          styleSource === element.id
            ? t("editor.props.copyStyleArmed")
            : t("editor.props.copyStyle")
        }
      >
        <IconButton
          icon={Brush}
          label={t("editor.props.copyStyle")}
          pressed={styleSource === element.id}
          onClick={() => armStyle(styleSource === element.id ? null : element.id)}
        />
      </Tip>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<IconButton icon={MoreHorizontal} label={t("common.moreActions")} />}
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => reorder(element.id, "front")}>
            {t("editor.props.bringToFront")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => reorder(element.id, "forward")}>
            {t("editor.props.bringForward")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => reorder(element.id, "backward")}>
            {t("editor.props.sendBackward")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => reorder(element.id, "back")}>
            {t("editor.props.sendToBack")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => discrete({ locked: !element.locked })}>
            {element.locked ? t("editor.props.unlock") : t("editor.props.lock")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => duplicate(element.id)}>
            <Copy className="size-4" strokeWidth={1.6} />
            {t("templates.duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => remove(element.id)}>
            <Trash2 className="size-4" strokeWidth={1.6} />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Lane>
  )
}

/**
 * The centre lane, and the slab inside it.
 *
 * `min-w-0` is what keeps the row honest — without it the lane's contents set a
 * floor under the lane's width, and the row grows past the viewport instead of
 * the bar shrinking. The slab is `w-fit`, so it is as wide as its controls and
 * no wider; `max-w-full` plus the clip is the guarantee that a mis-costed
 * control can only ever be trimmed, never spill over the actions slab or open a
 * scrollbar. Menus and tooltips are portalled, so nothing that needs to escape
 * the slab is subject to that clip.
 */
function Lane({
  ref,
  children,
}: {
  ref: React.Ref<HTMLDivElement>
  children?: React.ReactNode
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none flex min-w-0 justify-center",
        // Below `lg` the lane takes a line of its own. Measured at 768px, the
        // row it shared with the document and the actions left it 133px — one
        // field and an overflow button, with every property of the selection
        // behind a popover. A second line is not a compromise there; it is the
        // only shape in which the bar is still a tool, and it hands the bar the
        // full width instead of a sliver. `order` puts the actions back up
        // beside the document on the first line.
        "order-3 w-full lg:order-2 lg:w-auto lg:flex-1"
      )}
    >
      {children && (
        <div
          className={cn(
            "pointer-events-auto flex w-fit max-w-full items-center gap-0.5 overflow-hidden",
            "rounded-2xl p-[7px]",
            "bg-[var(--editor-float)] shadow-[var(--editor-shadow)]"
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** A run of controls, opened by the group hairline when `divided`. */
function Group({ children, divided }: { children: React.ReactNode; divided?: boolean }) {
  return (
    <>
      {divided && <Divider />}
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </>
  )
}

/** One labelled line in the overflow popover. */
function SheetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 rounded-[10px] px-1.5">
      <span className="truncate text-[12px] text-text-secondary">{label}</span>
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </div>
  )
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children as React.ReactElement} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Bold or italic, disabled when the chosen family has no file for that face.
 *
 * The wrapping span is what makes the explanation reachable: a disabled button
 * fires no pointer events, so a tooltip hung on the button itself would go
 * quiet exactly when it has something to say.
 */
function FaceToggle({
  icon,
  label,
  blockedLabel,
  pressed,
  blocked,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  blockedLabel: string
  pressed: boolean
  blocked: boolean
  onClick: () => void
}) {
  return (
    <Tip label={blocked ? blockedLabel : label}>
      <span className="inline-flex">
        <IconButton
          icon={icon}
          label={label}
          pressed={pressed}
          disabled={blocked}
          onClick={onClick}
        />
      </span>
    </Tip>
  )
}

function ColorControl({
  color,
  label,
  onPick,
}: {
  color: string
  label: string
  onPick: (color: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Swatch color={color} label={label} />} />
      <DropdownMenuContent align="start" className="w-[196px] p-1.5">
        <div className="px-1.5 pt-1 pb-2 text-[10.5px] font-semibold tracking-[0.06em] text-text-placeholder uppercase">
          {label}
        </div>
        <div className="grid grid-cols-6 gap-1.5 px-1 pb-1">
          {EDITOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onPick(c)}
              style={{ background: c }}
              className={cn(
                "aspect-square rounded-[7px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]",
                "transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                color.toLowerCase() === c && "ring-2 ring-accent-violet ring-offset-2 ring-offset-[var(--editor-float)]"
              )}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
