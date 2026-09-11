/**
 * The card-template editor's in-memory model — docs/photo-editor-spec.md §6.
 *
 * These types describe the *editor's* shape, not the wire shape. The document
 * is serialized to a Polotno-compatible JSON on save (§19) and parsed back on
 * load (§20); `features/templates/types.ts` stays the API-facing `Template`.
 *
 * ### Geometry is unscaled, always
 *
 * `x` / `y` are the element box's **top-left, relative to the page origin** —
 * not the stage. A resize bakes the scale into `width` / `height` and resets
 * the node scale to 1 (§11.5), so nothing here ever carries a scale factor.
 * Zoom is view state and lives in the store, never on an element.
 */

/** §10.1 — the fifteen kinds a variable can be. */
export type VariableType =
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

export type ElementKind = "text" | "image" | "shape"

export type ShapeVariant = "rect" | "circle" | "ellipse"

export type TextAlign = "left" | "center" | "right"

/**
 * One element on one page.
 *
 * Deliberately a single flat type rather than a discriminated union per kind.
 * The property editor reads the same five geometry fields off every element,
 * and a union would make every one of those reads a narrow first. `kind` is
 * what the renderer switches on.
 */
export type CanvasElement = {
  id: string
  kind: ElementKind
  /** Author-facing name. The layer list shows the variable instead when bound. */
  name: string

  x: number
  y: number
  width: number
  height: number
  /** Degrees, around the element's top-left origin (§5). */
  rotation: number
  /** Stored 0–1; the property editor edits it as 0–100 in steps of 5 (§13.1). */
  opacity: number
  locked?: boolean

  // ── text ──────────────────────────────────────────────────────────────
  text?: string
  fontSize?: number
  fontFamily?: string
  /** The model keeps weight and style apart; the renderer composes them (§11.1). */
  fontWeight?: "bold" | "normal"
  fontStyle?: "italic" | "normal"
  textDecoration?: "underline" | ""
  align?: TextAlign
  /** Not in the spec's field list — editor-only sugar, dropped on export. */
  letterSpacing?: number

  // ── shared paint ──────────────────────────────────────────────────────
  fill?: string
  stroke?: string
  strokeWidth?: number
  /** Images have no native corner radius; the renderer clips a group (§11.1). */
  cornerRadius?: number

  // ── image ─────────────────────────────────────────────────────────────
  /** A data URI, never an object URL — the document must survive a reload (§9.2). */
  src?: string

  // ── shape ─────────────────────────────────────────────────────────────
  shape?: ShapeVariant

  // ── QR (§9.4) ─────────────────────────────────────────────────────────
  isQR?: boolean
  /** Always `"no-data"` at authoring time; the renderer substitutes the real key. */
  qrValue?: string
  qrColor?: string
  /**
   * Quiet-zone width in **modules**, not pixels — so the padding stays
   * proportional when the slot is resized.
   *
   * The spec's printer-column QR uses 1. This one defaults to 2, because a
   * template's QR is placed against artwork rather than a white table cell and
   * one module of white disappears against a dark band.
   */
  qrMargin?: number
  /**
   * Drop the light modules to alpha 0 so the artwork shows through.
   *
   * Off by default, and it should stay off unless the artwork behind it is
   * genuinely pale: a scanner needs light/dark contrast, and a transparent code
   * over a dark band is a code that will not read.
   */
  qrTransparent?: boolean

  /**
   * The variable this element prints, by **raw** name.
   *
   * Raw, not normalized: §10.3 normalizes a visible variable's name at *export*
   * time, so the on-canvas placeholder reads `{FirstName}` while the exported
   * data key is `first_name`. Normalizing here would change what the operator
   * sees on the card.
   */
  variable?: string
}

export type EditorPage = {
  id: string
  /** Index-derived in the UI — first is Front, second is Back (§14). */
  name: string
  background: string
  /**
   * A full-bleed background picture — **preserved, never authored**.
   *
   * No panel writes one: the Page panel offers a colour and nothing else. It is
   * here because a document authored in the legacy tool can carry one (§19.2),
   * and a save that silently dropped it would erase the artwork of every
   * template imported from there.
   */
  backgroundImage?: string
  elements: CanvasElement[]
}

/**
 * A variable definition.
 *
 * `isVisible: false` means **no canvas element at all** — the variable exists
 * only to appear in the data-collection form the backend builds from `vars[]`.
 * That is the whole reason this list is separate from the element tree.
 */
export type EditorVariable = {
  name: string
  label: string
  type: VariableType
  isVisible: boolean
  /** `select` / `province` / `gender` only. */
  options?: string[]
  /** `random` only — digit count, default 8. */
  randomNumberLength?: number
  /** `incremental` only. */
  startingNumber?: number
  /** Numeric types only — render ٠١٢٣ instead of 0123. */
  arabicNumbers?: boolean
}

/** §15 — metadata, stored as columns on the template record, not in the design JSON. */
export type TemplateConfig = {
  title: string
  description: string
  price: number
  /** Months until an issued identity expires. **`0` means never.** */
  identityDuration: number
  branchRequired: boolean
}

export type EditorDocument = {
  width: number
  height: number
  pages: EditorPage[]
}

/** px / cm / mm — a display transform only; storage is always px (§5.2). */
export type DisplayUnit = "px" | "cm" | "mm"

/** Which authoring panel the rail has open. */
export type PanelKey = "text" | "image" | "qr" | "variables" | "page"
