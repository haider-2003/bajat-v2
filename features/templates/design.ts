/**
 * Reading a stored template design — docs/photo-editor-spec.md §19–§20.
 *
 * `Template.template` is the editor's Polotno-compatible JSON: pages of
 * children plus a `vars[]` schema. Two things on the dashboard need to read it
 * without being the editor — the issue form, which turns `vars[]` into inputs,
 * and the live card preview, which draws the pages with the operator's values
 * substituted in. This is the one reader they share, so the two cannot
 * disagree about which element a variable sits on.
 *
 * ### Deliberately tolerant
 *
 * §20 is the contract: every field has a fallback and unknown keys are
 * ignored. A template authored by hand, by an older editor, or by the legacy
 * Polotno tool still has to render *something* — a design that throws on a
 * missing `fontSize` takes the whole issue sheet down with it.
 *
 * ### Keys arrive camelCase, whatever was written
 *
 * The editor writes every field twice — `font_size` *and* `fontSize` — and the
 * response interceptor (utils/api/key-conversion.ts) deep-camelizes the whole
 * body, stored JSON included, so by the time this runs the snake spellings have
 * collapsed into the camel ones. Each read still checks both: this reader is
 * also the right thing to point at a design that never went through the
 * interceptor (a file import, a fixture).
 */

export type DesignVariableType =
  | "text"
  | "number"
  | "image"
  | "date"
  | "file"
  | "issue_date"
  | "expiration_date"
  | "select"
  | "province"
  | "gender"
  | "incremental"
  | "random"
  | "signature"
  | "name"
  | "phone"
  | (string & {})

/** One entry of `vars[]` — the schema half of the document (§19.8). */
export type DesignVariable = {
  /** The data key: what the form submits and the renderer looks up. */
  name: string
  label: string
  /** Lower-cased, otherwise verbatim — `gender` / `province` are already `select`. */
  type: DesignVariableType
  /** `false` means no canvas element: collected, never drawn. */
  isVisible: boolean
  options?: string[]
  /** Generated server-side, never asked for (§19.8). */
  isFormHidden: boolean
  /** Numeric types: print ٠١٢٣ rather than 0123. */
  arabicNumbers: boolean
  startingNumber?: number
  randomNumberLength?: number
}

export type DesignElementKind = "text" | "image" | "shape"

export type DesignElement = {
  id: string
  kind: DesignElementKind
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number

  // text
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  align?: "left" | "center" | "right"
  lineHeight?: number
  letterSpacing?: number
  fill?: string

  // image
  src?: string
  cornerRadius?: number

  // shape
  shape?: "rect" | "circle" | "ellipse" | "line"
  stroke?: string
  strokeWidth?: number

  // QR (§19.7)
  isQR?: boolean
  qrValue?: string
  qrColor?: string
  /**
   * Quiet-zone width in **modules**, and whether the light modules are
   * transparent.
   *
   * Neither changes what the code encodes — the renderer re-encodes at print
   * time — but both are deliberate authoring choices, and a quiet zone is the
   * usual reason a printed QR stops scanning, so they are carried rather than
   * re-guessed. Absent on a document written before they were stored.
   */
  qrMargin?: number
  qrTransparent?: boolean

  /** The variable this element prints, by data key. */
  variable?: string
  variableType?: DesignVariableType
  variableLabel?: string
}

export type DesignPage = {
  id: string
  width: number
  height: number
  /** A colour. An image background moves to `backgroundImage` (§20.3). */
  background: string
  backgroundImage?: string
  /** Z-order: index 0 is bottom-most. */
  elements: DesignElement[]
}

export type DesignDocument = {
  width: number
  height: number
  pages: DesignPage[]
  vars: DesignVariable[]
}

/* ------------------------------------------------------------------ *
 * Field readers
 * ------------------------------------------------------------------ */

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The first key that holds a value of the wanted kind. */
function pick<T>(
  raw: Raw,
  keys: string[],
  accept: (value: unknown) => value is T
): T | undefined {
  for (const key of keys) {
    const value = raw[key]
    if (accept(value)) return value
  }
  return undefined
}

const isString = (v: unknown): v is string => typeof v === "string"
const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v)
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean"
const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((entry) => typeof entry === "string")

const str = (raw: Raw, ...keys: string[]) => pick(raw, keys, isString)
const num = (raw: Raw, ...keys: string[]) => pick(raw, keys, isNumber)
const bool = (raw: Raw, ...keys: string[]) => pick(raw, keys, isBoolean)

/**
 * A number that may have been stored as a string — `"8"` for a random length
 * typed into a form and saved without a cast.
 */
function looseNum(raw: Raw, ...keys: string[]): number | undefined {
  const direct = num(raw, ...keys)
  if (direct !== undefined) return direct
  const text = str(raw, ...keys)
  if (text === undefined || text.trim() === "") return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

/* ------------------------------------------------------------------ *
 * Variables
 * ------------------------------------------------------------------ */

/**
 * The type as the dashboard treats it: lower-cased, with the two option-list
 * kinds folded into `select` the way the editor folds them at save (§19.7).
 * Older documents may still carry the raw `gender` / `province`.
 */
function readVariableType(value: string | undefined): DesignVariableType {
  const type = (value ?? "text").trim().toLowerCase()
  if (type === "gender" || type === "province") return "select"
  return type || "text"
}

/** The binding block shared by `vars[]` entries and `children[].custom`. */
function readVariable(raw: Raw): DesignVariable | null {
  const name = str(raw, "variable")?.trim()
  if (!name) return null

  return {
    name,
    label:
      str(raw, "variableLabel", "variable_label")?.trim() || name,
    type: readVariableType(str(raw, "variableType", "variable_type")),
    // Defaults to visible: an invisible variable says so explicitly.
    isVisible: bool(raw, "isVisible", "is_visible") !== false,
    options: pick(raw, ["options"], isStringList),
    isFormHidden: bool(raw, "isFormHidden", "is_form_hidden") === true,
    arabicNumbers: bool(raw, "arabicNumbers", "arabic_numbers") === true,
    startingNumber: looseNum(raw, "startingNumber", "starting_number"),
    randomNumberLength: looseNum(
      raw,
      "randomNumberLength",
      "random_number_length"
    ),
  }
}

/* ------------------------------------------------------------------ *
 * Elements
 * ------------------------------------------------------------------ */

const SHAPES = ["rect", "circle", "ellipse", "line"] as const
type Shape = (typeof SHAPES)[number]

const isShape = (value: string): value is Shape =>
  (SHAPES as readonly string[]).includes(value)

function readAlign(value: string | undefined): DesignElement["align"] {
  return value === "center" || value === "right" ? value : "left"
}

/**
 * §20.1's type detection, with one addition: legacy Polotno `figure` elements
 * are read as shapes through their `subType` rather than becoming an unstyled
 * rectangle. Anything still unrecognised is dropped — a box of nothing on the
 * preview is worse than the element's absence.
 */
function readElement(raw: Raw, index: number): DesignElement | null {
  const type = (str(raw, "type") ?? "").toLowerCase()

  let kind: DesignElementKind
  let shape: Shape | undefined
  if (type === "text") kind = "text"
  else if (type === "image" || type === "svg") kind = "image"
  else if (isShape(type)) {
    kind = "shape"
    shape = type
  } else if (type === "figure") {
    kind = "shape"
    const sub = (str(raw, "subType", "sub_type") ?? "rect").toLowerCase()
    shape = isShape(sub) ? sub : "rect"
  } else {
    return null
  }

  const element: DesignElement = {
    id: str(raw, "id") ?? `element-${index}`,
    kind,
    x: num(raw, "x") ?? 0,
    y: num(raw, "y") ?? 0,
    width: num(raw, "width") ?? 100,
    height: num(raw, "height") ?? 100,
    rotation: num(raw, "rotation") ?? 0,
    opacity: num(raw, "opacity") ?? 1,
  }

  if (kind === "text") {
    element.text = str(raw, "text") ?? ""
    element.fontSize = num(raw, "fontSize", "font_size") ?? 16
    element.fontFamily = str(raw, "fontFamily", "font_family") ?? "Arial"
    element.fontWeight = str(raw, "fontWeight", "font_weight") ?? "normal"
    element.fontStyle = str(raw, "fontStyle", "font_style") ?? "normal"
    element.textDecoration = str(raw, "textDecoration", "text_decoration") ?? ""
    element.align = readAlign(str(raw, "align"))
    element.lineHeight = num(raw, "lineHeight", "line_height") ?? 1.2
    element.letterSpacing = num(raw, "letterSpacing", "letter_spacing") ?? 0
    element.fill = str(raw, "fill") ?? "#000000"
  } else if (kind === "image") {
    element.src = str(raw, "src") ?? ""
    element.cornerRadius = num(raw, "cornerRadius", "corner_radius") ?? 0
  } else {
    element.shape = shape
    element.fill = str(raw, "fill") ?? "#000000"
    element.stroke = str(raw, "stroke") ?? ""
    element.strokeWidth = num(raw, "strokeWidth", "stroke_width") ?? 0
    element.cornerRadius = num(raw, "cornerRadius", "corner_radius") ?? 0
  }

  const custom = raw.custom
  if (isRecord(custom)) {
    const bound = readVariable(custom)
    if (bound) {
      element.variable = bound.name
      element.variableType = bound.type
      element.variableLabel = bound.label
    }
    // The QR marker is spread *over* the binding block (§19.7), so both can
    // be present on one element.
    if (str(custom, "type") === "QR") {
      element.isQR = true
      element.qrValue = str(custom, "value") || "no-data"
      element.qrColor = str(custom, "color") || "#000000"
      const margin = looseNum(custom, "margin")
      if (margin !== undefined) element.qrMargin = margin
      if (bool(custom, "transparent") === true) element.qrTransparent = true
    }
  }

  return element
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

const looksLikeImage = (value: string) =>
  /^https?:\/\//i.test(value) || value.startsWith("data:image")

/**
 * §20.3. `background` is polymorphic — a colour, or a remote image URL when
 * the editor collapsed one into it — so it is split back out here.
 */
function readPage(
  raw: Raw,
  index: number,
  fallback: { width: number; height: number }
): DesignPage {
  const background = str(raw, "background") ?? ""
  const backgroundImage = str(raw, "backgroundImage", "background_image")

  const page: DesignPage = {
    id: str(raw, "id") ?? (index === 0 ? "front-page" : "back-page"),
    width: num(raw, "width") ?? fallback.width,
    height: num(raw, "height") ?? fallback.height,
    background: "#ffffff",
    elements: [],
  }

  if (looksLikeImage(background)) {
    page.backgroundImage = background
  } else {
    page.background = background || "#ffffff"
    if (backgroundImage) page.backgroundImage = backgroundImage
  }

  const children = raw.children
  if (Array.isArray(children)) {
    page.elements = children.flatMap((child, i) =>
      isRecord(child) ? (readElement(child, i) ?? []) : []
    )
  }

  return page
}

/* ------------------------------------------------------------------ *
 * The document
 * ------------------------------------------------------------------ */

/**
 * The design, or `null` when the record carries none.
 *
 * `null` rather than an empty document: a template embedded on another entity
 * (an identity row's `template`) has no design at all, and a caller that gets
 * a blank front page back cannot tell that apart from a design that *is* a
 * blank front page.
 */
export function readDesign(raw: unknown): DesignDocument | null {
  if (!isRecord(raw)) return null

  const width = num(raw, "width") ?? 323
  const height = num(raw, "height") ?? 204

  const rawPages = Array.isArray(raw.pages) ? raw.pages : []
  const pages = rawPages.flatMap((page, i) =>
    isRecord(page) ? [readPage(page, i, { width, height })] : []
  )
  // §20.3 — a document with no pages gets exactly one blank front.
  if (pages.length === 0) {
    pages.push({
      id: "front-page",
      width,
      height,
      background: "#ffffff",
      elements: [],
    })
  }

  /**
   * `vars[]` is the authority for what the form collects. A visible variable
   * whose element survived but whose `vars[]` entry did not (a hand-edited
   * document) is appended from the element, so it still gets an input — the
   * renderer will look its value up either way.
   */
  const vars: DesignVariable[] = []
  const seen = new Set<string>()
  const add = (variable: DesignVariable | null) => {
    if (!variable || seen.has(variable.name)) return
    seen.add(variable.name)
    vars.push(variable)
  }

  if (Array.isArray(raw.vars)) {
    for (const entry of raw.vars) if (isRecord(entry)) add(readVariable(entry))
  }
  for (const page of pages) {
    for (const element of page.elements) {
      if (!element.variable || seen.has(element.variable)) continue
      add({
        name: element.variable,
        label: element.variableLabel ?? element.variable,
        type: element.variableType ?? "text",
        isVisible: true,
        isFormHidden: false,
        arabicNumbers: false,
      })
    }
  }

  return { width, height, pages, vars }
}
