"use client"

import * as React from "react"
import QRCode from "qrcode"

import { cn } from "@/lib/utils"

/**
 * The scannable QR for a card's verification key — DESIGN.md §8.6.
 *
 * ### The API never sends a QR
 *
 * There is no QR endpoint and no QR image file on the identity resource. What
 * `GET /identity` returns is a plain string, `unique_key` (`uniqueKey` once the
 * response interceptor has camelized it — see utils/api/key-conversion.ts), and
 * the code is drawn in the browser from that string. The `front_image` /
 * `back_image` artwork is a *different* QR: the backend prints one into the
 * design when it renders the card. This one is not that one, and nothing here
 * should try to read, overlay or regenerate it.
 *
 * ### What must not change
 *
 * Cards are already printed and in the field, and the scanners match on the
 * bare key:
 *
 *  - The payload is `value` **verbatim** — no URL wrapper, no `?key=`, no JSON,
 *    no prefix or suffix. Screens that show the key as uppercase text beside
 *    the code are formatting it for display only; what gets encoded is exactly
 *    what the API returned.
 *  - `margin: 1` module, not the library's default of 4. The margin is part of
 *    the code's physical size once it is printed.
 *  - Black on white, regardless of theme. A dark-mode inversion is still a
 *    valid QR to a camera, but not to every scanner, and the row it sits in is
 *    a print queue.
 *
 * An empty key renders nothing rather than a QR of the empty string, which
 * would scan — as nothing.
 */
export function QrCell({
  value,
  size = 60,
  className,
}: {
  /** The raw `uniqueKey`. Encoded as-is; see above. */
  value: string | null | undefined
  /** Rendered edge length in px. Also the canvas's pixel size. */
  size?: number
  /**
   * Spacing for the cell this sits in. The shared `TableCell` is `py-0`, so a
   * code with no vertical margin stacks flush against the one in the row above
   * — set it here rather than in TableView, which every other table shares.
   */
  className?: string
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return

    let live = true
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    }).catch((error) => {
      // Only worth reporting while this cell is still on screen — a row that
      // paged away mid-draw is not a failure anyone can act on.
      if (live) console.error("QR generation failed:", error)
    })

    return () => {
      live = false
    }
  }, [value, size])

  const download = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return

    const link = document.createElement("a")
    link.download = `qr-code-${value}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }, [value])

  // After the hooks, never before them: an early return above `useEffect`
  // would change the hook order between a row that has a key and one that
  // doesn't.
  if (!value) return null

  return (
    // A button rather than a click handler on the canvas, so the download is
    // reachable by keyboard and announced as an action. It adds no box of its
    // own — the canvas is the entire visual.
    <button
      type="button"
      onClick={download}
      title="Click to download"
      aria-label={`Download QR code for ${value}`}
      className={cn(
        "block rounded-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        style={{ maxWidth: "100%", height: "auto", cursor: "pointer" }}
      />
    </button>
  )
}
