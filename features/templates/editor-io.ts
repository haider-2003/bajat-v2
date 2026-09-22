import QRCode from "qrcode"

import { readDesign, type DesignDocument, type DesignVariableType } from "./design"
import { DEFAULT_QR_MARGIN, variableMeta } from "./editor-constants"
import type {
  CanvasElement,
  EditorDocument,
  EditorPage,
  EditorVariable,
  TemplateConfig,
  ShapeVariant,
  VariableType,
} from "./editor-types"
import type { CreateTemplateInput, Template } from "./types"
import { formatVariableName } from "./variable-name"

/**
 * The editor's I/O boundary — docs/photo-editor-spec.md §16, §19, §20 and
 * docs/PHOTO-EDITOR-TEMPLATE-JSON.md.
 *
 * Both directions live here because they are one contract: every key this file
 * writes, it must also be able to read back, and splitting them across two
 * modules is how a round trip quietly starts losing fields.
 *
 *   editor model ──serializeDesign──▶ wire JSON ──▶ POST/PUT /template
 *   editor model ◀──designToEditor── DesignDocument ◀─readDesign─ GET /template
 *
 * The read half is deliberately thin: `readDesign` (./design.ts) is already the
 * tolerant reader the issue form and the card preview share, so the editor uses
 * it too rather than keeping a second, subtly different parser. What is left
 * here is only the mapping from that neutral shape onto the editor's own model.
 *
 * ### One casing, chosen on purpose
 *
 * The reference serializer emits **both** spellings of every dual-cased key
 * (`font_size` *and* `fontSize`) so the payload reads the same on either side of
 * the transport's key conversion. This one emits the **wire** spelling only —
 * snake_case, stage 2 in that document's terms.
 *
 * It is byte-identical where it matters: `decamelizeKeys` leaves an already-
 * snake key untouched (verified against the installed `xcase`), so what reaches
 * the server is the same document either way, ~1.6× smaller before compression.
 * The payoff is the export file, which no longer has to be a third format: what
 * you download is exactly what was sent.
 */

/* ------------------------------------------------------------------ *
 * Wire-level constants
 * ------------------------------------------------------------------ */

/** Polotno document version the server-side renderer consumes. */
const SCHEMA_VERSION = 2

/**
 * §4.2 — Polotno compatibility fields.
 *
 * The editor writes them identically every time and never reads them back. They
 * are here rather than inlined so it is obvious that the list is a constant: a
 * document authored elsewhere that set any of them loses that setting on the
 * first save from this editor, and that is the documented behaviour, not a bug
 * to be fixed by threading thirty more fields through the model.
 */
const ELEMENT_CONSTANTS = {
  name: "",
  visible: true,
  selectable: true,
  removable: true,
  always_on_top: false,
  show_in_export: true,
  animations: [] as unknown[],
  blur_enabled: false,
  blur_radius: 10,
  brightness_enabled: false,
  brightness: 0,
  sepia_enabled: false,
  grayscale_enabled: false,
  filters: {} as Record<string, unknown>,
  shadow_enabled: false,
  shadow_blur: 5,
  shadow_offset_x: 0,
  shadow_offset_y: 0,
  shadow_color: "black",
  shadow_opacity: 1,
  draggable: true,
  resizable: true,
  content_editable: true,
  style_editable: true,
} as const

/** §5.1 — the text fields Polotno wants and this editor has no control for. */
const TEXT_CONSTANTS = {
  placeholder: "",
  text_transform: "none",
  vertical_align: "top",
  stroke_width: 0,
  stroke: "black",
  line_height: 1.2,
  background_enabled: false,
  background_color: "#7ED321",
  background_opacity: 1,
  background_corner_radius: 0.5,
  background_padding: 0.5,
} as const

/**
 * §5.2 — the image fields, same story, with one that is **not** decoration.
 *
 * `stretch_enabled` is load-bearing: without it `polotno-node` draws the source
 * at its natural pixel size and clips the overflow, so a 1200px photo dropped
 * into a 80×100 slot renders as its top-left corner. With it the image fills
 * the element box, which is the only behaviour a photo slot can have.
 */
const IMAGE_CONSTANTS = {
  crop_x: 0,
  crop_y: 0,
  crop_width: 1,
  crop_height: 1,
  flip_x: false,
  flip_y: false,
  clip_src: "",
  border_color: "black",
  border_size: 0,
  keep_ratio: false,
  stretch_enabled: true,
} as const

type Wire = Record<string, unknown>

/* ------------------------------------------------------------------ *
 * Assets — the two srcs the editor does not keep in the model
 * ------------------------------------------------------------------ */

/**
 * A QR element and a variable image slot both render from state rather than
 * from a stored `src`: the canvas paints the QR onto a `<canvas>` from
 * `qrValue`/`qrColor`, and an empty photo slot is drawn as a box with a label.
 * The document has no such luxury — the renderer needs a real image — so both
 * get a `src` synthesized at save time and collected here, keyed by element id.
 *
 * Built separately from `serializeDesign` because QR encoding is asynchronous
 * and a serializer that has to be awaited is a serializer that cannot be called
 * from a render path, a test, or a dry run.
 */
export type DesignAssets = Map<string, string>

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** XML-escapes a label so a variable name with `&` or `<` cannot break the SVG. */
function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * The placeholder that stands in for an unfilled slot — the same two boxes the
 * stage draws, so the exported document looks like the canvas it came from.
 *
 * It is never what gets printed: the renderer replaces the whole `src` with the
 * identity's uploaded photo or signature. It is what a *reviewer* sees when the
 * design is opened anywhere else, which is the only reason it needs to say
 * which variable the slot belongs to.
 */
export function slotPlaceholder(
  kind: "image" | "signature",
  label: string
): string {
  const text = escapeXml(`{${label}}`)

  if (kind === "signature") {
    return svgDataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80">` +
        `<rect x="1" y="1" width="198" height="78" rx="6" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2" stroke-dasharray="6 4"/>` +
        `<text x="100" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#92400E">${text}</text>` +
        `</svg>`
    )
  }

  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" width="150" height="150">` +
      `<rect x="1" y="1" width="148" height="148" rx="6" fill="#F3F4F6" stroke="#D1D5DB" stroke-width="2"/>` +
      `<text x="75" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">${text}</text>` +
      `</svg>`
  )
}

/**
 * The authoring-time QR, as an SVG data URI.
 *
 * It encodes `qrValue` — `"no-data"` unless something changed it — because the
 * real payload is the issued identity's key, which does not exist yet. The
 * renderer re-encodes at print time; this is a true-to-size stand-in so the
 * design can be reviewed and the slot is not empty in an export.
 */
export async function qrPlaceholder(element: CanvasElement): Promise<string> {
  const svg = await QRCode.toString(element.qrValue || "no-data", {
    type: "svg",
    margin: element.qrMargin ?? DEFAULT_QR_MARGIN,
    color: {
      dark: element.qrColor || "#000000",
      // 8-digit hex: alpha 0 on the light modules, so pale artwork shows
      // through instead of being covered by a white square.
      light: element.qrTransparent ? "#00000000" : "#FFFFFF",
    },
  })
  return svgDataUri(svg)
}

/**
 * Every synthesized `src` the document needs, keyed by element id.
 *
 * An element that already carries a `src` (an upload, or a slot loaded from a
 * saved template) is skipped — the bytes it holds are the operator's, and
 * regenerating a placeholder over them would erase an uploaded image.
 */
export async function buildDesignAssets(
  doc: EditorDocument,
  variables: EditorVariable[]
): Promise<DesignAssets> {
  const assets: DesignAssets = new Map()
  const byName = variableIndex(variables)

  for (const page of doc.pages) {
    for (const element of page.elements) {
      if (element.src) continue

      if (element.isQR) {
        try {
          assets.set(element.id, await qrPlaceholder(element))
        } catch {
          // An unencodable payload must not cost the operator the whole save.
          // The element still goes out with its `custom.type: "QR"` marker,
          // which is what the renderer actually keys off.
        }
        continue
      }

      if (element.kind === "image" && element.variable) {
        const definition = byName.get(element.variable)
        assets.set(
          element.id,
          slotPlaceholder(
            definition?.type === "signature" ? "signature" : "image",
            keyOf(element.variable, byName)
          )
        )
      }
    }
  }

  return assets
}

/* ------------------------------------------------------------------ *
 * Variables
 * ------------------------------------------------------------------ */

/** Definitions by the exact name the elements reference (raw for visible ones). */
function variableIndex(variables: EditorVariable[]) {
  return new Map(variables.map((v) => [v.name, v]))
}

/** §10.3 — the data key, whichever spelling the element happens to hold. */
function keyOf(name: string, index: Map<string, EditorVariable>) {
  const definition = index.get(name)
  return formatVariableName(definition?.name ?? name)
}

/**
 * §19.7 — `gender` and `province` are stored as `select`.
 *
 * Nothing downstream can tell them apart from a hand-made select afterwards;
 * the option list is what carries the meaning. Kept for byte-compatibility with
 * the renderer, which knows three option types and not five.
 */
function wireType(type: VariableType): string {
  return type === "gender" || type === "province" ? "select" : type
}

/**
 * The binding block — §5.5 for an element's `custom`, §6 for a `vars[]` entry.
 *
 * One function for both because they are the same object minus the QR trio, and
 * the two drifting apart is exactly how an identity form ends up offering a
 * field the card cannot print.
 */
function variableBlock(variable: EditorVariable, key: string, isVisible: boolean): Wire {
  const meta = variableMeta(variable.type)

  const block: Wire = {
    variable: key,
    variable_label: variable.label || key,
    variable_type: wireType(variable.type),
    is_visible: isVisible,
  }

  if (meta.options && variable.options) block.options = [...variable.options]
  if (meta.random && variable.randomNumberLength) {
    block.random_number_length = variable.randomNumberLength
  }
  // `!== undefined` rather than truthiness: a sequence starting at 0 is a
  // sequence, and dropping it silently restarts the counter at 1.
  if (meta.sequence && variable.startingNumber !== undefined) {
    block.starting_number = variable.startingNumber
  }
  if (meta.numeric && variable.arabicNumbers) block.arabic_numbers = true
  if (meta.formHidden) block.is_form_hidden = true

  return block
}

/**
 * §6.1 — `vars[]`, in the order the renderer and the form both rely on:
 * **page order → z-order → whatever is left, in creation order.**
 *
 * The first two put the form's fields in the same sequence as the card reads,
 * which is the only ordering an operator filling one in can predict. The tail is
 * the form-only variables, which have no position to be ordered by.
 *
 * A variable bound to an element but missing a definition cannot normally
 * happen — deleting a definition deletes its elements — but a hand-edited or
 * imported document can carry one, so it is synthesized rather than dropped.
 * Losing it here would leave the renderer an element with nothing to fill it.
 */
function collectVariables(
  doc: EditorDocument,
  variables: EditorVariable[]
): { key: string; variable: EditorVariable; isVisible: boolean }[] {
  const index = variableIndex(variables)
  const out: { key: string; variable: EditorVariable; isVisible: boolean }[] = []
  const seen = new Set<string>()

  for (const page of doc.pages) {
    for (const element of page.elements) {
      if (!element.variable) continue
      const key = keyOf(element.variable, index)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({
        key,
        variable: index.get(element.variable) ?? {
          name: element.variable,
          label: element.variable,
          type: "text",
          isVisible: true,
        },
        isVisible: true,
      })
    }
  }

  for (const variable of variables) {
    const key = formatVariableName(variable.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ key, variable, isVisible: false })
  }

  return out
}

/* ------------------------------------------------------------------ *
 * Elements
 * ------------------------------------------------------------------ */

function serializeElement(
  element: CanvasElement,
  index: Map<string, EditorVariable>,
  assets: DesignAssets
): Wire {
  const child: Wire = {
    id: element.id,
    type:
      element.kind === "shape"
        ? (element.shape ?? "rect")
        : element.kind === "image"
          ? "image"
          : "text",
    ...ELEMENT_CONSTANTS,
    // Geometry goes in after the constants so `name` cannot be shadowed by the
    // element's author-facing one, which is UI state and not a Polotno layer
    // name (§9).
    x: Math.round(element.x),
    y: Math.round(element.y),
    width: Math.round(element.width),
    height: Math.round(element.height),
    rotation: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
  }

  if (element.kind === "text") {
    Object.assign(child, TEXT_CONSTANTS, {
      text: element.text ?? "",
      font_size: element.fontSize ?? 16,
      font_family: element.fontFamily ?? "Arial",
      font_style: element.fontStyle ?? "normal",
      font_weight: element.fontWeight ?? "normal",
      text_decoration: element.textDecoration ?? "",
      fill: element.fill ?? "#000000",
      align: element.align ?? "left",
      // The reference writes a constant 0 here and nothing downstream reads the
      // key, so carrying the real value costs nothing and is the difference
      // between tracking surviving a reload and not.
      letter_spacing: element.letterSpacing ?? 0,
    })
  } else if (element.kind === "image") {
    Object.assign(child, IMAGE_CONSTANTS, {
      src: element.src || assets.get(element.id) || "",
      corner_radius: element.cornerRadius ?? 0,
    })
  } else {
    Object.assign(child, {
      fill: element.fill ?? "#000000",
      stroke: element.stroke ?? "#000000",
      stroke_width: element.strokeWidth ?? 0,
      corner_radius: element.cornerRadius ?? 0,
    })
  }

  /* §5.5 — the binding, and the QR marker spread over it. An element can carry
     both; the QR keys go last so a bound QR still reads as a QR. */
  const custom: Wire = {}

  if (element.variable) {
    const definition = index.get(element.variable)
    const key = keyOf(element.variable, index)
    if (key) {
      Object.assign(
        custom,
        variableBlock(
          definition ?? {
            name: element.variable,
            label: element.variable,
            type: "text",
            isVisible: true,
          },
          key,
          true
        )
      )
    }
  }

  if (element.isQR) {
    custom.type = "QR"
    custom.value = element.qrValue || "no-data"
    custom.color = element.qrColor || "#000000"
    // Two keys the reference format does not have. Nothing downstream reads
    // them — the renderer re-encodes the code with its own quiet zone — but
    // they are settings the operator chose in the property bar, and an unknown
    // key inside `custom` is inert everywhere it lands. Without them a reload
    // silently puts a deliberately tightened quiet zone back to 2.
    custom.margin = element.qrMargin ?? DEFAULT_QR_MARGIN
    if (element.qrTransparent) custom.transparent = true
  }

  if (Object.keys(custom).length > 0) child.custom = custom

  return child
}

/* ------------------------------------------------------------------ *
 * Serialize — editor model → wire document
 * ------------------------------------------------------------------ */

/**
 * The `template` document — §2 through §6.
 *
 * Pure and synchronous. Everything that needed an encoder ran in
 * `buildDesignAssets` and arrives as `assets`; pass an empty map for a dry run
 * and the only difference is that generated slots come out with an empty `src`.
 *
 * Takes no `TemplateConfig`: the metadata is the *envelope's*, not the
 * document's, and the one place the document mentions a duration is a constant
 * zero the renderer ignores (§2).
 */
export function serializeDesign(
  doc: EditorDocument,
  variables: EditorVariable[],
  assets: DesignAssets = new Map()
): Wire {
  const index = variableIndex(variables)

  const pages = doc.pages.map((page, i) => {
    const wire: Wire = {
      id: page.id || (i === 0 ? "front-page" : "back-page"),
      width: doc.width,
      height: doc.height,
      // §3 — `background` is polymorphic: a remote image URL collapses into it,
      // a data URI stays in its own key. Preserved, never authored: nothing in
      // the UI writes a page image, but a document that arrived with one keeps
      // it across a save.
      background: page.backgroundImage?.startsWith("http")
        ? page.backgroundImage
        : page.background || "#ffffff",
      bleed: 0,
      duration: 5000,
      children: page.elements.map((element) =>
        serializeElement(element, index, assets)
      ),
    }

    if (page.backgroundImage && !page.backgroundImage.startsWith("http")) {
      wire.background_image = page.backgroundImage
    }

    return wire
  })

  return {
    width: doc.width,
    height: doc.height,
    pages,
    vars: collectVariables(doc, variables).map(({ key, variable, isVisible }) =>
      variableBlock(variable, key, isVisible)
    ),
    // §2 — always 0, and not what the server uses. The authoritative duration is
    // the envelope's `identity_duration`; this one is a Polotno-era leftover the
    // renderer still expects to find.
    custom: { identity_duration: 0 },
    fonts: [],
    audios: [],
    unit: "px",
    dpi: 72,
    schema_version: SCHEMA_VERSION,
  }
}

/**
 * §16.1 — the request envelope for `POST /template` / `PUT /template/{id}`.
 *
 * camelCase here and only here: these are the resource's own columns, typed by
 * `CreateTemplateInput`, and the request interceptor decamelizes them on the way
 * out. The `template` value underneath is already snake and passes through it
 * untouched.
 *
 * `price` is a **string** and `isEnabled` is a **string**, both deliberately —
 * docs/api-types.md § cross-feature gotchas, traps 3 and 7. A number for either
 * is rejected by the backend.
 */
export function buildTemplatePayload(
  doc: EditorDocument,
  variables: EditorVariable[],
  config: TemplateConfig,
  assets: DesignAssets
): CreateTemplateInput {
  return {
    title: config.title.trim(),
    description: config.description.trim(),
    price: String(config.price ?? 0),
    template: serializeDesign(doc, variables, assets),
    isEnabled: "1",
    branchRequired: config.branchRequired,
    identityDuration: config.identityDuration,
  }
}

/* ------------------------------------------------------------------ *
 * Export to a file — §16.2
 * ------------------------------------------------------------------ */

/** `<title or slug>-<YYYY-MM-DD>.json`, filesystem-safe in either language. */
export function exportFileName(title: string): string {
  const stem = title.trim().replace(/[\\/:*?"<>|]+/g, "-") || "id-card-template"
  return `${stem}-${new Date().toISOString().slice(0, 10)}.json`
}

/**
 * The design plus the metadata that lives beside it rather than inside it.
 *
 * `template_config` is export-only — no importer reads it, here or anywhere —
 * but a design file that does not say what it costs or how long it is valid for
 * is only half the template. Snake-cased like everything around it, where the
 * reference used `templateConfig`; the file is uniform now, and nothing parses
 * the key.
 */
export function serializeExport(
  doc: EditorDocument,
  variables: EditorVariable[],
  config: TemplateConfig,
  assets: DesignAssets
): string {
  return JSON.stringify(
    {
      ...serializeDesign(doc, variables, assets),
      template_config: {
        title: config.title,
        description: config.description,
        price: config.price,
        branch_required: config.branchRequired,
        identity_duration: config.identityDuration,
      },
    },
    null,
    2
  )
}

/**
 * Hands the browser a file.
 *
 * A Blob URL rather than the reference's `data:` URI: a design with two photos
 * in it is several megabytes, and a data URI that size is refused outright by
 * some browsers and truncated by others. Revoked on the next frame — revoking
 * synchronously races the download in Safari.
 */
export function downloadJson(filename: string, json: string) {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json;charset=utf-8" })
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}

/* ------------------------------------------------------------------ *
 * Deserialize — wire document → editor model
 * ------------------------------------------------------------------ */

/** The editor's fifteen, for narrowing whatever the document actually said. */
const VARIABLE_TYPE_VALUES: VariableType[] = [
  "text", "number", "image", "date", "file", "issue_date", "expiration_date",
  "select", "province", "gender", "incremental", "random", "signature",
  "name", "phone",
]

function readVariableType(type: DesignVariableType): VariableType {
  return VARIABLE_TYPE_VALUES.includes(type as VariableType)
    ? (type as VariableType)
    : "text"
}

const SHAPE_VARIANTS: ShapeVariant[] = ["rect", "circle", "ellipse"]

/**
 * `DesignDocument` → the editor's model.
 *
 * Where `readDesign` is tolerant about the *document*, this is tolerant about
 * the *gap between the two models*: a `line` shape the editor cannot draw
 * becomes a `rect`, a variable type it does not know becomes `text`. Both are
 * lossy, both are documented (§20.1, §22), and both beat refusing to open a
 * template that the renderer is perfectly happy with.
 *
 * ### Names come back normalized, and stay that way
 *
 * A visible variable is authored with its raw name (`First Name`) and stores the
 * normalized key (`first_name`) in the document. The raw spelling is not in the
 * JSON — only the placeholder text `{First Name}` still carries it, and parsing
 * that back would be guessing. So a reloaded template's variables are named by
 * their keys. Re-normalizing a key is the identity function, so nothing shifts
 * on the next save: the data key an already-issued identity was stored under
 * survives the round trip, which is the only part that has to.
 */
export function designToEditor(design: DesignDocument): {
  doc: EditorDocument
  variables: EditorVariable[]
} {
  const pages: EditorPage[] = design.pages.map((page, i) => {
    const next: EditorPage = {
      id: page.id,
      name: i === 0 ? "Front" : "Back",
      background: page.background || "#ffffff",
      elements: page.elements.map((raw): CanvasElement => {
        const element: CanvasElement = {
          id: raw.id,
          kind: raw.kind,
          name: raw.variableLabel ?? "",
          x: raw.x,
          y: raw.y,
          width: raw.width,
          height: raw.height,
          rotation: raw.rotation,
          opacity: raw.opacity,
        }

        if (raw.kind === "text") {
          element.text = raw.text ?? ""
          element.fontSize = raw.fontSize ?? 16
          element.fontFamily = raw.fontFamily ?? "Arial"
          element.fontWeight = raw.fontWeight === "bold" ? "bold" : "normal"
          element.fontStyle = raw.fontStyle === "italic" ? "italic" : "normal"
          element.textDecoration = raw.textDecoration === "underline" ? "underline" : ""
          element.align = raw.align ?? "left"
          element.letterSpacing = raw.letterSpacing ?? 0
          element.fill = raw.fill ?? "#000000"
        } else if (raw.kind === "image") {
          element.cornerRadius = raw.cornerRadius ?? 0
          // A variable slot's `src` is the placeholder this module wrote on the
          // last save. Dropping it puts the slot back into the state the canvas
          // draws from the binding, which is the same picture and one less
          // multi-kilobyte data URI to carry around.
          if (raw.src && !raw.variable) element.src = raw.src
        } else {
          element.shape = SHAPE_VARIANTS.includes(raw.shape as ShapeVariant)
            ? (raw.shape as ShapeVariant)
            : "rect"
          element.fill = raw.fill ?? "#000000"
          element.stroke = raw.stroke ?? "#000000"
          element.strokeWidth = raw.strokeWidth ?? 0
          element.cornerRadius = raw.cornerRadius ?? 0
        }

        if (raw.isQR) {
          element.isQR = true
          element.qrValue = raw.qrValue || "no-data"
          element.qrColor = raw.qrColor || "#000000"
          element.qrMargin = raw.qrMargin ?? DEFAULT_QR_MARGIN
          if (raw.qrTransparent) element.qrTransparent = true
          // A QR is an image to the renderer, but to the editor it is a QR, and
          // a stored `src` would make the canvas draw the old code after the
          // colour changed.
          delete element.src
        }

        if (raw.variable) element.variable = raw.variable

        return element
      }),
    }

    if (page.backgroundImage) next.backgroundImage = page.backgroundImage

    return next
  })

  const variables: EditorVariable[] = design.vars.map((entry) => {
    const variable: EditorVariable = {
      name: entry.name,
      label: entry.label || entry.name,
      type: readVariableType(entry.type),
      isVisible: entry.isVisible,
    }
    if (entry.options) variable.options = [...entry.options]
    if (entry.randomNumberLength) variable.randomNumberLength = entry.randomNumberLength
    if (entry.startingNumber !== undefined) variable.startingNumber = entry.startingNumber
    if (entry.arabicNumbers) variable.arabicNumbers = true
    return variable
  })

  return {
    doc: { width: design.width, height: design.height, pages },
    variables,
  }
}

/**
 * The metadata half — §15's form, filled from the record's own columns.
 *
 * Everything is optional on `Template` (an embedded copy carries almost none of
 * it), so every field has the same default a new template starts with. The one
 * that is not obvious is `identityDuration`: `0` means *never expires* and is a
 * real setting, so it has to survive `?? 12`, which is why the nullish check is
 * spelled out rather than folded into an `||`.
 */
export function templateToConfig(row: Template): TemplateConfig {
  return {
    title: row.title ?? "",
    description: row.description ?? "",
    price: Number(row.price ?? 0) || 0,
    identityDuration: row.identityDuration ?? 12,
    branchRequired: Boolean(row.branchRequired),
  }
}

/**
 * The whole read side in one call — the shape `PhotoEditor`'s load effect wants.
 *
 * A row whose `template` is null (a thin embedded copy, or a record saved before
 * a design existed) yields `doc: null`, which the caller reads as "keep the
 * blank document, take the metadata" rather than as a failure.
 */
export function templateToEditor(row: Template): {
  doc: EditorDocument | null
  variables: EditorVariable[]
  config: TemplateConfig
} {
  const design = readDesign(row.template)
  const parsed = design ? designToEditor(design) : null

  return {
    doc: parsed?.doc ?? null,
    variables: parsed?.variables ?? [],
    config: templateToConfig(row),
  }
}
