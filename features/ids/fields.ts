import type {
  DesignDocument,
  DesignVariable,
  DesignVariableType,
} from "@/features/templates/design"

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
  /**
   * The variable's type from the design, when known. What decides which
   * control edits it (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4c) — absent, a
   * field is treated as free text.
   */
  type?: DesignVariableType
  /** `select` only: the choices the design offers. */
  options?: string[]
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
   * The template's design, for the labels and types it authored. The list
   * row's embedded template does not carry it; a detail screen fetches
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
      type: variable?.type,
      options: variable?.options,
    })
  }

  return fields
}

/** Types whose value is a file, never text — nothing to type into. */
const FILE_TYPES: readonly DesignVariableType[] = ["image", "file", "signature"]

/**
 * Whether a field can be rewritten in place on an issued card
 * (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4c).
 *
 * `name` and `phone` are the member's, not the card's — they are edited on
 * the member. A file is replaced by re-issuing, not by typing over a URL. And
 * a value that *is* an image URL is a file whatever the design says, because
 * the design might be the thin embedded copy that says nothing.
 */
export function isEditableField(field: RequestField): boolean {
  if (field.key === "name" || field.key === "phone") return false
  if (field.type === "name" || field.type === "phone") return false
  if (field.type && FILE_TYPES.includes(field.type)) return false
  return !field.image
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
