"use client"

import * as React from "react"
import { Check, Loader2, Pencil, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { readApiError } from "@/components/ui/confirm-dialog"
import { useUpdateIdVars } from "@/features/ids/api"
import { isEditableField, type RequestField } from "@/features/ids/fields"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * One template variable on an issued card, editable in place —
 * docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4c.
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
 * of options; anything else is text. The type comes from the template's
 * design when the page has it; a card whose template could not be read gets
 * a text box for everything, which is what the reference client did all the
 * time.
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

/** Types whose control is the calendar. */
const DATE_TYPES = ["date", "issue_date", "expiration_date"]

/** Types whose control is a list of the design's own options. */
const SELECT_TYPES = ["select", "gender", "province"]

/** Only what the picker can show — anything else starts the edit blank. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/

export function EditableField({
  card,
  field,
  canEdit,
}: {
  card: IDCard
  field: RequestField
  /** The `update-identity` grant. Without it the value is read-only text. */
  canEdit: boolean
}) {
  const t = useT()
  const update = useUpdateIdVars()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [invalid, setInvalid] = React.useState<string | null>(null)

  const editable = canEdit && isEditableField(field)
  const type = field.type?.toLowerCase() ?? "text"
  const isDate = DATE_TYPES.includes(type)
  const isNumber = type === "number"
  const isSelect = SELECT_TYPES.includes(type) && (field.options?.length ?? 0) > 0

  const begin = () => {
    // A stored date the picker cannot read starts the edit empty rather than
    // as a string the picker would silently refuse.
    setDraft(isDate ? (ISO_DAY.exec(field.value)?.[0] ?? "") : field.value)
    setInvalid(null)
    update.reset()
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setInvalid(null)
    update.reset()
  }

  const save = () => {
    const value = draft.trim()
    let wire: string | number = value

    if (isNumber) {
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
    update.mutate(
      {
        id: card.id,
        data: {
          [field.key]: wire,
          template_id: card.template?.id ?? card.templateId ?? 0,
          // `null` omits the key (utils/objects.ts) — a template with no
          // owner sends no `organization_id` at all, as the spec has it.
          organization_id: card.template?.organization?.id ?? card.organization?.id,
          identity: card.id,
        },
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  const saving = update.isPending
  const error =
    invalid ??
    (update.isError
      ? readApiError(update.error, t("ids.fields.saveFailed"), t("common.cannotReachServer"))
      : null)

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
                items={(field.options ?? []).map((option) => ({
                  value: option,
                  label: option,
                }))}
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
                  {(field.options ?? []).map((option) => (
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
            ) : (
              <Input
                aria-label={field.label}
                aria-invalid={error ? true : undefined}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                inputMode={isNumber ? "decimal" : undefined}
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
        <dd className="group/field mt-1 flex min-w-0 items-center gap-1.5">
          <span
            title={field.value}
            className={cn("min-w-0 truncate text-[13px] text-text-secondary")}
          >
            {field.value}
          </span>
          {editable && (
            <button
              type="button"
              onClick={begin}
              aria-label={t("ids.fields.editLabel", { field: field.label })}
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-md",
                "text-text-placeholder transition-colors outline-none",
                "hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.06)]",
                "focus-visible:ring-2 focus-visible:ring-ring",
                // Revealed on hover at a pointer, always visible on touch,
                // where there is no hover to reveal it with.
                "opacity-100 lg:opacity-0 lg:group-hover/field:opacity-100 lg:focus-visible:opacity-100"
              )}
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
            </button>
          )}
        </dd>
      )}
    </div>
  )
}
