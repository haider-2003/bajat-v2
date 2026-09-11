import type {
  DesignDocument,
  DesignVariable,
  DesignVariableType,
} from "@/features/templates/design"

import type { CreateIDCardInput } from "./types"

/**
 * The issue form's model — docs/ISSUE-ID-FORM.md §3, §4 and §8, as pure
 * functions over a parsed design.
 *
 * Nothing here touches React or the network. The sheet that renders the form
 * calls `buildIssueForm` once per template and `buildIssuePayload` once per
 * submit; everything between — which input a variable gets, what "empty"
 * means for it, which face it prints on — is decided here so the form, the
 * live preview and the payload read the same answer.
 */

/* ------------------------------------------------------------------ *
 * Which variables are collected
 * ------------------------------------------------------------------ */

/**
 * §4.1 — dropped by *type*. The `isFormHidden` flag says the same thing and
 * is not consulted: the type list is the rule, the flag is the editor's
 * restatement of it, and a reader that checks both would have two rules to
 * keep in step.
 */
export const FORM_HIDDEN_TYPES: readonly DesignVariableType[] = [
  "issue_date",
  "expiration_date",
  "incremental",
  "random",
]

/** Supplied by the member block, never asked for twice. */
const MEMBER_TYPES: readonly DesignVariableType[] = ["name", "phone"]

export const isGeneratedVar = (v: DesignVariable) =>
  FORM_HIDDEN_TYPES.includes(v.type)

/** By type *or* by name: the editor reserves both spellings (§3.3). */
export const isMemberVar = (v: DesignVariable) =>
  MEMBER_TYPES.includes(v.type) || v.name === "name" || v.name === "phone"

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

export type InputKind =
  | "text"
  | "number"
  | "date"
  | "select"
  | "image"
  | "signature"
  | "file"

/**
 * §5.1.1 — selection is by type only, and anything unrecognised degrades to a
 * free text box. A legacy `province` that was never folded into `select`, or
 * a Polotno-era type, must never be the reason the form fails to render.
 */
export function inputKindFor(type: DesignVariableType): InputKind {
  switch (type.toLowerCase()) {
    case "date":
      return "date"
    case "image":
      return "image"
    case "signature":
      return "signature"
    case "number":
      return "number"
    case "file":
      return "file"
    case "select":
      return "select"
    default:
      return "text"
  }
}

/**
 * What the form holds per input, and what the encoder makes of it (§4.6, §8.2).
 *
 * Every kind is a string or a `File` — including `number`, which the reference
 * page stored as a number and collapsed to `0` on every intermediate
 * keystroke (its known gap #9). Holding the typed string instead keeps the
 * field editable; `buildIssuePayload` still sends `0` for an empty one, so the
 * wire contract is unchanged.
 */
export type FormValue = string | File | null

/** Where a variable sits on the card, for grouping the inputs. */
export type Face = "front" | "back" | "none"

export type IssueField = {
  /** The data key — the FormData field name, verbatim. */
  name: string
  label: string
  kind: InputKind
  /** `select` only. Missing on a hand-edited design; the input tolerates it. */
  options?: string[]
  face: Face
  /**
   * §4.3 — the slot's shape, for `image` inputs. The crop is locked to it so
   * the upload lands in the slot exactly. Absent geometry falls back to a
   * square with no rounding.
   */
  aspectRatio: number
  /** A fraction of the slot's shorter side, clamped to 0.5 (a full pill). */
  cornerRadiusRatio: number
}

export type IssueForm = {
  fields: IssueField[]
  /** Whether the design prints the member's name / phone at all. */
  printsName: boolean
  printsPhone: boolean
  /** Whether the design has a second page worth switching to. */
  hasBack: boolean
}

/**
 * The form, derived from a design (§4).
 *
 * ### Face assignment
 *
 * The reference page put every variable without a canvas element — `file`
 * vars, invisible ones — in the front group (its known gap #5). They go in a
 * third group here: they are not printed on either face, and putting a CV
 * upload under "Front of card" tells the operator something untrue.
 *
 * ### Ordering
 *
 * §4.4 — the design's own order within each face, except that image and
 * signature inputs sink to the end of their group. They are the tall inputs,
 * and a photo picker in the middle of four text boxes breaks the run.
 */
export function buildIssueForm(design: DesignDocument): IssueForm {
  const collected = design.vars.filter(
    (v) => !isGeneratedVar(v) && !isMemberVar(v)
  )

  /** Which page each bound variable was found on; last page wins (§4.2). */
  const pageOf = new Map<string, number>()
  const geometry = new Map<string, { aspectRatio: number; cornerRadiusRatio: number }>()

  design.pages.forEach((page, index) => {
    for (const element of page.elements) {
      if (!element.variable) continue
      pageOf.set(element.variable, index)

      if (element.width > 0 && element.height > 0) {
        const radius = element.cornerRadius ?? 0
        geometry.set(element.variable, {
          aspectRatio: element.width / element.height,
          // As a fraction rather than px, because the crop UI draws the mask
          // at a different pixel size than the card (§4.3).
          cornerRadiusRatio:
            radius > 0
              ? Math.min(radius / Math.min(element.width, element.height), 0.5)
              : 0,
        })
      }
    }
  })

  const fields: IssueField[] = collected.map((v) => {
    const page = pageOf.get(v.name)
    const face: Face = page === undefined ? "none" : page === 0 ? "front" : "back"
    const slot = geometry.get(v.name)
    return {
      name: v.name,
      label: v.label,
      kind: inputKindFor(v.type),
      options: v.options,
      face,
      aspectRatio: slot?.aspectRatio ?? 1,
      cornerRadiusRatio: slot?.cornerRadiusRatio ?? 0,
    }
  })

  const isTrailing = (f: IssueField) => f.kind === "image" || f.kind === "signature"
  const ordered = [...fields.filter((f) => !isTrailing(f)), ...fields.filter(isTrailing)]

  const memberTypes = new Set(
    design.vars.filter(isMemberVar).map((v) => (v.name === "phone" || v.type === "phone" ? "phone" : "name"))
  )

  return {
    fields: ordered,
    printsName: memberTypes.has("name"),
    printsPhone: memberTypes.has("phone"),
    hasBack: design.pages.length > 1,
  }
}

/** The fields of one face, in form order. */
export function fieldsOn(form: IssueForm, face: Face): IssueField[] {
  return form.fields.filter((f) => f.face === face)
}

/* ------------------------------------------------------------------ *
 * Values
 * ------------------------------------------------------------------ */

/**
 * §4.5's initial value, by kind. The form does not pre-seed its state with
 * these; it reads a missing key *as* this, which comes to the same thing on
 * the wire and needs no effect to run after the template lands.
 */
export function emptyValue(kind: InputKind): FormValue {
  switch (kind) {
    case "date":
    case "image":
    case "signature":
    case "file":
      return null
    default:
      return ""
  }
}

export type IssueValues = Record<string, FormValue>

/** A field's current value, or its empty value when it has never been touched. */
export function valueOf(values: IssueValues, field: IssueField): FormValue {
  return field.name in values ? values[field.name] : emptyValue(field.kind)
}

/* ------------------------------------------------------------------ *
 * Payload
 * ------------------------------------------------------------------ */

/**
 * §8.1 — the multipart body, exactly.
 *
 * The fixed fields go first and the variables are spread **after** them, as
 * the reference page did: a variable that happens to be named `template_id`
 * would win. The editor blocks `name` / `phone` as variable names; it does
 * not block the others, and preserving the precedence keeps this compatible
 * with whatever the server has learned to expect.
 *
 * Per kind (§8.2):
 *
 *   text / select   ""  →  `key=`           (present, empty — prints blank)
 *   number          ""  →  `key=0`          (there is no unset number)
 *   date            null → *absent*         (leaves the placeholder)
 *   image/signature/file  null → *absent*, File → binary part
 */
export function buildIssuePayload({
  templateId,
  organizationId,
  name,
  phone,
  branchId,
  form,
  values,
}: {
  templateId: number
  organizationId: number | undefined
  name: string
  phone: string
  /** As held by the select — `""` for none. Sent only when set. */
  branchId: string
  form: IssueForm
  values: IssueValues
}): CreateIDCardInput {
  const variables: Record<string, string | number | File | null> = {}

  for (const field of form.fields) {
    const value = valueOf(values, field)
    switch (field.kind) {
      case "number": {
        const text = typeof value === "string" ? value.trim() : ""
        const amount = Number(text)
        variables[field.name] = text && Number.isFinite(amount) ? amount : 0
        break
      }
      case "text":
      case "select":
        // Untrimmed on purpose (§5.2): only the member fields are trimmed.
        variables[field.name] = typeof value === "string" ? value : ""
        break
      case "date":
        variables[field.name] = typeof value === "string" && value ? value : null
        break
      default:
        variables[field.name] = value instanceof File ? value : null
    }
  }

  return {
    identity: "by system",
    name: name.trim(),
    phone: phone.trim(),
    template_id: templateId,
    organization_id: organizationId,
    ...(branchId ? { branchId: Number(branchId) } : {}),
    ...variables,
  }
}

/* ------------------------------------------------------------------ *
 * Preview stand-ins
 * ------------------------------------------------------------------ */

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]

/** `2026-09-11` → `٢٠٢٦-٠٩-١١`, for variables flagged `arabicNumbers`. */
export function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)])
}

const pad2 = (n: number) => String(n).padStart(2, "0")

/** A local date as `yyyy-mm-dd` — the shape the date input and the server share. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * What the preview shows for a variable the server fills in (§3.2's
 * generated types), so the slot is not a bare `{issue_date}`.
 *
 * Plausible, not authoritative — the sheet draws these dimmed. The issue date
 * is today; the expiry is today plus the template's duration, or a dash for a
 * card that never expires; a sequence shows its starting number; a random
 * token shows its length as a run of zeros.
 */
export function generatedStandIn(
  variable: DesignVariable,
  identityDurationMonths: number | null | undefined
): string {
  const today = new Date()
  switch (variable.type) {
    case "issue_date":
      return isoDate(today)
    case "expiration_date": {
      const months = identityDurationMonths ?? 0
      if (months <= 0) return "—"
      const expiry = new Date(today)
      expiry.setMonth(expiry.getMonth() + months)
      return isoDate(expiry)
    }
    case "incremental":
      return String(variable.startingNumber ?? 1)
    case "random":
      return "0".repeat(Math.max(1, Math.min(32, variable.randomNumberLength ?? 8)))
    default:
      return `{${variable.name}}`
  }
}
