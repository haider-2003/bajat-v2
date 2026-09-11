"use client"

import * as React from "react"

import { brandInitScript } from "@/components/layout/brand"
import { themeInitScript } from "@/components/layout/theme-provider"

/**
 * Re-runs the root layout's `<head>` init scripts on a page Next has
 * client-rendered from scratch.
 *
 * A `notFound()` response is not a normal render. Next serves an empty
 * `<html id="__next_error__">` shell and lets the client build the whole
 * tree, root layout included (see `getErrorRSCPayload` in
 * node_modules/next/dist/server/app-render/app-render.js). React creates the
 * `<script>` elements it renders but never executes them, so the `.dark`
 * class and the `data-accent` / `data-primary` / `data-template` attributes
 * that globals.css keys its tokens off are never stamped on `<html>`. The
 * 404 page paints in the default brand — and because the layout then
 * persists across client navigation, so does every page reached from it,
 * until a full reload.
 *
 * This appends the same two scripts, verbatim, as real script elements —
 * which the browser *does* execute — from `useLayoutEffect`, so they land
 * before the rendered page's first paint. The intro script is left out: its
 * pre-paint cover hooks `DOMContentLoaded`, which has long since fired, and a
 * 404 is not the moment for the splash anyway.
 *
 * A no-op when the scripts already ran — the normal case, and the case of a
 * client-side navigation into a 404 — detected by the template attribute the
 * brand script always writes, default or not.
 */
export function InitScriptsReplay() {
  React.useLayoutEffect(() => {
    if (document.documentElement.dataset.template) return
    for (const source of [themeInitScript, brandInitScript]) {
      const script = document.createElement("script")
      script.textContent = source
      document.head.appendChild(script)
      script.remove()
    }
  }, [])

  return null
}
