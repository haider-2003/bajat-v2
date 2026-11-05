import type { CardValue, CardValues } from "@/components/id-card/card-render"
import {
  generatedStandIn,
  isMemberVar,
  toArabicDigits,
} from "@/features/ids/issue-form"

import type { DesignDocument, DesignVariable } from "./design"

/**
 * The fake data behind the editor's card preview: one value per variable, chosen
 * by its type, and a picture for every image slot whatever its type says.
 *
 * It reads `design.vars` rather than the editor's list because that is what the
 * issue form and the renderer read, so it also covers a variable an element is
 * bound to without a definition. `gender` and `province` arrive there as
 * `select` (§19.7) and print their first option, which is also how every other
 * choice variable gets a real value from its own list.
 *
 * Unlike the issue form's stand-ins these are never dimmed. Dimming there says
 * "the server will mint this"; here the point is to see the finished card.
 */

/** Words that depend on the operator's language. */
export type SampleWords = {
  name: string
  /** Called with 1, 2, 3… — the caller decides how a lone one reads. */
  text: (n: number) => string
}

const svgDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/**
 * Data URIs rather than `File`s. `useObjectUrl` revokes on the effect cleanup
 * that Strict Mode runs straight after mount, so a slot that mounts already
 * holding a file loses its picture before it loads. The issue form's slots start
 * empty and never meet that; these would on every open.
 *
 * Flat fills only. A silhouette, not a person.
 */
const SAMPLE_PHOTO = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#dfe3e8"/><circle cx="150" cy="118" r="58" fill="#98a2b0"/><path d="M40 300c0-70 50-112 110-112s110 42 110 112z" fill="#98a2b0"/></svg>`
)
const SAMPLE_SIGNATURE = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><path d="M14 54c10-24 22-42 30-38 8 4-10 42-4 44 8 2 16-28 25-25 6 2-4 24 3 25 8 1 14-15 22-14 6 1 1 13 8 13 11 0 22-13 36-12 15 1 28 5 52-3" fill="none" stroke="#1f2a56" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
)

const SAMPLE_DOCUMENT = "sample-document.pdf"
/** The shape the issue form prints: `toApiPhone`'s, country code and all. */
const SAMPLE_PHONE = "9647701234567"
const SAMPLE_NUMBER = "123456"
const SAMPLE_DATE = "1995-03-21"
/** Repeated and cut to the variable's own length, so the width is the real one. */
const SAMPLE_RANDOM_DIGITS = "4829173605"

function randomSample(variable: DesignVariable): string {
  const length = Math.max(1, Math.min(32, variable.randomNumberLength ?? 8))
  return SAMPLE_RANDOM_DIGITS.repeat(4).slice(0, length)
}

/**
 * A value for every variable in the design, keyed by data key.
 *
 * Text variables are numbered when there is more than one, so that two of them
 * can be told apart on the card. Anything not recognised falls through to text:
 * a type added later still gets data rather than a bare `{placeholder}`.
 */
export function sampleCardValues(
  design: DesignDocument,
  identityDuration: number,
  words: SampleWords
): CardValues {
  let textCount = 0

  const sampleFor = (variable: DesignVariable): CardValue => {
    const digits = (text: string): CardValue => ({
      text: variable.arabicNumbers ? toArabicDigits(text) : text,
    })

    if (isMemberVar(variable)) {
      const isPhone = variable.type === "phone" || variable.name === "phone"
      return { text: isPhone ? SAMPLE_PHONE : words.name }
    }
    if (variable.options?.length) return { text: variable.options[0] }

    switch (variable.type) {
      // `text` on the two pictures is never drawn: an image slot reads `src`. It
      // names the value when the variable is form-only and has no slot to fill.
      case "image":
        return { src: SAMPLE_PHOTO, text: "sample-photo.svg" }
      case "signature":
        return { src: SAMPLE_SIGNATURE, text: "sample-signature.svg" }
      case "file":
        return { text: SAMPLE_DOCUMENT }
      case "number":
        return digits(SAMPLE_NUMBER)
      case "date":
        return digits(SAMPLE_DATE)
      case "random":
        return digits(randomSample(variable))
      case "issue_date":
      case "expiration_date":
      case "incremental":
        return digits(generatedStandIn(variable, identityDuration))
      default:
        textCount += 1
        return { text: words.text(textCount) }
    }
  }

  const values: CardValues = {}
  for (const variable of design.vars) values[variable.name] = sampleFor(variable)

  // The slot has the last word. A saved design can bind an image element to a
  // variable with no type, `file`, `text` or an older word for a photo. None of
  // those reach the pictures above, and the slot would stay an empty `{name}`.
  for (const page of design.pages) {
    for (const element of page.elements) {
      if (element.kind !== "image" || !element.variable) continue
      if (values[element.variable]?.src) continue
      values[element.variable] = { ...values[element.variable], src: SAMPLE_PHOTO }
    }
  }

  return values
}
