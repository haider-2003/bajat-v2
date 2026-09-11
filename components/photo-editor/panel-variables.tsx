"use client"

import * as React from "react"
import {
  ChevronLeft,
  EyeOff,
  FileIcon,
  Image as ImageIcon,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
  Type as TypeIcon,
  Variable,
  X,
} from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/i18n/context"
import {
  AUTO_FILLED_TYPES,
  GENDER_OPTIONS,
  PROVINCE_OPTIONS,
  RESERVED_NAMES,
  VARIABLE_GROUPS,
  VARIABLE_GROUP_LABELS,
  VARIABLE_TYPES,
  variableMeta,
} from "@/features/templates/editor-constants"
import { newId, placeElement, useEditorStore } from "@/features/templates/editor-store"
import type {
  CanvasElement,
  EditorVariable,
  VariableType,
} from "@/features/templates/editor-types"
import { formatVariableName } from "@/features/templates/variable-name"
import { cn } from "@/lib/utils"

import {
  Callout,
  Field,
  FieldLabel,
  Hint,
  IconButton,
  SelectField,
  SubHead,
  Toggle,
} from "./materials"

/**
 * The Variables panel — docs/photo-editor-spec.md §10.
 *
 * This is the half of the tool that is not a layout designer. A variable is a
 * named slot filled per identity, and the list here becomes `vars[]` in the
 * saved JSON, which the backend turns into the data-collection form. So the
 * panel splits by *whether a variable prints* rather than listing everything
 * flat: a form-only variable has no canvas presence at all, and grouping them
 * together would leave "why is this not on my card?" unanswerable.
 *
 * Nothing here edits an existing definition. §10.6 allows delete and re-create
 * only, because the normalized name is the data key and renaming it orphans
 * every identity already issued.
 */

type Draft = {
  name: string
  label: string
  type: VariableType
  isVisible: boolean
  options: string[]
  pending: string
  randomNumberLength: number
  startingNumber: number
  arabicNumbers: boolean
}

const emptyDraft = (): Draft => ({
  name: "",
  label: "",
  type: "text",
  isVisible: true,
  options: [],
  pending: "",
  randomNumberLength: 8,
  startingNumber: 1,
  arabicNumbers: false,
})

export function VariablesPanel({
  onResetSequence,
  onNotify,
}: {
  onResetSequence: (variable: EditorVariable) => void
  onNotify: (message: string, tone?: "ok" | "bad") => void
}) {
  const t = useT()
  const variables = useEditorStore((s) => s.variables)
  const [draft, setDraft] = React.useState<Draft | null>(null)

  const visible = variables.filter((v) => v.isVisible)
  const invisible = variables.filter((v) => !v.isVisible)
  const onNew = () => setDraft(emptyDraft())

  if (draft) {
    return (
      <DraftForm
        draft={draft}
        setDraft={setDraft}
        onDone={() => setDraft(null)}
        onNotify={onNotify}
      />
    )
  }

  return (
    <>
      <PanelHead title={t("editor.panels.variables")} />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 scrollbar-quiet">
        {variables.length === 0 ? (
          /* A new template genuinely has none — but two empty section headers
             read as something failing to load rather than as a starting point,
             so the first-run state says what a variable *is*. The action it
             needs is already pinned in the footer, in the place it will keep
             for the rest of the template's life. */
          <div className="px-1 pt-6 pb-2 text-center">
            <Variable className="mx-auto mb-3 size-6 text-text-placeholder" strokeWidth={1.4} />
            <p className="text-[13px] font-medium text-text">
              {t("editor.vars.noneYet")}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
              {t("editor.vars.noneYetHint")}
            </p>
          </div>
        ) : (
          /* Only sections that hold something. An empty "Form only ——— 0" with
             a line of grey apology under it is not information; it is furniture
             that has to be read before it can be dismissed. */
          <>
            {visible.length > 0 && (
              <>
                <SubHead label={t("editor.vars.onTheCard")} count={visible.length} />
                {visible.map((v) => (
                  <VariableRow
                    key={v.name}
                    variable={v}
                    onResetSequence={onResetSequence}
                    onNotify={onNotify}
                  />
                ))}
              </>
            )}

            {invisible.length > 0 && (
              <>
                <SubHead label={t("editor.vars.formOnly")} count={invisible.length} />
                {invisible.map((v) => (
                  <VariableRow
                    key={v.name}
                    variable={v}
                    onResetSequence={onResetSequence}
                    onNotify={onNotify}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Pinned, labelled, and in the same place whether the list is empty,
          long, or scrolled. The 24px `+` in the panel header that used to be
          the only way back here after the first variable was, reasonably
          enough, not findable. */}
      <div className="flex-none p-2.5 shadow-[inset_0_1px_0_var(--editor-line)]">
        <button
          type="button"
          onClick={onNew}
          className={cn(
            "flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-primary",
            "text-[13px] font-medium text-primary-foreground",
            "transition-opacity duration-120 hover:opacity-90 active:translate-y-px",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <Plus className="size-4" strokeWidth={2} />
          {t("editor.vars.new")}
        </button>
      </div>
    </>
  )
}

/**
 * One variable, as a two-line row.
 *
 * An earlier version stacked a name, a label, a wrapping strip of four or five
 * tags and sometimes a destructive button — every fact given its own stratum,
 * so no two rows were the same height and a list of six was a wall with no
 * shape. This one is fixed at two lines whatever the type:
 *
 *   line 1  glyph · the data key · the type, right-aligned into a column
 *   line 2  the human label, then whatever else is actually set
 *
 * "From member" and "not in form" stay on that second line rather than becoming
 * tags of their own, because a tag is a colour, and four colours in a 264px
 * column is decoration rather than hierarchy. The two actions — reset a
 * sequence, delete — are icons that appear on hover, so they cost the row no
 * height at all.
 */
function VariableRow({
  variable,
  onResetSequence,
  onNotify,
}: {
  variable: EditorVariable
  onResetSequence: (v: EditorVariable) => void
  onNotify: (message: string, tone?: "ok" | "bad") => void
}) {
  const t = useT()
  const meta = variableMeta(variable.type)
  const doc = useEditorStore((s) => s.doc)
  const selectedId = useEditorStore((s) => s.selectedId)
  const select = useEditorStore((s) => s.select)
  const setActivePage = useEditorStore((s) => s.setActivePage)
  const removeVariable = useEditorStore((s) => s.removeVariable)

  const bound = findBoundElement(doc, variable.name)
  const isSelected = bound?.id === selectedId

  const Glyph = meta.element === "image" ? ImageIcon : meta.element === "text" ? TypeIcon : FileIcon

  /* Everything that is true of this variable and not already said by its name,
     label or type — joined into the one quiet line. */
  const notes = [
    // Plural forms, so "1 option" and "5 options" both read correctly — and
    // so Arabic gets its six categories rather than English's two.
    variable.options
      ? t("editor.vars.optionCount", { count: variable.options.length })
      : null,
    variable.startingNumber != null
      ? t("editor.vars.startingFrom", { n: variable.startingNumber })
      : null,
    variable.randomNumberLength
      ? t("editor.vars.digitCount", { count: variable.randomNumberLength })
      : null,
    // The sample is the glyph set itself, so it is the same in both languages.
    variable.arabicNumbers ? "٠١٢٣" : null,
    meta.member ? t("editor.vars.fromMember") : null,
    meta.formHidden ? t("editor.vars.notInForm") : null,
  ].filter(Boolean)

  const open = () => {
    if (!bound) return
    setActivePage(bound.page)
    select(bound.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          open()
        }
      }}
      className={cn(
        "group/var relative rounded-[10px] px-2 py-[7px]",
        "outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring",
        bound ? "cursor-pointer hover:bg-[var(--editor-hover)]" : "cursor-default",
        isSelected && "bg-accent-soft shadow-[inset_0_0_0_1px_var(--color-accent-border)]"
      )}
    >
      <div className="flex items-center gap-2">
        {meta.member ? (
          <Lock
            className={cn("size-3.5 shrink-0", isSelected ? "text-accent-violet" : "text-text-placeholder")}
            strokeWidth={1.7}
          />
        ) : !variable.isVisible ? (
          <EyeOff
            className={cn("size-3.5 shrink-0", isSelected ? "text-accent-violet" : "text-text-placeholder")}
            strokeWidth={1.7}
          />
        ) : (
          <Glyph
            className={cn("size-3.5 shrink-0", isSelected ? "text-accent-violet" : "text-text-placeholder")}
            strokeWidth={1.7}
          />
        )}

        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono text-[12px]",
            isSelected ? "text-accent-violet" : "text-text"
          )}
        >
          {variable.name}
        </span>

        {/* The type lines up down the right edge so the list can be scanned as
            a column. It steps aside for the row's actions on hover. */}
        <span
          className={cn(
            "shrink-0 text-[10.5px] text-text-placeholder transition-opacity",
            "group-hover/var:opacity-0 group-focus-within/var:opacity-0"
          )}
        >
          {t(meta.labelKey)}
        </span>
      </div>

      <div className="mt-px flex items-center gap-1 ps-[22px] text-[11px] text-text-muted">
        <span className="min-w-0 truncate">{variable.label}</span>
        {notes.length > 0 && (
          <span className="shrink-0 truncate text-text-placeholder">· {notes.join(" · ")}</span>
        )}
      </div>

      {/* Parked over the type label rather than in the flow, so hovering a row
          cannot change its height or shuffle the column. */}
      <div
        className={cn(
          "absolute top-1/2 end-1.5 flex -translate-y-1/2 items-center gap-0.5",
          "opacity-0 transition-opacity group-hover/var:opacity-100 focus-within:opacity-100"
        )}
      >
        {meta.sequence && (
          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  icon={RotateCcw}
                  size="sm"
                  label={t("editor.vars.resetSequenceFor", { name: variable.name })}
                  onClick={(e) => {
                    e.stopPropagation()
                    onResetSequence(variable)
                  }}
                />
              }
            />
            <TooltipContent side="top">
              {t("editor.vars.resetSequenceHint")}
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <IconButton
                icon={Trash2}
                size="sm"
                tone="danger"
                label={t("editor.vars.deleteNamed", { name: variable.name })}
                onClick={(e) => {
                  e.stopPropagation()
                  removeVariable(variable.name)
                  onNotify(t("editor.vars.removed", { name: variable.name }), "ok")
                }}
              />
            }
          />
          <TooltipContent side="top">
            {variable.isVisible
              ? t("editor.vars.deleteBoth")
              : t("editor.vars.deleteOnly")}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   Creation form — §10.4
   ──────────────────────────────────────────────────────────────────────── */

function DraftForm({
  draft,
  setDraft,
  onDone,
  onNotify,
}: {
  draft: Draft
  setDraft: (d: Draft | null) => void
  onDone: () => void
  onNotify: (message: string, tone?: "ok" | "bad") => void
}) {
  const t = useT()
  const variables = useEditorStore((s) => s.variables)
  const config = useEditorStore((s) => s.config)
  const doc = useEditorStore((s) => s.doc)
  const activePage = useEditorStore((s) => s.activePage)
  const addVariable = useEditorStore((s) => s.addVariable)

  const [error, setError] = React.useState("")
  const meta = variableMeta(draft.type)
  const key = formatVariableName(draft.name)

  /**
   * §10.1's fifteen, as the dropdown wants them: grouped by who supplies the
   * value, glyphed by what the type puts on the card, and with the two that a
   * never-expiring template cannot use marked rather than hidden.
   *
   * Marked, not hidden, because their absence would be the puzzle. The note
   * names the setting to change; the row itself stays unselectable.
   */
  const typeGroups = React.useMemo(
    () =>
      VARIABLE_GROUPS.map((group) => ({
        label: t(VARIABLE_GROUP_LABELS[group]),
        // The row is `item`, not `t`: `t` is the translator here, and the old
        // shadowing would hide it inside this map.
        options: VARIABLE_TYPES.filter((item) => item.group === group).map((item) => ({
          value: item.value,
          label: t(item.labelKey),
          icon:
            item.element === "image"
              ? ImageIcon
              : item.element === "text"
                ? TypeIcon
                : FileIcon,
          // §10.1 — no expiry duration means no expiry date to print.
          disabled: item.needsDuration && config.identityDuration === 0,
          note:
            item.needsDuration && config.identityDuration === 0
              ? t("editor.vars.needsExpiry")
              : undefined,
        })),
      })),
    [t, config.identityDuration]
  )

  /**
   * §10.4 — a type change rewrites the draft.
   *
   * The clearing branch is the subtle half: leaving a *locked* name behind when
   * moving off an auto-filled type would leave the operator with a field they
   * cannot edit and did not choose.
   */
  const changeType = (next: VariableType) => {
    const nextMeta = variableMeta(next)
    const wasAuto = AUTO_FILLED_TYPES.includes(draft.type)
    const isAuto = AUTO_FILLED_TYPES.includes(next)

    let name = draft.name
    let label = draft.label
    if (isAuto) {
      name = next
      if (next === "name" || next === "phone") label = next
    } else if (wasAuto) {
      name = ""
      label = ""
    }

    setDraft({
      ...draft,
      type: next,
      name,
      label,
      isVisible: nextMeta.forceInvisible
        ? false
        : nextMeta.forceVisible
          ? true
          : draft.isVisible,
      options: nextMeta.preloadProvinces
        ? [...PROVINCE_OPTIONS]
        : nextMeta.fixedOptions
          ? [...GENDER_OPTIONS]
          : nextMeta.options
            ? []
            : [],
      pending: "",
    })
    setError("")
  }

  const canSubmit =
    draft.name.trim() !== "" &&
    draft.label.trim() !== "" &&
    (!meta.options || meta.fixedOptions || draft.options.length > 0)

  const submit = () => {
    // Reserved-name check — those two keys belong to the member record (§10.4).
    if (RESERVED_NAMES.includes(key) && draft.type !== key) {
      setError(t("editor.vars.reservedName", { key }))
      return
    }
    if (variables.some((v) => formatVariableName(v.name) === key)) {
      setError(t("editor.vars.duplicateName", { key }))
      return
    }
    if (!key) {
      setError(t("editor.vars.emptyKey"))
      return
    }

    const isVisible = meta.forceInvisible ? false : draft.isVisible
    const variable: EditorVariable = {
      // Visible variables keep the raw name and normalize at export; invisible
      // ones normalize immediately (§10.3).
      name: isVisible ? draft.name.trim() : key,
      label: draft.label.trim(),
      type: draft.type,
      isVisible,
    }
    if (meta.options) {
      variable.options = meta.fixedOptions ? [...GENDER_OPTIONS] : [...draft.options]
    }
    if (meta.random) variable.randomNumberLength = draft.randomNumberLength
    if (meta.sequence) variable.startingNumber = draft.startingNumber
    if (meta.numeric && draft.arabicNumbers) variable.arabicNumbers = true

    let element: CanvasElement | null = null
    if (isVisible && meta.element) {
      const id = newId("v")
      const size =
        meta.element === "image"
          ? {
              width: draft.type === "signature" ? 200 : 150,
              height: draft.type === "signature" ? 80 : 150,
            }
          : { width: 200, height: 30 }
      // Two variables added in a row used to land on the same pixel, printing
      // one placeholder on top of the other.
      const spot = placeElement(doc, activePage, size)

      element =
        meta.element === "image"
          ? {
              id,
              kind: "image",
              name: variable.label,
              x: spot.x,
              y: spot.y,
              width: size.width,
              height: size.height,
              rotation: 0,
              opacity: 1,
              cornerRadius: 8,
              variable: variable.name,
            }
          : {
              id,
              kind: "text",
              name: variable.label,
              x: spot.x,
              y: spot.y,
              width: size.width,
              height: size.height,
              rotation: 0,
              opacity: 1,
              text: `{${variable.name}}`,
              fontSize: 16,
              fontFamily: "Arial",
              fontWeight: "normal",
              fontStyle: "normal",
              fill: "#000000",
              align: "left",
              variable: variable.name,
            }
    }

    addVariable(variable, element)
    onNotify(
      isVisible && element
        ? t("editor.vars.addedPlaced", { key })
        : t("editor.vars.addedFormOnly", { key }),
      "ok"
    )
    onDone()
  }

  return (
    <>
      <PanelHead title={t("editor.vars.new")} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3.5 scrollbar-quiet">
        <button
          type="button"
          onClick={onDone}
          className="mb-2.5 inline-flex h-6 items-center gap-1 rounded-lg pe-2 ps-1 text-xs font-medium text-text-secondary transition-colors hover:bg-[var(--editor-hover)] hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft data-flip-rtl className="size-3.5" strokeWidth={2} />
          {t("editor.vars.allVariables")}
        </button>

        {/* The one thing worth knowing *before* filling this in, in one line.
            It used to be four lines at the bottom of the list instead, where it
            was neither read nor actionable. */}
        <Callout>
          {t("editor.vars.finalBefore")}{" "}
          <strong className="font-medium text-text">
            {t("editor.vars.finalEmphasis")}
          </strong>{" "}
          {t("editor.vars.finalAfter")}
        </Callout>

        <div className="mt-3.5" />
        <FieldLabel>{t("editor.vars.type")}</FieldLabel>
        <SelectField
          label={t("editor.vars.type")}
          value={draft.type}
          onValueChange={(next) => changeType(next as VariableType)}
          groups={typeGroups}
        />

        <div className="mt-3.5">
          <FieldLabel required locked={meta.lockName}>
            {t("members.columns.name")}
          </FieldLabel>
          <Field locked={meta.lockName}>
            <input
              value={draft.name}
              placeholder="first_name"
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value })
                setError("")
              }}
              className="w-full border-0 bg-transparent p-0 font-mono text-xs text-text outline-none"
            />
          </Field>
          {draft.name.trim() !== "" && (
            <Hint>
              {t("editor.vars.dataKey")}{" "}
              <code dir="ltr" className="font-mono text-[11px] text-info">
                {key || "—"}
              </code>
            </Hint>
          )}
        </div>

        <div className="mt-3.5">
          <FieldLabel required locked={meta.lockLabel}>
            {t("editor.vars.label")}
          </FieldLabel>
          <Field locked={meta.lockLabel}>
            <input
              value={draft.label}
              placeholder={t("editor.vars.labelPlaceholder")}
              onChange={(e) => {
                setDraft({ ...draft, label: e.target.value })
                setError("")
              }}
              className="w-full border-0 bg-transparent p-0 text-[13px] text-text outline-none"
            />
          </Field>
        </div>

        {meta.options && (
          <div className="mt-3.5">
            <FieldLabel required>{t("editor.vars.options")}</FieldLabel>
            {meta.fixedOptions ? (
              <>
                {GENDER_OPTIONS.map((o) => (
                  <div
                    key={o}
                    className="mb-1 flex h-[30px] items-center rounded-lg bg-[var(--editor-well)] px-2.5 text-[12.5px]"
                  >
                    {o}
                  </div>
                ))}
                <Hint>{t("editor.vars.fixedOptions")}</Hint>
              </>
            ) : (
              <>
                {draft.options.map((o, i) => (
                  <div
                    key={`${o}-${i}`}
                    className="mb-1 flex h-[30px] items-center gap-1.5 rounded-lg bg-[var(--editor-well)] pe-1.5 ps-2.5 text-[12.5px]"
                  >
                    <span className="min-w-0 flex-1 truncate">{o}</span>
                    <IconButton
                      icon={X}
                      size="sm"
                      label={t("editor.vars.removeOption", { option: o })}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          options: draft.options.filter((_, index) => index !== i),
                        })
                      }
                    />
                  </div>
                ))}
                <div className="mt-0.5 flex gap-1.5">
                  <Field>
                    <input
                      value={draft.pending}
                      placeholder={t("editor.vars.addOption")}
                      onChange={(e) => setDraft({ ...draft, pending: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || !draft.pending.trim()) return
                        e.preventDefault()
                        setDraft({
                          ...draft,
                          options: [...draft.options, draft.pending.trim()],
                          pending: "",
                        })
                      }}
                      className="w-full border-0 bg-transparent p-0 text-[13px] text-text outline-none"
                    />
                  </Field>
                  <IconButton
                    icon={Plus}
                    label={t("editor.vars.addOption")}
                    onClick={() => {
                      if (!draft.pending.trim()) return
                      setDraft({
                        ...draft,
                        options: [...draft.options, draft.pending.trim()],
                        pending: "",
                      })
                    }}
                  />
                </div>
                {meta.preloadProvinces && <Hint>{t("editor.vars.provincesHint")}</Hint>}
                {draft.options.length === 0 && (
                  <p className="mt-1.5 text-[11.5px] text-danger">
                    {t("editor.vars.optionRequired")}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {meta.random && (
          <div className="mt-3.5">
            <FieldLabel>{t("editor.vars.digits")}</FieldLabel>
            <Field>
              <input
                type="number"
                value={draft.randomNumberLength}
                onChange={(e) =>
                  setDraft({ ...draft, randomNumberLength: Number(e.target.value) || 8 })
                }
                className="w-full border-0 bg-transparent p-0 font-mono text-xs text-text outline-none"
              />
            </Field>
          </div>
        )}

        {meta.sequence && (
          <div className="mt-3.5">
            <FieldLabel>{t("editor.vars.startingNumber")}</FieldLabel>
            <Field>
              <input
                type="number"
                value={draft.startingNumber}
                onChange={(e) =>
                  setDraft({ ...draft, startingNumber: Number(e.target.value) || 1 })
                }
                className="w-full border-0 bg-transparent p-0 font-mono text-xs text-text outline-none"
              />
            </Field>
          </div>
        )}

        {meta.numeric && (
          <div className="mt-2.5">
            <Toggle
              checked={draft.arabicNumbers}
              onToggle={() => setDraft({ ...draft, arabicNumbers: !draft.arabicNumbers })}
              title={t("editor.vars.arabicNumerals")}
              description={t("editor.vars.arabicNumeralsHint")}
            />
          </div>
        )}

        <div className="mt-2.5">
          <Toggle
            checked={draft.isVisible}
            locked={meta.forceInvisible || meta.forceVisible}
            onToggle={() => setDraft({ ...draft, isVisible: !draft.isVisible })}
            title={t("editor.vars.showOnCard")}
            description={
              meta.forceInvisible
                ? t("editor.vars.filesNeverPrinted")
                : meta.forceVisible
                  ? t("editor.vars.memberAlwaysPrinted")
                  : draft.isVisible
                    ? t("editor.vars.createsElement")
                    : t("editor.vars.formOnlyNotPrinted")
            }
          />
        </div>

        {meta.formHidden && (
          <div className="mt-2.5">
            <Callout>
              {t("editor.vars.generatedBefore")}{" "}
              <strong className="font-medium text-text">
                {t("editor.vars.generatedEmphasis")}
              </strong>
              .
            </Callout>
          </div>
        )}

        {error && (
          <div className="mt-2.5">
            <Callout tone="danger">{error}</Callout>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className={cn(
            "mt-3.5 flex h-8 w-full items-center justify-center rounded-[10px]",
            "bg-primary text-[13px] font-medium text-primary-foreground",
            "transition-opacity hover:opacity-90 active:translate-y-px",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-30"
          )}
        >
          {t("editor.vars.addVariable")}
        </button>
      </div>
    </>
  )
}

/** The first element on any page bound to `name`, with its page index. */
function findBoundElement(
  doc: { pages: { elements: CanvasElement[] }[] },
  name: string
) {
  for (let i = 0; i < doc.pages.length; i += 1) {
    const found = doc.pages[i].elements.find((e) => e.variable === name)
    if (found) return { page: i, id: found.id }
  }
  return null
}

export function PanelHead({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-none items-center justify-between gap-2 px-3 pt-3 pb-2.5">
      <span className="text-[13px] font-semibold tracking-[-0.005em]">{title}</span>
      {children}
    </div>
  )
}
