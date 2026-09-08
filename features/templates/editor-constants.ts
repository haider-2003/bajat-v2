import type { DisplayUnit, VariableType } from "./editor-types"
import type { TranslationKey } from "@/i18n/translate"

/**
 * Every domain constant the editor is built from — docs/photo-editor-spec.md.
 *
 * These are values the *renderer and the backend already agree on*, so they are
 * not preferences. Changing `SNAP_THRESHOLD` is a UX call; changing
 * `ID_CARD_WIDTH` or `GUIDE_COLOR` changes what comes out of the printer.
 */

// ── Geometry (§5) ────────────────────────────────────────────────────────
export const ID_CARD_WIDTH = 323
export const ID_CARD_HEIGHT = 204

/** Vertical gap between the two stacked faces, in canvas units (§5.1). */
export const PAGE_GAP = 60

/**
 * Snap tolerance in **canvas units, unscaled** (§11.2).
 *
 * Unscaled is the point: the effective screen tolerance shrinks as you zoom in,
 * so a zoomed-in nudge lands where you put it instead of being yanked.
 */
export const SNAP_THRESHOLD = 4

/** Guides and Alt-measurements. Fixed by the renderer — not a theme token. */
export const GUIDE_COLOR = "#f24e1e"

// ── Zoom (§4.4) — view state, never part of the document ─────────────────
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 4
export const ZOOM_STEP = 0.25
export const ZOOM_DEFAULT = 2.5

// ── History (§8) ─────────────────────────────────────────────────────────
export const HISTORY_LIMIT = 50

// ── Unit conversion (§5.2) ───────────────────────────────────────────────
/**
 * 96 px/inch, while the exported JSON declares 72 dpi.
 *
 * That mismatch is deliberate and load-bearing: the document is authored in CSS
 * pixels and *labelled* 72 dpi. "Fixing" it changes every stored coordinate's
 * physical meaning and breaks byte-compatibility with the existing renderer.
 */
export const PX_PER_CM = 96 / 2.54
export const PX_PER_MM = 96 / 25.4

export function pxToUnit(px: number, unit: DisplayUnit): number {
  if (unit === "cm") return Math.round((px / PX_PER_CM) * 100) / 100
  if (unit === "mm") return Math.round((px / PX_PER_MM) * 10) / 10
  return Math.round(px)
}

export function unitToPx(value: number, unit: DisplayUnit): number {
  if (unit === "cm") return Math.round(value * PX_PER_CM)
  if (unit === "mm") return Math.round(value * PX_PER_MM)
  return Math.round(value)
}

export const UNIT_MIN: Record<DisplayUnit, number> = { px: 50, cm: 1, mm: 10 }
export const UNIT_STEP: Record<DisplayUnit, number> = { px: 1, cm: 0.1, mm: 1 }

// ── Text presets (§9.1) ──────────────────────────────────────────────────
/**
 * `key` stays the stable identity; `labelKey` is what the button reads and
 * `textKey` is the placeholder that lands on the card.
 *
 * Both are dictionary keys rather than words. A module constant is evaluated
 * once per process, so a literal would freeze to whichever language rendered
 * first — and the placeholder is the more important of the two: dropping
 * "Heading" onto an Arabic card leaves the operator a Latin word to delete
 * before they can start typing.
 */
export const TEXT_PRESETS = [
  {
    key: "Heading",
    labelKey: "editor.text.heading",
    textKey: "editor.text.headingSample",
    fontSize: 24,
    fontWeight: "bold",
  },
  {
    key: "Subheading",
    labelKey: "editor.text.subheading",
    textKey: "editor.text.subheadingSample",
    fontSize: 18,
    fontWeight: "bold",
  },
  {
    key: "Body",
    labelKey: "editor.text.body",
    textKey: "editor.text.bodySample",
    fontSize: 14,
    fontWeight: "normal",
  },
  {
    key: "Small",
    labelKey: "editor.text.small",
    textKey: "editor.text.smallSample",
    fontSize: 10,
    fontWeight: "normal",
  },
] as const satisfies readonly {
  key: string
  labelKey: TranslationKey
  textKey: TranslationKey
  fontSize: number
  fontWeight: string
}[]

/** §13.1 — a fixed list, because the server-side renderer has to have the face. */
export const FONT_FAMILIES = [
  "Arial",
  "Cairo",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Impact",
  "Comic Sans MS",
] as const

// ── Page size presets (§14) ──────────────────────────────────────────────
/**
 * `key` is the identity the picker compares against; `labelKey` is what it
 * reads. The dimensions are the contract with the renderer and never move.
 */
export const SIZE_PRESETS = [
  { key: "ID Card (CR-80)", labelKey: "editor.sizes.idCard", width: 323, height: 204 },
  { key: "A7 Card", labelKey: "editor.sizes.a7", width: 280, height: 397 },
  { key: "Business Card", labelKey: "editor.sizes.business", width: 336, height: 192 },
  { key: "A6 Card", labelKey: "editor.sizes.a6", width: 397, height: 559 },
  { key: "Passport", labelKey: "editor.sizes.passport", width: 295, height: 420 },
  { key: "Custom (Square)", labelKey: "editor.sizes.square", width: 300, height: 300 },
] as const satisfies readonly {
  key: string
  labelKey: TranslationKey
  width: number
  height: number
}[]

// ── Image intake (§9.2) ──────────────────────────────────────────────────
export const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
/** Anything larger on either side is scaled down proportionally on insert. */
export const IMAGE_MAX_EDGE = 300

/**
 * Default quiet zone for a QR element, in **modules**.
 *
 * The spec's printer-column QR uses 1. A template's QR sits on artwork rather
 * than a white table cell, where one module of white disappears against a dark
 * band — so this one starts at 2.
 */
export const DEFAULT_QR_MARGIN = 2

// ── Options (§10.2) ──────────────────────────────────────────────────────
export const PROVINCE_OPTIONS = [
  "بغداد", "البصرة", "نينوى", "الأنبار", "أربيل", "كركوك",
  "النجف", "كربلاء", "واسط", "صلاح الدين", "ديالى", "المثنى",
  "القادسية", "ذي قار", "بابل", "ميسان", "السليمانية", "دهوك",
] as const

export const GENDER_OPTIONS = ["ذكر", "أنثى"] as const

/** §10.7 — the word that has to be typed before a sequence reset will run. */
export const RESET_CONFIRM_WORD = "حذف"

/**
 * Every variable type, with the rules that govern its authoring form.
 *
 * Grouped by **who supplies the value**, which is the distinction that actually
 * changes what the operator has to do. A flat list of fifteen hides it.
 */
export type VariableTypeMeta = {
  value: VariableType
  /** Dictionary key — resolve with `t()` at the call site. */
  labelKey: TranslationKey
  /**
   * The grouping, as a stable identifier rather than a heading.
   *
   * `VARIABLE_GROUP_LABELS` below maps it to a dictionary key. Keeping the id
   * in English is deliberate: it is compared (`t.group === group`) and would
   * otherwise change identity with the language.
   */
  group: "Typed" | "Choice" | "Uploaded" | "From member" | "Generated"
  /** What lands on the canvas, or `null` for a type that never prints. */
  element: "text" | "image" | null
  /** Value comes from the member record; never re-collected in the form. */
  member?: boolean
  /** System-generated — excluded from the data-collection form (§10.2). */
  formHidden?: boolean
  /** May carry the `arabicNumbers` flag. */
  numeric?: boolean
  /** Needs at least one option before it can be created. */
  options?: boolean
  /** Options come preloaded and stay editable. */
  preloadProvinces?: boolean
  /** Options are a constant — the draft's list is ignored. */
  fixedOptions?: boolean
  lockName?: boolean
  lockLabel?: boolean
  forceVisible?: boolean
  forceInvisible?: boolean
  /** Carries `startingNumber`, and the destructive reset. */
  sequence?: boolean
  /** Carries `randomNumberLength`. */
  random?: boolean
  /** Unavailable when the template never expires (§10.1). */
  needsDuration?: boolean
}

export const VARIABLE_TYPES: VariableTypeMeta[] = [
  { value: "text", labelKey: "editor.variables.text", group: "Typed", element: "text" },
  { value: "number", labelKey: "editor.variables.number", group: "Typed", element: "text", numeric: true },
  { value: "date", labelKey: "editor.variables.date", group: "Typed", element: "text", numeric: true },

  { value: "select", labelKey: "editor.variables.select", group: "Choice", element: "text", options: true },
  { value: "province", labelKey: "editor.variables.province", group: "Choice", element: "text", options: true, preloadProvinces: true },
  { value: "gender", labelKey: "editor.variables.gender", group: "Choice", element: "text", options: true, fixedOptions: true },

  { value: "image", labelKey: "editor.variables.image", group: "Uploaded", element: "image" },
  { value: "signature", labelKey: "editor.variables.signature", group: "Uploaded", element: "image" },
  { value: "file", labelKey: "editor.variables.file", group: "Uploaded", element: null, forceInvisible: true },

  { value: "name", labelKey: "editor.variables.name", group: "From member", element: "text", member: true, lockName: true, lockLabel: true, forceVisible: true },
  { value: "phone", labelKey: "editor.variables.phone", group: "From member", element: "text", member: true, lockName: true, lockLabel: true, forceVisible: true },

  { value: "issue_date", labelKey: "editor.variables.issueDate", group: "Generated", element: "text", lockName: true, formHidden: true, numeric: true },
  { value: "expiration_date", labelKey: "editor.variables.expirationDate", group: "Generated", element: "text", lockName: true, formHidden: true, numeric: true, needsDuration: true },
  { value: "incremental", labelKey: "editor.variables.incremental", group: "Generated", element: "text", formHidden: true, numeric: true, sequence: true },
  { value: "random", labelKey: "editor.variables.random", group: "Generated", element: "text", formHidden: true, numeric: true, random: true },
]

export const VARIABLE_GROUPS = [
  "Typed",
  "Choice",
  "Uploaded",
  "From member",
  "Generated",
] as const

/** The heading each group reads as, keyed by its stable id. */
export const VARIABLE_GROUP_LABELS: Record<
  (typeof VARIABLE_GROUPS)[number],
  TranslationKey
> = {
  Typed: "editor.variableGroups.typed",
  Choice: "editor.variableGroups.choice",
  Uploaded: "editor.variableGroups.uploaded",
  "From member": "editor.variableGroups.fromMember",
  Generated: "editor.variableGroups.generated",
}

export function variableMeta(type: VariableType): VariableTypeMeta {
  return VARIABLE_TYPES.find((t) => t.value === type) ?? VARIABLE_TYPES[0]
}

/** The four types whose name is written by the type itself (§10.4). */
export const AUTO_FILLED_TYPES: VariableType[] = [
  "issue_date",
  "expiration_date",
  "name",
  "phone",
]

/** Keys owned by the member record — a variable may not claim them (§10.4). */
export const RESERVED_NAMES = ["name", "phone"]

/** Swatches offered wherever a color is picked. */
export const EDITOR_SWATCHES = [
  "#ffffff", "#000000", "#151b2e", "#1c1c1c", "#5b6472", "#9aa2ad",
  "#c8a45c", "#7c3aed", "#2563eb", "#16a34a", "#ea580c", "#dc2626",
]
