"use client"

import * as React from "react"
import { ExternalLink, Eye, ImagePlus, Loader2, Paperclip, Pencil, PenLine } from "lucide-react"

import { DynamicField } from "@/components/id-card/dynamic-field"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
 * ### An editable value looks like the field it turns into
 *
 * Operators on this page could not tell it was editable: first with a pencil
 * revealed on hover, then with a small pencil always showing. So an editable
 * value is drawn as the input it becomes, the same box in the same place, with
 * the word "edit" in it, and all of it is the click target. A value that cannot
 * be changed stays plain text, so the difference reads without any explaining.
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

/** §18.7 — 44px for touch, the §10.1 36px box from 768px up. */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

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
      // In the group, the group sets the height.
      className={isPhone ? "text-base md:text-sm" : CONTROL}
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

  const shown = isPhone ? formatPhone(field.value) : field.value
  const digits = isPhone && Boolean(field.value)

  return (
    <div className="min-w-0">
      <dt title={field.key} className="truncate text-xs text-text-muted">
        {field.label}
      </dt>

      {editing ? (
        <dd className="mt-1.5">
          <div className="flex items-center gap-1.5">
            {isSelect ? (
              <Select
                items={options.map((option) => ({ value: option, label: option }))}
                value={draft || null}
                onValueChange={(value) => setDraft(value ?? "")}
                disabled={saving}
                defaultOpen
              >
                <SelectTrigger
                  aria-label={field.label}
                  className="w-full min-w-0 border-input bg-surface text-base data-[size=default]:h-11 md:text-sm md:data-[size=default]:h-9 dark:bg-surface-sunken"
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
                defaultOpen
                className={cn("w-full", CONTROL)}
              />
            ) : isPhone ? (
              // `ltr` for the whole group, as on the issue form: the code stays
              // on the left and the digits run away from it in either language.
              <InputGroup dir="ltr" className="h-11 min-w-0 flex-1 md:h-9">
                <InputGroupAddon className="text-base text-text-secondary md:text-sm">
                  +964
                </InputGroupAddon>
                {box}
              </InputGroup>
            ) : (
              box
            )}

            <Button
              type="button"
              className="h-11 shrink-0 md:h-9"
              disabled={saving}
              onClick={save}
            >
              {saving && (
                <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
              )}
              {t("common.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 md:h-9"
              disabled={saving}
              onClick={cancel}
            >
              {t("common.cancel")}
            </Button>
          </div>
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </dd>
      ) : editable ? (
        <dd className="mt-1.5">
          <button
            type="button"
            onClick={begin}
            title={field.value || undefined}
            // The value is part of the name: a screen reader hears what is
            // there now, not only that it can be changed.
            aria-label={
              t("ids.fields.editLabel", { field: field.label }) +
              (field.value ? `: ${shown}` : "")
            }
            className={cn(
              "group/edit flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 text-start",
              "border-input bg-surface dark:bg-surface-sunken",
              "transition-[border-color,box-shadow] duration-120 outline-none",
              "hover:border-accent-violet",
              "focus-visible:border-accent-violet focus-visible:ring-3 focus-visible:ring-ring/45",
              CONTROL
            )}
          >
            <span
              dir={isPhone ? "ltr" : undefined}
              className={cn(
                "min-w-0 truncate",
                field.value ? "text-text" : "text-text-placeholder",
                digits && "font-mono tabular-nums"
              )}
            >
              {field.value ? shown : t("ids.fields.addValue")}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent-violet">
              <Pencil className="size-3" strokeWidth={1.75} aria-hidden />
              {t("common.edit")}
            </span>
          </button>
        </dd>
      ) : (
        <dd
          title={field.value || undefined}
          dir={isPhone ? "ltr" : undefined}
          className={cn(
            "mt-1 truncate text-[13px] text-text-secondary",
            digits && "font-mono tabular-nums rtl:text-end"
          )}
        >
          {field.value ? shown : EMPTY_VALUE}
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
 *
 * ### What is there now stays in view
 *
 * A thumbnail is too small to judge a photo by, so it opens full size, for
 * anyone who can see the card. The upload control starts empty, which would hide
 * the very thing being replaced at the moment it matters, so the current file
 * stays beside it while editing.
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
  const [previewing, setPreviewing] = React.useState(false)

  const input = canEdit ? field.input : null
  const editLabel = t("ids.fields.editLabel", { field: field.label })
  const kind = field.input?.kind
  const isSignature = kind === "signature"
  // An attachment may be a PDF: a link, not an `<img>` it would break.
  const href = kind === "file" && WEB_URL.test(field.value) ? field.value : undefined

  const begin = () => {
    // Only consulted when the design gave no slot shape (`guessInput`). Zero
    // until a picture has loaded, which leaves the square below.
    const image = picture.current
    setMeasured(image?.naturalHeight ? image.naturalWidth / image.naturalHeight : 0)
    setFile(null)
    reset()
    setEditing(true)
  }

  const Glyph = isSignature ? PenLine : kind === "file" ? Paperclip : ImagePlus
  const WELL = "flex size-full items-center justify-center rounded-lg border"

  // A click on the thumbnail is what most people try first, so it works, but for
  // the pointer only: the labelled action under it is the real control, and two
  // of the same control would be announced twice.
  const well = !field.value ? (
    <button
      type="button"
      onClick={begin}
      tabIndex={-1}
      aria-hidden
      className={cn(
        WELL,
        "cursor-pointer border-dashed border-border-strong text-text-placeholder transition-colors outline-none hover:text-text"
      )}
    >
      <Glyph className="size-5" strokeWidth={1.5} />
    </button>
  ) : kind === "file" ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={-1}
      aria-hidden
      className={cn(
        WELL,
        "border-border bg-background-subtle text-text-muted transition-colors outline-none hover:text-text"
      )}
    >
      <Paperclip className="size-5" strokeWidth={1.5} />
    </a>
  ) : (
    <button
      type="button"
      onClick={() => setPreviewing(true)}
      tabIndex={-1}
      aria-hidden
      className="block size-full cursor-zoom-in rounded-lg outline-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a pre-signed
          URL that expires in five minutes; the optimizer would cache a 403. */}
      <img
        ref={picture}
        src={displayImageSrc(field.value)}
        alt={field.label}
        className={cn(
          "size-full rounded-lg border border-border",
          // A photo fills its well. A signature is transparent ink, so it is
          // contained, on the light ground it needs to show in dark mode.
          isSignature ? "bg-white object-contain" : "object-cover"
        )}
      />
    </button>
  )

  /** The way to look at what is stored, in either state. */
  const view = !field.value ? null : kind !== "file" ? (
    <Button
      type="button"
      variant="outline"
      aria-label={`${t("common.preview")}: ${field.label}`}
      className="h-10 w-full sm:h-8"
      onClick={() => setPreviewing(true)}
    >
      <Eye data-icon="inline-start" strokeWidth={1.75} />
      {t("common.preview")}
    </Button>
  ) : href ? (
    <Button
      variant="outline"
      className="h-10 w-full sm:h-8"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <ExternalLink data-icon="inline-start" strokeWidth={1.75} />
      {t("ids.fields.openFile")}
    </Button>
  ) : null

  const previewDialog = field.value && kind !== "file" && (
    <Dialog open={previewing} onOpenChange={setPreviewing}>
      <DialogContent size="lg">
        <DialogCloseButton />
        <DialogHeader>
          <DialogTitle>{field.label}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* eslint-disable-next-line @next/next/no-img-element -- as above. */}
          <img
            src={displayImageSrc(field.value)}
            alt={field.label}
            className={cn(
              "max-h-[70vh] w-full rounded-lg object-contain",
              isSignature ? "bg-white" : "bg-background-subtle"
            )}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )

  if (editing && input) {
    return (
      // The upload control does not fit in a thumbnail's width, so this takes the
      // whole row of the wrapping list it sits in.
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
        {field.value && (
          <div className="flex w-28 shrink-0 flex-col gap-1.5">
            <p className="truncate text-xs text-text-muted">{t("ids.fields.current")}</p>
            <div className="size-28">{well}</div>
            {view}
            {previewDialog}
          </div>
        )}
        <div className="min-w-0 flex-1">
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
              {saving && (
                <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
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
      </div>
    )
  }

  return (
    <figure className="flex w-28 flex-col gap-1.5">
      <div className="size-28">{well}</div>
      <figcaption title={field.key} className="truncate text-[11px] text-text-muted">
        {field.label}
      </figcaption>
      {view}
      {input && (
        <Button
          type="button"
          variant="outline"
          aria-label={editLabel}
          className="h-10 w-full sm:h-8"
          onClick={begin}
        >
          <Pencil data-icon="inline-start" strokeWidth={1.75} />
          {field.value ? t("ids.fields.change") : t("common.add")}
        </Button>
      )}
      {previewDialog}
    </figure>
  )
}
