/**
 * Saving the card artwork to disk — the client half of
 * app/api/download-image/route.ts.
 *
 * Every function here goes through the same-origin proxy rather than at the
 * storage host: the pre-signed URLs a row carries can be *shown* in an `<img>`
 * from anywhere, but saving one under a chosen name needs a
 * `Content-Disposition` the storage host does not send, and fetching one
 * needs a CORS policy it does not grant. The reference client did both — the
 * ledger through the proxy, the flow page straight at the host, where it
 * failed silently whenever CORS said no (docs/IDS-FLOW-EXPORTS-ROUTES.md
 * §9.12). This is the one path.
 */

/** The proxy URL for a storage URL, with or without a save-as name. */
export function proxiedImageUrl(url: string, filename?: string): string {
  const params = new URLSearchParams({ url })
  if (filename) params.set("filename", filename)
  return `/api/download-image?${params.toString()}`
}

/**
 * Saves one image as `filename`.
 *
 * An anchor click on the proxy URL: same origin, `attachment` disposition,
 * so the browser writes the file without opening a tab and without a blob
 * held in memory. The anchor is removed after the click — `download` on a
 * same-origin URL is honoured, so there is nothing to revoke.
 */
export function downloadImage(url: string, filename: string): void {
  const anchor = document.createElement("a")
  anchor.href = proxiedImageUrl(url, filename)
  anchor.download = filename
  anchor.rel = "noopener"
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/**
 * Saves the faces of a card, front first, then back.
 *
 * The pause between the two is not decorative: some browsers coalesce two
 * programmatic downloads fired in the same tick and only the last one lands.
 */
export async function downloadCardFaces({
  front,
  back,
  baseName,
}: {
  front: string | null | undefined
  back: string | null | undefined
  /** The stem — the card's `uniqueKey` — the faces are saved under. */
  baseName: string
}): Promise<void> {
  if (front) downloadImage(front, `${baseName}_front.png`)
  if (front && back) await new Promise((resolve) => setTimeout(resolve, 500))
  if (back) downloadImage(back, `${baseName}_back.png`)
}
