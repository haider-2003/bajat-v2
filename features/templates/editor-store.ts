import { create } from "zustand"

import {
  HISTORY_LIMIT,
  ID_CARD_HEIGHT,
  ID_CARD_WIDTH,
  PAGE_GAP,
  SNAP_THRESHOLD,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  variableMeta,
} from "./editor-constants"
import type {
  CanvasElement,
  DisplayUnit,
  EditorDocument,
  EditorVariable,
  PanelKey,
  TemplateConfig,
} from "./editor-types"

/**
 * The editor's state — docs/photo-editor-spec.md §7 and §8.
 *
 * ### What is undoable, and what deliberately isn't
 *
 * History tracks **the document only**. Config, the invisible-variable list,
 * the selection and the copy-style clipboard are outside it, exactly as §8
 * specifies. That is a real behaviour, not an omission: deleting a form-only
 * variable cannot be undone, so the UI has to ask before doing it.
 *
 * ### One deviation from the reference, on purpose
 *
 * §8 records a quirk — every property keystroke pushes a snapshot, so typing a
 * four-digit number burns four of the fifty entries and can evict real edits.
 * `pushHistory` here is a no-op when the previous snapshot is under
 * `COALESCE_MS` old *and* carries the same coalesce key, so a run of keystrokes
 * on one field collapses into one entry. Pass no key (the default) for discrete
 * actions, which always push.
 */

const COALESCE_MS = 600

const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))

/** Height of a face's caption band plus its margin — see `PageFace`. */
export const CAPTION_BAND = 30

/** The stacked faces' bounding box in canvas units, captions included. */
export function contentBox(width: number, height: number, pages: number) {
  return {
    width,
    height: (CAPTION_BAND + height) * pages + PAGE_GAP * (pages - 1),
  }
}

/**
 * The free rectangle of the window in viewport coordinates — everything the
 * floating chrome is not sitting on. `fitView` and centred zoom both work in
 * this box rather than in the window, which is what keeps the card centred in
 * the space the operator can actually see.
 */
function area(state: {
  viewportW: number
  viewportH: number
  safeArea: { top: number; right: number; bottom: number; left: number }
}) {
  const { viewportW, viewportH, safeArea } = state
  return {
    left: safeArea.left,
    top: safeArea.top,
    width: Math.max(0, viewportW - safeArea.left - safeArea.right),
    height: Math.max(0, viewportH - safeArea.top - safeArea.bottom),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Element/page ids.
 *
 * A module-level counter rather than `Math.random()` at the call site: the
 * React Compiler treats a random call inside component code as impure even when
 * it only runs from an event handler, and a monotonic id is easier to read in a
 * serialized document anyway. Ids are document-local, so a counter is enough.
 */
let idSeq = 0
export function newId(prefix: string) {
  idSeq += 1
  return `${prefix}${idSeq.toString(36)}${Date.now().toString(36).slice(-4)}`
}

function uid(prefix: string) {
  return newId(prefix)
}

/**
 * Where a newly inserted element goes.
 *
 * Everything used to land on the same hard-coded pixel, so adding a second
 * variable printed it exactly on top of the first — two placeholders overlaid
 * in the same 200×30 box, both illegible, with no clue that there were two.
 *
 * A diagonal cascade is the usual answer and it is the wrong one here: an ID
 * card is 323×204, and a 16px step down-and-right still leaves a 200×30 text
 * box overlapping the one before it by half its height. So this searches a
 * lattice instead — one element-height plus a gutter per row, one element-width
 * plus a gutter per column, anchored on the spot the caller asked for. Adding
 * three text variables stacks them like a list, which is what the operator was
 * going to drag them into anyway.
 *
 * On a card this small a free spot does not always exist (a 150×150 photo on a
 * 204-tall face leaves very little), so when everything collides it returns the
 * candidate that collides *least* rather than giving up and stacking exactly.
 */
export function placeElement(
  doc: EditorDocument,
  page: number,
  size: { width: number; height: number },
  preferred: { x: number; y: number } = { x: 50, y: 50 }
): { x: number; y: number } {
  const GUTTER = 8
  const maxX = Math.max(0, doc.width - size.width)
  const maxY = Math.max(0, doc.height - size.height)
  const clampX = (x: number) => Math.max(0, Math.min(x, maxX))
  const clampY = (y: number) => Math.max(0, Math.min(y, maxY))

  const elements = doc.pages[page]?.elements ?? []
  if (elements.length === 0) return { x: clampX(preferred.x), y: clampY(preferred.y) }

  /** Area of the overlap between a candidate and everything already placed. */
  const collision = (x: number, y: number) =>
    elements.reduce((total, e) => {
      const w = Math.min(x + size.width, e.x + e.width) - Math.max(x, e.x)
      const h = Math.min(y + size.height, e.y + e.height) - Math.max(y, e.y)
      return total + (w > 0 && h > 0 ? w * h : 0)
    }, 0)

  const stepX = size.width + GUTTER
  const stepY = size.height + GUTTER
  let best = { x: clampX(preferred.x), y: clampY(preferred.y) }
  let bestCollision = Infinity

  // The caller's spot first, then down its column, then the next column — and
  // finally the same lattice anchored in the top-left corner, which catches the
  // gap above `preferred` that the first pass cannot reach.
  for (const origin of [preferred, { x: GUTTER, y: GUTTER }]) {
    for (let col = 0; col * stepX <= maxX + stepX; col += 1) {
      for (let row = 0; row * stepY <= maxY + stepY; row += 1) {
        const x = clampX(origin.x + col * stepX)
        const y = clampY(origin.y + row * stepY)
        const overlap = collision(x, y)
        if (overlap === 0) return { x, y }
        if (overlap < bestCollision) {
          bestCollision = overlap
          best = { x, y }
        }
      }
    }
  }

  return best
}

export function blankDocument(): EditorDocument {
  return {
    width: ID_CARD_WIDTH,
    height: ID_CARD_HEIGHT,
    pages: [
      { id: uid("p"), name: "Front", background: "#ffffff", elements: [] },
      { id: uid("p"), name: "Back", background: "#ffffff", elements: [] },
    ],
  }
}

export const blankConfig = (): TemplateConfig => ({
  title: "",
  description: "",
  price: 0,
  identityDuration: 12,
  branchRequired: false,
})

type Snapshot = { doc: EditorDocument; at: number; key: string | null }

type EditorState = {
  doc: EditorDocument
  variables: EditorVariable[]
  config: TemplateConfig
  /** `false` until the metadata form has been saved once — gates save/export (§4.3). */
  hasConfigured: boolean
  templateId: number | null

  // view state — never part of the document
  zoom: number
  /** Viewport pan in **screen px**, applied before the zoom scale. */
  panX: number
  panY: number
  /** The window's size in screen px — what `fitView` and centred zoom need. */
  viewportW: number
  viewportH: number
  /**
   * The part of the window the floating chrome is *not* covering, in screen px
   * from each edge. The stage is full-bleed by design, so without this "centre"
   * means centred behind the panel — which on a 1024px laptop puts a third of
   * the card under the sidebar.
   */
  safeArea: { top: number; right: number; bottom: number; left: number }
  /**
   * Whether the operator has panned or zoomed since the last fit. Until they
   * have, the view is still the editor's to choose, so it re-frames itself when
   * the window resizes or a panel opens. After they have, it stays put — a
   * canvas that re-centres itself under your hands is unusable.
   */
  viewTouched: boolean
  activePage: number
  selectedId: string | null
  panel: PanelKey | null
  unit: DisplayUnit
  /** Armed source element for the two-step format painter (§13.2). */
  styleSource: string | null
  dirty: boolean

  history: Snapshot[]
  historyIndex: number

  // ── document ──
  pushHistory: (key?: string) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  addElement: (element: CanvasElement, page?: number) => void
  updateElement: (id: string, patch: Partial<CanvasElement>) => void
  removeElement: (id: string) => void
  duplicateElement: (id: string) => void
  reorderElement: (id: string, how: "front" | "forward" | "backward" | "back") => void
  setPageBackground: (page: number, color: string) => void
  setDocumentSize: (width: number, height: number) => void
  flipOrientation: () => void
  replaceDocument: (doc: EditorDocument) => void

  // ── variables ──
  addVariable: (variable: EditorVariable, element: CanvasElement | null) => void
  removeVariable: (name: string) => void

  // ── config ──
  setConfig: (config: TemplateConfig) => void
  setTemplateId: (id: number | null) => void
  markSaved: () => void

  // ── view ──
  setZoom: (zoom: number) => void
  nudgeZoom: (delta: number) => void
  setPan: (x: number, y: number) => void
  setView: (zoom: number, x: number, y: number) => void
  setViewportSize: (w: number, h: number) => void
  setSafeArea: (area: { top: number; right: number; bottom: number; left: number }) => void
  /** Zoom about the window's centre, so button zoom keeps your place too. */
  zoomAboutCentre: (zoom: number) => void
  fitView: () => void
  setActivePage: (page: number) => void
  select: (id: string | null) => void
  /** `null` closes the panel — on a narrow screen it is a drawer over the work. */
  setPanel: (panel: PanelKey | null) => void
  setUnit: (unit: DisplayUnit) => void
  armStyle: (id: string | null) => void
  applyStyleTo: (targetId: string) => number

  // ── derived ──
  element: (id: string | null) => CanvasElement | null
  selected: () => CanvasElement | null
  pageOf: (id: string) => number
  hasQR: () => boolean
  reset: () => void
}

/** §13.2 — which fields a format paste carries, per element kind. */
const STYLE_FIELDS: Record<string, (keyof CanvasElement)[]> = {
  text: [
    "opacity", "fontSize", "fontFamily", "fontStyle", "fontWeight",
    "fill", "align", "textDecoration", "letterSpacing",
  ],
  image: ["opacity"],
  shape: ["opacity", "fill", "stroke", "strokeWidth", "cornerRadius"],
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  doc: blankDocument(),
  variables: [],
  config: blankConfig(),
  hasConfigured: false,
  templateId: null,

  zoom: ZOOM_DEFAULT,
  panX: 0,
  panY: 0,
  viewportW: 0,
  viewportH: 0,
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  viewTouched: false,
  activePage: 0,
  selectedId: null,
  panel: "variables",
  unit: "px",
  styleSource: null,
  dirty: false,

  history: [],
  historyIndex: -1,

  pushHistory: (key) => {
    const { doc, history, historyIndex } = get()
    const prev = history[historyIndex]
    // Coalesce a run of keystrokes on one field into a single entry.
    if (key && prev && prev.key === key && Date.now() - prev.at < COALESCE_MS) return

    const next = history.slice(0, historyIndex + 1)
    next.push({ doc: clone(doc), at: Date.now(), key: key ?? null })
    while (next.length > HISTORY_LIMIT) next.shift()
    set({ history: next, historyIndex: next.length - 1, dirty: true })
  },

  undo: () => {
    const { history, historyIndex, doc } = get()
    if (historyIndex < 0) return
    // The stack holds pre-mutation snapshots, so the first undo has to stash
    // the *current* document or redo would have nothing to come back to.
    const stack =
      historyIndex === history.length - 1
        ? [...history, { doc: clone(doc), at: Date.now(), key: null }]
        : history
    set({
      doc: clone(stack[historyIndex].doc),
      history: stack,
      historyIndex: historyIndex - 1,
      selectedId: null,
      dirty: true,
    })
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    set({
      doc: clone(history[historyIndex + 1].doc),
      historyIndex: historyIndex + 1,
      selectedId: null,
      dirty: true,
    })
  },

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  addElement: (element, page) => {
    get().pushHistory()
    const doc = clone(get().doc)
    doc.pages[page ?? get().activePage].elements.push(element)
    set({ doc, selectedId: element.id, dirty: true })
  },

  updateElement: (id, patch) => {
    const doc = clone(get().doc)
    for (const page of doc.pages) {
      const found = page.elements.find((e) => e.id === id)
      if (found) {
        Object.assign(found, patch)
        break
      }
    }
    set({ doc, dirty: true })
  },

  removeElement: (id) => {
    get().pushHistory()
    const doc = clone(get().doc)
    for (const page of doc.pages) {
      const i = page.elements.findIndex((e) => e.id === id)
      if (i >= 0) {
        page.elements.splice(i, 1)
        break
      }
    }
    set({ doc, selectedId: null, dirty: true })
  },

  duplicateElement: (id) => {
    const source = get().element(id)
    if (!source) return
    get().pushHistory()
    const doc = clone(get().doc)
    const page = doc.pages[get().pageOf(id)]
    const copy: CanvasElement = { ...clone(source), id: newId("e") }
    copy.x = Math.min(copy.x + 8, doc.width - copy.width)
    copy.y = Math.min(copy.y + 8, doc.height - copy.height)
    page.elements.push(copy)
    set({ doc, selectedId: copy.id, dirty: true })
  },

  reorderElement: (id, how) => {
    get().pushHistory()
    const doc = clone(get().doc)
    const page = doc.pages[get().pageOf(id)]
    const i = page.elements.findIndex((e) => e.id === id)
    if (i < 0) return
    const [el] = page.elements.splice(i, 1)
    if (how === "front") page.elements.push(el)
    else if (how === "back") page.elements.unshift(el)
    else if (how === "forward") page.elements.splice(Math.min(page.elements.length, i + 1), 0, el)
    else page.elements.splice(Math.max(0, i - 1), 0, el)
    set({ doc, dirty: true })
  },

  setPageBackground: (page, color) => {
    get().pushHistory()
    const doc = clone(get().doc)
    doc.pages[page].background = color
    set({ doc, dirty: true })
  },

  /** Both faces always share the document size (§5). */
  setDocumentSize: (width, height) => {
    get().pushHistory()
    const doc = clone(get().doc)
    doc.width = width
    doc.height = height
    set({ doc, dirty: true })
  },

  flipOrientation: () => {
    get().pushHistory()
    const doc = clone(get().doc)
    const w = doc.width
    doc.width = doc.height
    doc.height = w
    set({ doc, dirty: true })
  },

  replaceDocument: (next) => {
    get().pushHistory()
    set({ doc: clone(next), selectedId: null, dirty: true })
  },

  addVariable: (variable, element) => {
    if (element) get().pushHistory()
    const doc = clone(get().doc)
    if (element) doc.pages[get().activePage].elements.push(element)
    set({
      doc,
      variables: [...get().variables, variable],
      selectedId: element ? element.id : get().selectedId,
      dirty: true,
    })
  },

  /** Removes the definition *and* every element bound to it (§10.6). */
  removeVariable: (name) => {
    get().pushHistory()
    const doc = clone(get().doc)
    for (const page of doc.pages) {
      page.elements = page.elements.filter((e) => e.variable !== name)
    }
    set({
      doc,
      variables: get().variables.filter((v) => v.name !== name),
      selectedId: null,
      dirty: true,
    })
  },

  setConfig: (config) => set({ config, hasConfigured: true, dirty: true }),
  setTemplateId: (id) => set({ templateId: id }),
  markSaved: () => set({ dirty: false }),

  /** Button/keyboard zoom snaps to the step; wheel zoom goes through `setView`. */
  setZoom: (zoom) =>
    set({ zoom: clampZoom(Math.round(zoom / ZOOM_STEP) * ZOOM_STEP), viewTouched: true }),
  nudgeZoom: (delta) => get().setZoom(get().zoom + delta),
  setPan: (x, y) => set({ panX: x, panY: y, viewTouched: true }),
  setView: (zoom, x, y) =>
    set({ zoom: clampZoom(zoom), panX: x, panY: y, viewTouched: true }),
  setViewportSize: (w, h) => set({ viewportW: w, viewportH: h }),
  setSafeArea: (safeArea) => {
    const current = get().safeArea
    if (
      current.top === safeArea.top &&
      current.right === safeArea.right &&
      current.bottom === safeArea.bottom &&
      current.left === safeArea.left
    ) {
      return
    }
    set({ safeArea })
  },

  zoomAboutCentre: (zoom) => {
    const { panX, panY } = get()
    const next = clampZoom(Math.round(zoom / ZOOM_STEP) * ZOOM_STEP)
    const current = get().zoom
    if (next === current) return
    // The centre of the *visible* work area, not of the window — otherwise
    // zooming with the sidebar open walks the card off to the right.
    const box = area(get())
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const wx = (cx - panX) / current
    const wy = (cy - panY) / current
    set({ zoom: next, panX: cx - wx * next, panY: cy - wy * next, viewTouched: true })
  },

  /**
   * Frame both faces with a margin.
   *
   * The content is taller than the pages alone — each face carries a caption
   * band above it — so the height has to include those or "fit" clips the top
   * caption off the screen.
   */
  /**
   * Frame both faces inside the free area, with a margin.
   *
   * The content is taller than the pages alone — each face carries a caption
   * band above it — so the height has to include those or "fit" clips the top
   * caption off the screen. The margin scales with the area: 72px of air either
   * side is right on a desktop and is most of a 480px phone.
   */
  fitView: () => {
    const { doc } = get()
    const box = area(get())
    if (box.width <= 0 || box.height <= 0) return

    const content = contentBox(doc.width, doc.height, doc.pages.length)
    const margin = Math.max(16, Math.min(72, Math.min(box.width, box.height) * 0.08))
    const zoom = clampZoom(
      Math.min(
        (box.width - margin * 2) / content.width,
        (box.height - margin * 2) / content.height
      )
    )
    set({
      zoom,
      panX: box.left + (box.width - content.width * zoom) / 2,
      panY: box.top + (box.height - content.height * zoom) / 2,
      viewTouched: false,
    })
  },
  setActivePage: (page) => set({ activePage: page }),
  select: (id) => set({ selectedId: id }),
  setPanel: (panel) => set({ panel }),
  setUnit: (unit) => set({ unit }),
  armStyle: (id) => set({ styleSource: id }),

  applyStyleTo: (targetId) => {
    const { styleSource } = get()
    if (!styleSource || styleSource === targetId) return 0
    const source = get().element(styleSource)
    const target = get().element(targetId)
    if (!source || !target) return 0

    const from = STYLE_FIELDS[source.kind] ?? ["opacity"]
    const to = STYLE_FIELDS[target.kind] ?? ["opacity"]
    const patch: Partial<CanvasElement> = {}
    let n = 0
    for (const field of from) {
      if (!to.includes(field)) continue
      if (source[field] === undefined) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(patch as any)[field] = source[field]
      n += 1
    }
    if (n > 0) {
      get().pushHistory()
      get().updateElement(targetId, patch)
    }
    set({ styleSource: null })
    return n
  },

  element: (id) => {
    if (!id) return null
    for (const page of get().doc.pages) {
      const found = page.elements.find((e) => e.id === id)
      if (found) return found
    }
    return null
  },
  selected: () => get().element(get().selectedId),
  pageOf: (id) => {
    const { pages } = get().doc
    for (let i = 0; i < pages.length; i += 1) {
      if (pages[i].elements.some((e) => e.id === id)) return i
    }
    return 0
  },
  hasQR: () => get().doc.pages.some((p) => p.elements.some((e) => e.isQR)),

  /**
   * §4.2 — always the first thing a mount does. The store is module-global, so
   * without this a second visit inherits the previous template's variables.
   */
  reset: () =>
    set({
      doc: blankDocument(),
      variables: [],
      config: blankConfig(),
      hasConfigured: false,
      templateId: null,
      zoom: ZOOM_DEFAULT,
      viewTouched: false,
      panX: 0,
      panY: 0,
      viewportW: 0,
      viewportH: 0,
      activePage: 0,
      selectedId: null,
      panel: "variables",
      unit: "px",
      styleSource: null,
      dirty: false,
      history: [],
      historyIndex: -1,
    }),
}))

/* ────────────────────────────────────────────────────────────────────────
   Snap engine — §11.2. Pure, so it is testable without a canvas.
   ──────────────────────────────────────────────────────────────────────── */

export type SnapResult = {
  x: number
  y: number
  /** Canvas-space x of the vertical guide, or null when nothing snapped. */
  guideX: number | null
  guideY: number | null
}

/**
 * Clamp → snap → re-clamp, in that order.
 *
 * The second clamp is not redundant: a snap target can sit outside the page
 * (a sibling's right edge minus the dragged box's width goes negative for a
 * wide element), and without re-clamping the element leaves the card.
 *
 * Each axis resolves independently, so a box can snap horizontally to one
 * sibling and vertically to another in the same frame.
 */
export function computeDragSnap(
  moving: { x: number; y: number; width: number; height: number },
  siblings: { x: number; y: number; width: number; height: number }[],
  page: { width: number; height: number }
): SnapResult {
  const clampX = (v: number) => Math.max(0, Math.min(v, page.width - moving.width))
  const clampY = (v: number) => Math.max(0, Math.min(v, page.height - moving.height))

  let x = clampX(moving.x)
  let y = clampY(moving.y)

  const xTargets: number[] = []
  const yTargets: number[] = []
  for (const s of siblings) {
    xTargets.push(s.x, s.x + s.width / 2, s.x + s.width)
    yTargets.push(s.y, s.y + s.height / 2, s.y + s.height)
  }
  // Page targets go last so they win an exact tie — §11.2.
  xTargets.push(0, page.width / 2, page.width)
  yTargets.push(0, page.height / 2, page.height)

  // Offsets convert a target back into a top-left coordinate.
  const xOffsets = [0, moving.width / 2, moving.width]
  const yOffsets = [0, moving.height / 2, moving.height]

  let bestX: { d: number; pos: number; off: number } | null = null
  for (const off of xOffsets) {
    for (const t of xTargets) {
      const d = Math.abs(x + off - t)
      if (d <= SNAP_THRESHOLD && (!bestX || d <= bestX.d)) bestX = { d, pos: t, off }
    }
  }
  let bestY: { d: number; pos: number; off: number } | null = null
  for (const off of yOffsets) {
    for (const t of yTargets) {
      const d = Math.abs(y + off - t)
      if (d <= SNAP_THRESHOLD && (!bestY || d <= bestY.d)) bestY = { d, pos: t, off }
    }
  }

  if (bestX) x = bestX.pos - bestX.off
  if (bestY) y = bestY.pos - bestY.off

  return {
    x: Math.round(clampX(x)),
    y: Math.round(clampY(y)),
    guideX: bestX ? bestX.pos : null,
    guideY: bestY ? bestY.pos : null,
  }
}

/** Whether a type may be offered at all, given the template's expiry rule. */
export function typeAvailable(type: string, identityDuration: number) {
  const meta = variableMeta(type as never)
  return !(meta.needsDuration && identityDuration === 0)
}
