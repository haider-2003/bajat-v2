"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RESET_CONFIRM_WORD } from "@/features/templates/editor-constants"
import { useEditorStore } from "@/features/templates/editor-store"
import { useT } from "@/i18n/context"
import type { EditorVariable, TemplateConfig } from "@/features/templates/editor-types"
import { cn } from "@/lib/utils"

import { Callout, Field, FieldLabel, Hint, Toggle } from "./materials"

/**
 * The two dialogs — docs/photo-editor-spec.md §15 and §10.7.
 *
 * Both use the app's own `Dialog`, not the editor's floating material: a modal
 * is app chrome, it interrupts, and it should look like every other interrupt
 * in the product rather than like part of the canvas tool.
 */

const DURATION_PRESETS = [3, 6, 12, 48]

/**
 * §15 — template metadata.
 *
 * `dismissible: false` is the create-mode gate (§4.3): the form opens
 * immediately on a new template and cannot be escaped, because `hasConfigured`
 * blocks both save and export and an operator who dismissed it would be left in
 * an editor that cannot produce anything.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  dismissible = true,
  onCancel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dismissible?: boolean
  /** Create mode navigates away rather than closing — there is nothing behind it. */
  onCancel?: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !dismissible) return
        onOpenChange(next)
      }}
    >
      {/* Escape is handled by the `onOpenChange` guard above — the popup only
          closes when `dismissible` allows it.

          The form is a separate component rendered only while open, so its
          draft initializes from the current config on mount. Syncing the two
          in an effect instead would re-render on every config change for no
          reason, and React rightly complains about it. */}
      {open && (
        <SettingsForm
          dismissible={dismissible}
          onCancel={onCancel}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function SettingsForm({
  dismissible,
  onCancel,
  onClose,
}: {
  dismissible: boolean
  onCancel?: () => void
  onClose: () => void
}) {
  const t = useT()
  const config = useEditorStore((s) => s.config)
  const setConfig = useEditorStore((s) => s.setConfig)
  const [draft, setDraft] = React.useState<TemplateConfig>(config)

  const valid =
    draft.title.trim().length >= 3 &&
    draft.description.trim().length >= 10 &&
    draft.price >= 0

  return (
    <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t("editor.settings.title")}</DialogTitle>
          <DialogDescription>{t("editor.settings.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div>
            <FieldLabel required>{t("templates.form.title")}</FieldLabel>
            <Field>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={t("editor.settings.titlePlaceholder")}
                className="w-full border-0 bg-transparent p-0 text-[13px] text-text outline-none"
              />
            </Field>
            <Hint>{t("templates.form.minChars", { n: 3 })}</Hint>
          </div>

          <div>
            <FieldLabel required>{t("templates.form.description")}</FieldLabel>
            <Field className="h-auto py-2">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                placeholder={t("editor.settings.descriptionPlaceholder")}
                className="w-full resize-y border-0 bg-transparent p-0 text-[13px] leading-normal text-text outline-none"
              />
            </Field>
            <Hint>{t("templates.form.minChars", { n: 10 })}</Hint>
          </div>

          <div>
            <FieldLabel required>{t("templates.columns.price")}</FieldLabel>
            <Field>
              <input
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full border-0 bg-transparent p-0 font-mono text-xs tabular-nums text-text outline-none"
              />
              <span
                dir="ltr"
                className="ms-2 shrink-0 font-mono text-[11px] text-text-placeholder"
              >
                {t("templates.currency")}
              </span>
            </Field>
          </div>

          <div>
            <FieldLabel required>{t("templates.columns.validity")}</FieldLabel>
            <div className="grid grid-cols-4 gap-1.5">
              {DURATION_PRESETS.map((months) => (
                <PresetPill
                  key={months}
                  active={draft.identityDuration === months}
                  onClick={() => setDraft({ ...draft, identityDuration: months })}
                >
                  {t("editor.settings.monthsShort", { count: months })}
                </PresetPill>
              ))}
            </div>
            <div className="mt-1.5">
              <PresetPill
                className="w-full"
                active={draft.identityDuration === 0}
                onClick={() => setDraft({ ...draft, identityDuration: 0 })}
              >
                ∞&nbsp;&nbsp;{t("templates.neverExpires")}
              </PresetPill>
            </div>
            {draft.identityDuration === 0 ? (
              <div className="mt-2">
                {/* Split around the code token: it is an API field name and
                    stays Latin in both languages. */}
                <Callout>
                  {t("editor.settings.noExpiryBefore")}{" "}
                  <code dir="ltr" className="font-mono text-[11.5px] text-text">
                    expiration_date
                  </code>{" "}
                  {t("editor.settings.noExpiryAfter")}
                </Callout>
              </div>
            ) : (
              <Hint>{t("editor.settings.validityHint")}</Hint>
            )}
          </div>

          <Toggle
            checked={draft.branchRequired}
            onToggle={() => setDraft({ ...draft, branchRequired: !draft.branchRequired })}
            title={t("templates.branchRequired")}
            description={t("editor.settings.branchHint")}
          />
        </DialogBody>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => (dismissible ? onClose() : onCancel?.())}
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              setConfig(draft)
              onClose()
            }}
          >
            {t("editor.settings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
  )
}

function PresetPill({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-[9px] bg-surface-sunken",
        "text-[12.5px] font-medium text-text-secondary",
        "transition-[background-color,color,box-shadow] duration-120",
        "hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active &&
          "bg-accent-soft text-accent-violet shadow-[inset_0_0_0_1px_var(--color-accent-border)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * §10.7 — resetting an incremental sequence.
 *
 * The copy leads with the consequence rather than the action, because the
 * action's name understates it by a wide margin: this deletes every identity
 * ever issued from the template, not just the counter.
 */
export function ResetSequenceDialog({
  variable,
  onOpenChange,
  onConfirm,
  busy = false,
}: {
  variable: EditorVariable | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** The request is in flight — the dialog stays open and stops taking input. */
  busy?: boolean
}) {
  return (
    <Dialog
      open={variable !== null}
      onOpenChange={(next) => {
        // Closing mid-request would leave the operator with no sign of whether
        // the reset landed — and it deletes identities, so "probably" is not a
        // state to leave them in.
        if (busy) return
        onOpenChange(next)
      }}
    >
      {/* Same pattern as the settings form: mounted only while a variable is
          targeted, so the confirmation box starts empty every time rather than
          being cleared by an effect. Keyed by name so re-targeting a different
          sequence also starts clean. */}
      {variable && (
        <ResetForm
          key={variable.name}
          variable={variable}
          busy={busy}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      )}
    </Dialog>
  )
}

function ResetForm({
  variable,
  busy,
  onCancel,
  onConfirm,
}: {
  variable: EditorVariable
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useT()
  const templateId = useEditorStore((s) => s.templateId)
  const [typed, setTyped] = React.useState("")
  const saved = templateId !== null

  return (
    <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {t("editor.reset.title", { name: variable.name })}
          </DialogTitle>
          <DialogDescription>{t("editor.reset.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3.5">
          {/* Split around the emphasised clause: `t()` returns a string and
              cannot hold the <strong>. */}
          <Callout tone="danger">
            {t("editor.reset.warnBefore")}{" "}
            <strong className="font-medium text-danger">
              {t("editor.reset.warnEmphasis")}
            </strong>{" "}
            {t("editor.reset.warnAfter")}
          </Callout>

          {!saved ? (
            <Callout>{t("editor.reset.mustSaveFirst")}</Callout>
          ) : (
            <div>
              <FieldLabel required>
                {t("editor.reset.typeToConfirm", { word: RESET_CONFIRM_WORD })}
              </FieldLabel>
              <Field>
                <input
                  dir="rtl"
                  value={typed}
                  placeholder={RESET_CONFIRM_WORD}
                  onChange={(e) => setTyped(e.target.value)}
                  className="w-full border-0 bg-transparent p-0 text-[13px] text-text outline-none"
                />
              </Field>
              <Hint>
                {t("editor.reset.callsEndpoint")}{" "}
                <code dir="ltr" className="font-mono text-[11.5px] text-text">
                  PUT /template/{"{id}"}/reset
                </code>
                .
              </Hint>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !saved || typed.trim() !== RESET_CONFIRM_WORD}
            onClick={onConfirm}
          >
            {busy && (
              <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
            )}
            {busy ? t("editor.reset.resetting") : t("editor.reset.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
  )
}
