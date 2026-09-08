/**
 * Variable-name normalization — docs/photo-editor-spec.md §10.3.
 *
 * The normalized string is **the data key**: what the dynamic form submits and
 * what the server-side renderer looks up when it substitutes a value. Three
 * consequences fall out of that, and all three are load-bearing:
 *
 *  1. Names are effectively case-insensitive — `DOB` and `dob` collide.
 *  2. **Renaming an existing variable breaks every identity already issued**,
 *     because their stored data is keyed by the old string. This is why §10.6
 *     offers no editing of a definition after creation.
 *  3. A *visible* variable stores its raw name on the element and normalizes at
 *     export time, so the placeholder on the card reads `{FirstName}` while the
 *     exported key is `first_name`. An *invisible* one normalizes immediately.
 */

/**
 * Arabic → Latin, enough to produce a stable ASCII key.
 *
 * The reference implementation calls a `transliterate` package. This table
 * covers the Arabic block, which is the only non-Latin script the product
 * actually takes; swap in a full library here if that stops being true — the
 * rest of the module only depends on this function's signature.
 *
 * Order matters for the two-character sequences, so they are applied first.
 */
const DIGRAPHS: [RegExp, string][] = [
  [/ث/g, "th"],
  [/ذ/g, "dh"],
  [/ش/g, "sh"],
  [/خ/g, "kh"],
  [/غ/g, "gh"],
]

const ARABIC_MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "a", ٱ: "a",
  ب: "b", ت: "t", ج: "j", ح: "h", د: "d",
  ر: "r", ز: "z", س: "s", ص: "s", ض: "d",
  ط: "t", ظ: "z", ع: "a", ف: "f", ق: "q",
  ك: "k", ل: "l", م: "m", ن: "n", ه: "h",
  و: "w", ي: "y", ى: "a", ة: "h", ء: "",
  ئ: "y", ؤ: "w",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
}

/** Harakat and tatweel carry no key information — they are dropped outright. */
const DIACRITICS = /[ؐ-ًؚ-ٰٟـ]/g

export function transliterate(input: string): string {
  let out = input.replace(DIACRITICS, "")
  for (const [pattern, latin] of DIGRAPHS) out = out.replace(pattern, latin)
  return out.replace(/./g, (char) => ARABIC_MAP[char] ?? char)
}

/**
 * The exact pipeline from §10.3: transliterate, lowercase, then collapse
 * spaces, hyphens, dots and apostrophes into underscores.
 *
 * The trailing strip is ours, not the spec's: without it a name like `first!`
 * would produce a key with a character the renderer's lookup cannot express.
 */
export function formatVariableName(name: string): string {
  return transliterate(name.trim())
    .toLowerCase()
    .replace(/[\s\-.']+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
}
