"use client"

import * as React from "react"
import { Paperclip, X } from "lucide-react"

import { DatePicker } from "@/components/ui/date-picker"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FormValue, IssueField } from "@/features/ids/issue-form"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

import { ImageCropField } from "./image-crop"
import { SignatureField } from "./signature-pad"

/**
 * One template variable, as the control its type asks for —
 * docs/ISSUE-ID-FORM.md §5.
 *
 * The whole form is data-driven: nothing here knows what an `employee_no` is,
 * only that its `variableType` is `number`. Adding a variable type means
 * adding a case here and a kind in `features/ids/issue-form.ts`, and nothing
 * else on the screen changes.
 *
 * ### Nothing is marked required
 *
 * The reference implementation put `required` on every dynamic input and then
 * validated none of them (docs/ISSUE-ID-FORM.md §11, gap 1) — an asterisk on
 * every field, enforced nowhere, on a form where an empty value is a legitimate
 * submission the server accepts. The mark is dropped rather than the
 * enforcement added: which variables a template *needs* filled in is not
 * something the design document says, so the client cannot honestly claim to
 * know. The card preview is the feedback loop instead — an empty slot shows its
 * own `{name}` in grey, which is exactly what would be printed.
 */
export function DynamicField({
  field,
  value,
  onChange,
  disabled,
  className,
}: {
  field: IssueField
  value: FormValue
  onChange: (value: FormValue) => void
  disabled: boolean
  /** Goes on the field's wrapper — a grid caller's column span, typically. */
  className?: string
}) {
  const t = useT()

  // The binary kinds carry their own labelled controls, and a `Field` label
  // above a photo well would be a second heading for one thing.
  if (field.kind === "image") {
    return (
      <Field label={field.label} className={className}>
        {(control) => (
          <ImageCropField
            {...control}
            invalid={control["aria-invalid"]}
            describedBy={control["aria-describedby"]}
            value={value instanceof File ? value : null}
            onChange={onChange}
            aspectRatio={field.aspectRatio}
            cornerRadiusRatio={field.cornerRadiusRatio}
            label={field.label}
            disabled={disabled}
          />
        )}
      </Field>
    )
  }

  if (field.kind === "signature") {
    return (
      <Field label={field.label} className={className}>
        {(control) => (
          <SignatureField
            {...control}
            invalid={control["aria-invalid"]}
            describedBy={control["aria-describedby"]}
            value={value instanceof File ? value : null}
            onChange={onChange}
            aspectRatio={field.aspectRatio}
            label={field.label}
            disabled={disabled}
          />
        )}
      </Field>
    )
  }

  if (field.kind === "file") {
    return (
      <Field label={field.label} helper={t("issue.form.fileHelper")} className={className}>
        {(control) => (
          <FileField
            {...control}
            value={value instanceof File ? value : null}
            onChange={onChange}
            label={field.label}
            disabled={disabled}
          />
        )}
      </Field>
    )
  }

  if (field.kind === "date") {
    return (
      <Field label={field.label} className={className}>
        {(control) => (
          <DatePicker
            variant="field"
            id={control.id}
            aria-describedby={control["aria-describedby"]}
            invalid={control["aria-invalid"]}
            // The picker speaks `yyyy-mm-dd`, which is what the endpoint
            // stores — nothing between here and the wire reformats a date.
            value={typeof value === "string" ? value : ""}
            onChange={(next) => onChange(next || null)}
            placeholder={t("issue.form.datePlaceholder")}
            label={field.label}
            disabled={disabled}
            className="h-11 text-base md:h-9 md:text-sm"
          />
        )}
      </Field>
    )
  }

  if (field.kind === "select") {
    const options = field.options ?? []
    return (
      <Field
        label={field.label}
        className={className}
        // A `select` with no options is only reachable from hand-edited JSON
        // (docs/ISSUE-ID-FORM.md §11, gap 7). The reference page threw on it;
        // this says so and stays up.
        error={options.length === 0 ? t("issue.form.selectNoOptions") : undefined}
      >
        {(control) => (
          <Select
            items={options.map((option) => ({ value: option, label: option }))}
            value={typeof value === "string" && value ? value : null}
            onValueChange={(next) => onChange(next ?? "")}
            disabled={disabled || options.length === 0}
          >
            <SelectTrigger
              {...control}
              className="w-full border-input bg-surface text-base data-[size=default]:h-11 focus-visible:border-accent-violet focus-visible:ring-ring/45 md:text-sm md:data-[size=default]:h-9 dark:bg-surface-sunken"
            >
              <SelectValue
                className="truncate"
                placeholder={t("issue.form.selectPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    )
  }

  const numeric = field.kind === "number"

  return (
    <Field label={field.label} className={className}>
      {(control) => (
        <Input
          {...control}
          className="h-11 text-base md:h-9 md:text-sm"
          // `text` with a numeric keypad rather than `type="number"`: a number
          // input's spinner and its scroll-to-change behaviour are both wrong
          // on a form like this, and the value travels as a string anyway.
          inputMode={numeric ? "numeric" : undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange(
              numeric
                ? // Digits, one optional sign, one optional point — so a typed
                  // "12." survives long enough to become "12.5" instead of
                  // collapsing to 0 on the way through (§11, gap 9).
                  event.target.value.replace(/[^\d.-]/g, "")
                : event.target.value
            )
          }
          placeholder={field.label}
          autoComplete="off"
          disabled={disabled}
        />
      )}
    </Field>
  )
}

/**
 * Whether a field wants the whole row.
 *
 * The three that hold a *thing* — a photo, a signature, an attachment — are
 * tiles with a thumbnail, a name and actions in them, and half a row is not
 * enough for that. Everything else is a box you type in, and a box the width
 * of the form is a box far wider than anything typed into it.
 */
export function isWideField(field: IssueField): boolean {
  return field.kind === "image" || field.kind === "signature" || field.kind === "file"
}

/* ------------------------------------------------------------------ *
 * File
 * ------------------------------------------------------------------ */

/** §5.2's accept list — an attachment stored with the identity, never drawn. */
const FILE_ACCEPT =
  "image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

function FileField({
  value,
  onChange,
  label,
  disabled,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  value: File | null
  onChange: (file: File | null) => void
  label: string
  disabled: boolean
  id: string
  "aria-describedby": string | undefined
  "aria-invalid": boolean | undefined
}) {
  const t = useT()
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-describedby={describedBy}
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-lg border bg-surface px-3",
          "text-[13px] font-medium text-text-secondary shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          "transition-colors duration-120 hover:border-border-strong hover:text-text",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "md:h-9 dark:bg-[rgba(255,255,255,0.04)] dark:shadow-none",
          invalid ? "border-danger" : "border-border"
        )}
      >
        <Paperclip className="size-3.5" strokeWidth={1.75} aria-hidden />
        {value ? t("issue.form.fileReplace") : t("issue.form.fileChoose")}
      </button>

      {value ? (
        <>
          <span
            title={value.name}
            className="min-w-0 flex-1 truncate text-[13px] text-text-secondary"
          >
            {value.name}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
            aria-label={t("issue.form.fileRemoveLabel", { field: label })}
            className="inline-flex size-11 items-center justify-center rounded-md text-text-muted transition-colors outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-ring md:size-9"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </>
      ) : (
        <span className="text-[13px] text-text-placeholder">
          {t("issue.form.fileNone")}
        </span>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </div>
  )
}
