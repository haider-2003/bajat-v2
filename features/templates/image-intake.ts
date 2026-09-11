import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
  IMAGE_MIME,
} from "./editor-constants"

/**
 * Picking, dropping and pasting a picture — docs/photo-editor-spec.md §9.2 and
 * docs/PHOTO-EDITOR-TEMPLATE-JSON.md §5.2.
 *
 * ### There is no upload endpoint, and that is the design
 *
 * Checked against docs/identities-api.postman_collection.json: across all 110
 * endpoints the only thing that takes a file is the members Excel import. A
 * template's artwork never becomes a URL on a server — the bytes live in the
 * document, as `src` data URIs inside the `template` JSON that `POST /template`
 * sends, and they come back the same way. So "upload" here is entirely local:
 * read the file, base64 it, put it on an element. Nothing is sent until Save.
 *
 * That is also why the ceiling is what it is. 10 MB is not an upload limit, it
 * is a *document* limit — every byte is carried by every subsequent GET, PUT
 * and export of the template.
 *
 * ### The pixels are not resized, the element box is
 *
 * §5.2 is explicit: the full original file is embedded and only the element's
 * `width`/`height` are scaled to fit 300px. Re-encoding the image to shrink it
 * would be the obvious "optimisation" and it is wrong — the server-side
 * renderer draws the card at print resolution, and a photo downsampled to
 * 300px on insert would print soft with no way to get the detail back.
 *
 * The element still has to fit somewhere useful, hence `fitImageBox`: a
 * 4000×3000 photo arrives as a 300×225 box over full-resolution bytes.
 *
 * ### Framework-free on purpose
 *
 * Nothing here touches React or the store, so the rules about what is accepted
 * are checkable without mounting an editor — and a second entry point (a drop
 * on the canvas, say) gets the same answers as the panel.
 */

/** Why a file was turned away — the panel maps these onto its own strings. */
export type ImageRejection = "type" | "size" | "unreadable"

export class ImageRejected extends Error {
  readonly reason: ImageRejection
  /** The file's own name, so a multi-file drop can say which one failed. */
  readonly fileName: string

  constructor(reason: ImageRejection, fileName: string) {
    super(`${fileName}: ${reason}`)
    this.name = "ImageRejected"
    this.reason = reason
    this.fileName = fileName
  }
}

export type IntakeImage = {
  /**
   * The file's bytes, base64, exactly as they arrived. A data URI and never an
   * object URL: a `blob:` handle dies with the document that made it, so a
   * template saved with one would reload as a broken image.
   */
  src: string
  /** The image's own pixel size — what `fitImageBox` scales down from. */
  naturalWidth: number
  naturalHeight: number
}

/**
 * The element box for an image, scaled to fit inside `limit`.
 *
 * Only ever shrinks. A 40×40 icon is placed at 40×40 rather than blown up to
 * fill the limit, because the size it was drawn at is information.
 */
export function fitImageBox(
  natural: { naturalWidth: number; naturalHeight: number },
  limit: { width: number; height: number } = {
    width: IMAGE_MAX_EDGE,
    height: IMAGE_MAX_EDGE,
  }
): { width: number; height: number } {
  const width = Math.max(1, natural.naturalWidth)
  const height = Math.max(1, natural.naturalHeight)
  const scale = Math.min(limit.width / width, limit.height / height, 1)

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** §5.2's accepted list, as an `accept` attribute. */
export const IMAGE_ACCEPT = IMAGE_MIME.join(",")

/**
 * The files out of a drop or a paste. Both events carry a `DataTransfer`,
 * which is why one function serves both.
 *
 * ### Every file, not every *image* file
 *
 * Filtering to the accepted types here would be the obvious thing and it makes
 * a dropped PDF do nothing at all — no element, no complaint, nothing to tell
 * the operator whether the drop even registered. Files come back whole and
 * `readImageFile` gives each one a verdict, so a wrong type is answered rather
 * than ignored.
 *
 * What *is* filtered is anything that is not a file: `kind === "string"` covers
 * the text and URLs a drag routinely carries alongside the picture, and those
 * are not a failed upload. `items` is read before `files` because a pasted
 * screenshot appears there first in some browsers.
 */
export function filesFrom(transfer: DataTransfer | null): File[] {
  if (!transfer) return []

  const found: File[] = []
  const seen = new Set<string>()
  const take = (file: File | null) => {
    if (!file) return
    // A drop can list the same file under `items` and `files` both.
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(file)
  }

  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind === "file") take(item.getAsFile())
  }
  for (const file of Array.from(transfer.files ?? [])) take(file)

  return found
}

/** `FileReader` as a promise — it predates them and still only has events. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new ImageRejected("unreadable", file.name))
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string" && result.startsWith("data:")) resolve(result)
      else reject(new ImageRejected("unreadable", file.name))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * The image's intrinsic size.
 *
 * An SVG may have none — a document with a `viewBox` and no `width`/`height`
 * is sized by whatever displays it, and browsers disagree about what to report
 * (Chrome invents 300×150, Firefox says 0). Neither answer is the picture's, so
 * an SVG that cannot state its own size is squared off at the insert limit,
 * which is at least predictable and is trivially resized on the canvas.
 */
function measure(src: string, file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const probe = new Image()
    probe.onerror = () => reject(new ImageRejected("unreadable", file.name))
    probe.onload = () => {
      const width = probe.naturalWidth
      const height = probe.naturalHeight
      if (width > 0 && height > 0) resolve({ width, height })
      else if (file.type === "image/svg+xml") {
        resolve({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE })
      } else reject(new ImageRejected("unreadable", file.name))
    }
    probe.src = src
  })
}

/**
 * One file → the bytes and the size to place them at.
 *
 * Rejects with `ImageRejected` and nothing else, so a caller handling a batch
 * can report per file and carry on with the rest.
 */
export async function readImageFile(file: File): Promise<IntakeImage> {
  if (!IMAGE_MIME.includes(file.type)) {
    throw new ImageRejected("type", file.name)
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ImageRejected("size", file.name)
  }

  const src = await readAsDataUrl(file)
  const { width, height } = await measure(src, file)

  return { src, naturalWidth: width, naturalHeight: height }
}
