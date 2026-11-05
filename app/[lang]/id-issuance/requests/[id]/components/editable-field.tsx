"use client"

import * as React from "react"
import {
  Check,
  ImagePlus,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  PenLine,
  X,
} from "lucide-react"

import { DynamicField } from "@/components/id-card/dynamic-field"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input, InputGroup, InputGroupAddon } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { readApiError } from "@/components/ui/confirm-dialog"
import { useUpdateIdVars } from "@/features/ids/api"
import { cardTemplateId, type CardField } from "@/features/ids/fields"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"
import { displayImageSrc } from "@/utils/download-image"
import { EMPTY_VALUE, formatPhone, toApiPhone } from "@/utils/format"

/**
 * One field on an issued card, editable in place —
 * docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4c describes the endpoint; which fields it
 * is offered on is `cardFields` (features/ids/fields.ts), and deliberately wider
 * than the reference client, which refused the cardholder and every file.
 *
 * ### One field, one request
 *
 * `POST /identity/{id}` rewrites *one* variable: the key, verbatim, beside
 * `template_id`, `organization_id` and `identity`. So the unit of editing is
 * the field, not the form — a pencil on each value, and a save that sends
 * exactly that value. There is no "edit all" mode because the endpoint has no
 * "save all".
 *
 * ### The control follows the design's type
 *
 * A `date` is a calendar, a `number` a numeric box, a `select` its own list
 * of options; anything else is text. Pictures, signatures and attachments are
 * `EditableMedia` below, on the same controls the issue form uses.
 *
 * ### The pencil is always there
 *
 * It was revealed on hover until an operator looking at this page could not
 * find where to edit. With locked fields on the same screen, the pencil is also
 * what tells the two apart, and that has to be visible at rest.
 *
 * ### Dates go out as the day that was picked
 *
 * `yyyy-mm-dd`, straight from the picker. The reference client ran the date
 * through `toISOString().split("T")[0]`, which is the **UTC** date — an edit
 * made late in the evening in Baghdad was sent as the previous calendar day
 * (spec §9.16). Nothing here touches a `Date` object.
 *
 * ### Failure keeps the field open
 *
 * A save that fails leaves the box in edit mode with the reason under it and
 * the typed value intact, so the fix is a correction rather than a retype.
 * Success is the value changing — the page refetches the card — so there is
 * no toast to say what the field already shows.
 */

/** Only what the picker can show — anything else starts the edit blank. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/

/** What may go in an `href`: `request` holds whatever a public form was sent. */
const WEB_URL = /^https?:\/\//i

/** The one write both kinds of field share, and how it reports back. */
function useFieldSave(card: IDCard) {
  const t = useT()
  const update = useUpdateIdVars()

  return {
    saving: update.isPending,
    error: update.isError
      ? readApiError(
          update.error,
          t("ids.fields.saveFailed"),
          t("common.cannotReachServer"),
          t
        )
      : null,
    reset: update.reset,
    save: (key: string, value: string | number | File, onSaved: () => void) =>
      update.mutate(
        {
          id: card.id,
          data: {
            [key]: value,
            template_id: cardTemplateId(card),
            // `null` omits the key (utils/objects.ts) — a template with no
            // owner sends no `organization_id` at all, as the spec has it.
            organization_id: card.template?.organization?.id ?? card.organization?.id,
            identity: card.id,
          },
        },
        { onSuccess: onSaved }
      ),
  }
}

export function EditableField({
  card,
  field,
  canEdit,
}: {
  card: IDCard
  field: CardField
  /** The `update-identity` grant. Without it the value is read-only text. */
  canEdit: boolean
}) {
  const t = useT()
  const { saving, error: saveError, reset, save: send } = useFieldSave(card)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [invalid, setInvalid] = React.useState<string | null>(null)

  const editable = canEdit && field.input !== null
  const kind = field.input?.kind ?? "text"
  const options = field.input?.options ?? []
  const isDate = kind === "date"
  const isNumber = kind === "number"
  const isSelect = kind === "select" && options.length > 0
  // Both names are reserved by the template editor, so the key is unambiguous.
  const isName = field.key === "name"
  const isPhone = field.key === "phone"

  const begin = () => {
    // A stored date the picker cannot read starts the edit empty rather than
    // as a string the picker would silently refuse.
    if (isDate) setDraft(ISO_DAY.exec(field.value)?.[0] ?? "")
    // The box sits after a fixed `+964`, so it holds the digits after that.
    else if (isPhone) setDraft(toApiPhone(field.value)?.slice(3) ?? field.value)
    else setDraft(field.value)
    setInvalid(null)
    reset()
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setInvalid(null)
    reset()
  }

  const save = () => {
    const value = draft.trim()
    let wire: string | number = value

    if (isPhone) {
      const phone = toApiPhone(value)
      if (!phone) {
        setInvalid(t(value ? "members.form.phoneInvalid" : "issue.form.phoneRequired"))
        return
      }
      wire = phone
    } else if (isName && !value) {
      setInvalid(t("issue.form.nameRequired"))
      return
    } else if (isNumber) {
      const amount = Number(value)
      if (value === "" || !Number.isFinite(amount)) {
        setInvalid(t("ids.fields.numberInvalid"))
        return
      }
      wire = amount
    } else if (isDate && value && !ISO_DAY.test(value)) {
      setInvalid(t("ids.fields.dateInvalid"))
      return
    }

    setInvalid(null)

    // Nothing changed, so nothing to send: a save re-renders the artwork, and
    // on the phone it is also the key the server finds the member by.
    if (String(wire) === field.value) {
      setEditing(false)
      return
    }

    send(field.key, wire, () => setEditing(false))
  }

  const error = invalid ?? saveError

  const box = (
    <Input
      aria-label={field.label}
      aria-invalid={error ? true : undefined}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      type={isPhone ? "tel" : undefined}
      inputMode={isNumber ? "decimal" : isPhone ? "tel" : undefined}
      autoComplete="off"
      autoFocus
      disabled={saving}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          save()
        } else if (event.key === "Escape") {
          event.preventDefault()
          cancel()
        }
      }}
    />
  )

  const shown = field.value ? (isPhone ? formatPhone(field.value) : field.value) : EMPTY_VALUE

  return (
    <div className="min-w-0">
      <dt title={field.key} className="truncate text-xs text-text-muted">
        {field.label}
      </dt>

      {editing ? (
        <dd className="mt-1">
          <div className="flex items-center gap-1.5">
            {isSelect ? (
              <Select
                items={options.map((option) => ({ value: option, label: option }))}
                value={draft || null}
                onValueChange={(value) => setDraft(value ?? "")}
                disabled={saving}
              >
                <SelectTrigger
                  aria-label={field.label}
                  className="h-9 w-full min-w-0 border-input bg-surface text-sm data-[size=default]:h-9 dark:bg-surface-sunken"
                >
                  <SelectValue className="truncate" placeholder={t("common.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : isDate ? (
              <DatePicker
                variant="field"
                label={field.label}
                value={draft}
                onChange={setDraft}
                disabled={saving}
                invalid={!!error}
                className="w-full"
              />
            ) : isPhone ? (
              // `ltr` for the whole group, as on the issue form: the code stays
              // on the left and the digits run away from it in either language.
              <InputGroup dir="ltr" className="h-9 min-w-0 flex-1">
                <InputGroupAddon className="text-sm text-text-secondary">+964</InputGroupAddon>
                {box}
              </InputGroup>
            ) : (
              box
            )}

            <Button
              type="button"
              size="icon-lg"
              variant="default"
              aria-label={t("common.save")}
              disabled={saving}
              onClick={save}
            >
              {saving ? (
                <Loader2 className="animate-spin" strokeWidth={1.75} />
              ) : (
                <Check strokeWidth={1.75} />
              )}
            </Button>
            <Button
              type="button"
              size="icon-lg"
              variant="outline"
              aria-label={t("common.cancel")}
              disabled={saving}
              onClick={cancel}
            >
              <X strokeWidth={1.75} />
            </Button>
          </div>
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </dd>
      ) : (
        <dd className="mt-1 flex min-w-0 items-center gap-1.5">
          <span
            title={field.value || undefined}
            dir={isPhone ? "ltr" : undefined}
            className={cn(
              "min-w-0 truncate text-[13px]",
              field.value ? "text-text-secondary" : "text-text-placeholder",
              isPhone && field.value && "font-mono tabular-nums"
            )}
          >
            {shown}
          </span>
          {editable ? (
            <EditButton
              label={t("ids.fields.editLabel", { field: field.label })}
              onClick={begin}
            />
          ) : (
            // Only for someone who could otherwise edit: to a viewer with no
            // grant, a lock on one field would imply the others are open.
            canEdit &&
            field.locked && (
              <span
                role="img"
                title={t("ids.fields.lockedLabel")}
                aria-label={t("ids.fields.lockedLabel")}
                className="inline-flex shrink-0 text-text-placeholder"
              >
                <Lock className="size-3" strokeWidth={1.75} />
              </span>
            )
          )}
        </dd>
      )}
    </div>
  )
}

/**
 * A photo, a signature or an attachment on the card.
 *
 * Replacing one is the issue form's own control — the crop locked to the slot's
 * shape, the signature pad — because the same reasons apply: a file that is not
 * the slot's shape prints squashed. There is no clearing one from here: `null`
 * is omitted from the multipart body, so the endpoint could not be told.
 */
export function EditableMedia({
  card,
  field,
  canEdit,
}: {
  card: IDCard
  field: CardField
  canEdit: boolean
}) {
  const t = useT()
  const { saving, error, reset, save } = useFieldSave(card)
  const [editing, setEditing] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const picture = React.useRef<HTMLImageElement>(null)
  const [measured, setMeasured] = React.useState(0)

  const input = canEdit ? field.input : null
  const editLabel = t("ids.fields.editLabel", { field: field.label })

  const begin = () => {
    // Only consulted when the design gave no slot shape (`guessInput`). Zero
    // until a picture has loaded, which leaves the square below.
    const image = picture.current
    setMeasured(image?.naturalHeight ? image.naturalWidth / image.naturalHeight : 0)
    setFile(null)
    reset()
    setEditing(true)
  }

  if (editing && input) {
    return (
      // A tile and its actions do not fit in the 80px of a thumbnail, so this
      // takes the whole row of the wrapping list it sits in.
      <div className="w-full">
        <DynamicField
          field={{ ...input, aspectRatio: input.aspectRatio || measured || 1 }}
          value={file}
          onChange={(next) => setFile(next instanceof File ? next : null)}
          disabled={saving}
        />
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            className="h-10 sm:h-8"
            disabled={!file || saving}
            onClick={() => file && save(field.key, file, () => setEditing(false))}
          >
            {saving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
            ) : (
              <Check data-icon="inline-start" strokeWidth={1.75} />
            )}
            {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 sm:h-8"
            disabled={saving}
            onClick={() => {
              reset()
              setEditing(false)
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    )
  }

  const kind = field.input?.kind
  const Glyph = kind === "signature" ? PenLine : kind === "file" ? Paperclip : ImagePlus

  return (
    <figure className="w-20">
      <div className="relative size-20">
        {!field.value ? (
          // The well is the control while there is nothing in it.
          <button
            type="button"
            onClick={begin}
            aria-label={editLabel}
            className={cn(
              "flex size-full items-center justify-center rounded-lg border border-dashed border-border-strong",
              "text-text-placeholder transition-colors outline-none hover:text-text",
              "focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Glyph className="size-5" strokeWidth={1.5} />
          </button>
        ) : kind === "file" ? (
          // An attachment may be a PDF: a link, not an `<img>` it would break.
          <a
            href={WEB_URL.test(field.value) ? field.value : undefined}
            target="_blank"
            rel="noopener noreferrer"
            title={t("ids.fields.openFile")}
            aria-label={t("ids.fields.openFile")}
            className={cn(
              "flex size-full items-center justify-center rounded-lg border border-border bg-background-subtle",
              "text-text-muted transition-colors outline-none hover:text-text",
              "focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Paperclip className="size-5" strokeWidth={1.5} />
          </a>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- a pre-signed
             URL that expires in five minutes; the optimizer would cache a 403. */
          <img
            ref={picture}
            src={displayImageSrc(field.value)}
            alt={field.label}
            className="size-full rounded-lg border border-border object-cover"
          />
        )}

        {input && field.value && (
          <EditButton
            label={editLabel}
            onClick={begin}
            className="absolute inset-e-1 top-1 border border-border bg-surface hover:bg-surface dark:hover:bg-surface"
          />
        )}
      </div>
      <figcaption title={field.key} className="mt-1.5 truncate text-[11px] text-text-muted">
        {field.label}
      </figcaption>
    </figure>
  )
}

function EditButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md",
        "text-text-muted transition-colors outline-none",
        "hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.06)]",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Pencil className="size-3.5" strokeWidth={1.75} />
    </button>
  )
}
