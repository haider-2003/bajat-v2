import type { DesignDocument, DesignVariable } from "@/features/templates/design"

import { buildIssueForm, isMemberVar, type InputKind, type IssueField } from "./issue-form"
import type { IDCard } from "./types"

/**
 * Reading the human-facing fields off an identity row.
 *
 * An `IDCard` says who it belongs to in up to three places and guarantees
 * none of them: `member` when the card was issued to a registered member,
 * `name` / `phone` on the entity per the doc (absent from every live list row
 * seen so far), and inside `request` under whichever variable the template's
 * author happened to name it.
 *
 * Screens should not each re-derive that. A column that reads `card.name`
 * renders a column of dashes over rows that plainly have names on them, which
 * is the failure this file exists to prevent.
 */

/** Request keys that have meant "the person's name", most specific first. */
const NAME_KEYS = ["full_name", ":full_name", "fullName", "name"]

const PHONE_KEYS = ["phone", "phone_number", "mobile"]

/** A request value as a string, or `null` when it holds nothing readable. */
function readRequest(card: IDCard, keys: string[]): string | null {
  const request = card.request
  if (!request) return null

  for (const key of keys) {
    const value = request[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return null
}

/**
 * Who the card is for.
 *
 * `member` wins over `request`: the request holds what was typed into the form
 * at issue time, and the member record is what the same person is called
 * everywhere else in the dashboard. A queue that calls row 4 "test1" while the
 * members screen calls them something else is two names for one person.
 */
export function identityName(card: IDCard): string | null {
  return card.member?.name?.trim() || card.name?.trim() || readRequest(card, NAME_KEYS)
}

export function identityPhone(card: IDCard): string | null {
  return (
    card.member?.phone?.trim() || card.phone?.trim() || readRequest(card, PHONE_KEYS)
  )
}

/**
 * The name and phone *this card* holds, ahead of the member record.
 *
 * The opposite precedence from `identityName`, for the one screen that needs
 * it. A list is asking who this person is; a card's own page is asking what is
 * printed on it, and an edit made there rewrites `request` rather than the
 * member — so reading the member first would show the old name straight after
 * a successful save.
 */
export function cardName(card: IDCard): string | null {
  return readRequest(card, ["name"]) ?? identityName(card)
}

export function cardPhone(card: IDCard): string | null {
  return readRequest(card, ["phone"]) ?? identityPhone(card)
}

/**
 * Which template a card was issued from.
 *
 * `template` is only the embedded copy, and a card can come back without one.
 * The entity has its own `template_id` (docs/api-types.md § ids), and the issue
 * body stored as `request` has it again (docs/ISSUE-ID-FORM.md §8.4).
 */
export function cardTemplateId(card: IDCard): number | undefined {
  const id = card.template?.id ?? card.templateId ?? Number(card.request?.template_id)
  return id > 0 ? id : undefined
}

/** One template variable, ready to render. */
export type RequestField = {
  /** The template's own key, kept verbatim — it is the only stable identifier. */
  key: string
  /**
   * What to call it. The template's own `label` when the design is in hand
   * (`requestFields(card, design)`); otherwise the key made readable —
   * best-effort, since some keys are transliterated Arabic.
   */
  label: string
  value: string
  /** A URL the value points at, rather than text to print. */
  image: boolean
}

const IMAGE_URL = /^https?:\/\//i

/**
 * The template variables on a card, in the order the API sent them.
 *
 * Objects and empty values are dropped rather than printed: `request` is a
 * free-form bag, and a row that shows `[object Object]` is worse than a row
 * that shows one field fewer. Images are flagged rather than filtered — the
 * preview dialog shows the applicant's photo, and a `dl` of labels cannot.
 */
export function requestFields(
  card: IDCard,
  /**
   * The template's design, for the labels it authored. The list row's
   * embedded template does not carry it; a detail screen fetches
   * `GET /template/{id}` and reads it with `readDesign` to get one.
   */
  design?: DesignDocument | null
): RequestField[] {
  const request = card.request
  if (!request) return []

  const vars = new Map<string, DesignVariable>()
  for (const variable of design?.vars ?? []) vars.set(variable.name, variable)

  const fields: RequestField[] = []

  for (const [key, raw] of Object.entries(request)) {
    let value: string

    if (typeof raw === "string") value = raw.trim()
    else if (typeof raw === "number") value = String(raw)
    else if (typeof raw === "boolean") value = raw ? "Yes" : "No"
    else if (Array.isArray(raw)) value = raw.filter((v) => v != null).join(", ")
    else continue

    if (!value) continue

    const variable = vars.get(key)
    fields.push({
      key,
      label: variable?.label?.trim() || humanizeKey(key),
      value,
      image: IMAGE_URL.test(value),
    })
  }

  return fields
}

/** One field on a card's own page, and whether it can be changed there. */
export type CardField = {
  /** The template's own key: what a save sends, verbatim. */
  key: string
  label: string
  /** `""` when the card holds nothing for it yet. */
  value: string
  /** What edits it, or `null` when it cannot be edited here. */
  input: IssueField | null
  /** A picture or an attachment, rather than text to print. */
  media: boolean
  /** Known not to be the operator's to set, as opposed to not known yet. */
  locked: boolean
}

const MEDIA_KINDS: readonly InputKind[] = ["image", "signature", "file"]

/**
 * The generated types whose key the template editor fixes (`lockName` in
 * features/templates/editor-constants.ts), so they can be recognised by name.
 */
const GENERATED_KEYS = new Set(["issue_date", "expiration_date"])

const ISO_DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** An upload that is not a picture: the rest of the issue form's file types. */
const DOCUMENT_URL = /\.(pdf|docx?)(\?|$)/i

/**
 * The control a stored value seems to want, for a card with no design to ask.
 *
 * `aspectRatio: 0` means unknown: `EditableMedia` measures the current picture
 * instead, which was cropped to the slot's shape when it was uploaded.
 */
function guessInput(field: RequestField): IssueField {
  let kind: InputKind = "text"
  if (field.image) kind = DOCUMENT_URL.test(field.value) ? "file" : "image"
  else if (ISO_DAY_ONLY.test(field.value)) kind = "date"

  return {
    name: field.key,
    label: field.label,
    kind,
    face: "none",
    aspectRatio: 0,
    cornerRadiusRatio: 0,
  }
}

/**
 * Keys that are the write's own envelope rather than anything the template
 * collects. The server stores the flat body as `request`
 * (docs/ISSUE-ID-FORM.md §8.4), so they can come back looking like variables.
 */
const ENVELOPE_KEYS = new Set([
  "identity",
  "template_id",
  "organization_id",
  "branchId",
  "branch_id",
  "_method",
])

/**
 * Every field on a card, and what can be done to each.
 *
 * ### The design is the list, not `request`
 *
 * `request` only has the values somebody supplied, so a date left blank at
 * issue, or a photo never uploaded, is not in it — and reading the fields off
 * it would make those the only ones that can never be filled in. So the
 * design's variables come first, empty or not, and a stored key the design
 * does not declare follows them.
 *
 * ### What is locked is what the server generates
 *
 * The rule is the issue form's own: whatever `buildIssueForm` would not ask for
 * at issue, this will not offer at edit. That leaves `issue_date`,
 * `expiration_date`, `incremental` and `random`, all minted by the server
 * (docs/ISSUE-ID-FORM.md §3.2). A stored key the design does not declare is
 * locked too: it is either the server's or left over from an older design, and
 * in neither case does the template print it.
 *
 * ### While the design is on its way, nothing opens
 *
 * `design` is `undefined` until the template read settles. A pencil that showed
 * for a moment on a serial number would be an edit somebody could start.
 *
 * ### With no design, the values have to speak for themselves
 *
 * `null` means there is no design to be had: the template is gone, or this user
 * cannot read it. Refusing every edit on such a card would be the wrong way
 * round, so the controls are guessed from the values and the two generated keys
 * with fixed names stay locked. The cost is known and accepted: a sequence or
 * random variable can be named anything, so only the design can identify it,
 * and on these cards it gets a pencil.
 *
 * `name` and `phone` are skipped: every card has them whatever its design says,
 * so they get their own rows (`cardholderField`) instead of appearing twice.
 */
export function cardFields(card: IDCard, design: DesignDocument | null | undefined): CardField[] {
  const stored = new Map(requestFields(card, design).map((field) => [field.key, field]))
  const fields: CardField[] = []

  if (design) {
    const inputs = new Map(buildIssueForm(design).fields.map((input) => [input.name, input]))

    for (const variable of design.vars) {
      const saved = stored.get(variable.name)
      stored.delete(variable.name)
      if (isMemberVar(variable)) continue

      const input = inputs.get(variable.name) ?? null
      // Generated and not minted yet: nothing to show and nothing to edit.
      if (!input && !saved) continue

      fields.push({
        key: variable.name,
        label: saved?.label ?? variable.label,
        value: saved?.value ?? "",
        input,
        media: input ? MEDIA_KINDS.includes(input.kind) : false,
        locked: !input,
      })
    }
  }

  for (const [key, saved] of stored) {
    if (ENVELOPE_KEYS.has(key) || key === "name" || key === "phone") continue
    const input = design === null && !GENERATED_KEYS.has(key) ? guessInput(saved) : null
    fields.push({
      key,
      label: saved.label,
      value: saved.value,
      input,
      media: saved.image,
      locked: design !== undefined && !input,
    })
  }

  return fields
}

/**
 * The card's `name` or `phone` as an editable row.
 *
 * `POST /identity/{id}` takes them like any other key, which is the same flat
 * body they arrive in at issue. It rewrites the card's copy: the member record
 * is `PUT /member/{id}` and is not touched from here.
 */
export function cardholderField(
  card: IDCard,
  key: "name" | "phone",
  label: string
): CardField {
  return {
    key,
    label,
    value: (key === "name" ? cardName(card) : cardPhone(card)) ?? "",
    input: {
      name: key,
      label,
      kind: "text",
      face: "none",
      aspectRatio: 1,
      cornerRadiusRatio: 0,
    },
    media: false,
    locked: false,
  }
}

/**
 * `":full_name"` → `"Full name"`, `"lmsm~_lwzyfy"` → `"lmsm lwzyfy"`.
 *
 * Template keys are authored by hand and a good number of them are Arabic
 * transliterated into ASCII, where no amount of casing produces a real word.
 * So this only removes the punctuation that is definitely structural and
 * capitalises the first letter — anything cleverer would be inventing meaning.
 * The raw key travels alongside for the cases where the label is unreadable.
 */
function humanizeKey(key: string): string {
  const words = key
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[_~]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()

  if (!words) return key
  return words.charAt(0).toUpperCase() + words.slice(1)
}
