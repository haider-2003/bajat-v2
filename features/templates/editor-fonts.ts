import {
  Cairo,
  Inter,
  Lato,
  Montserrat,
  Noto_Sans_Arabic,
  Open_Sans,
  Poppins,
  Roboto,
  Tajawal,
} from "next/font/google"

import { DEFAULT_FONT_FAMILY } from "./editor-constants"

/**
 * The faces the card renderer owns, served from this app instead of the OS.
 *
 * `FONT_FAMILIES` (editor-constants.ts) is the *contract* — the family names
 * the server will accept and has `.ttf` files for. This file is the other half
 * of that contract: the browser has to be able to draw the same faces, or the
 * canvas is a picture of a different card than the one that gets printed.
 *
 * Two kinds of family sit in that list and they resolve differently:
 *
 * - **System faces** (Arial, Segoe UI, Tahoma, Impact…) ship with Windows,
 *   which is what both the render host and the operators run. `fontStack()`
 *   names them directly and the OS supplies the file.
 * - **Everything else** (Inter, Cairo, Tajawal…) is only on the render host.
 *   A browser asked for `"Cairo"` would silently draw Arial, so those nine are
 *   self-hosted here through `next/font/google` and the generated family name
 *   is substituted in.
 *
 * ### Nothing loads that the render host does not have
 *
 * Not one face more. Several of these families are variable upstream, and a
 * variable face would let the canvas draw a weight with no file behind it, so
 * the weights are pinned to the 400 and 700 the host ships.
 *
 * Italics are the awkward case. The host's Latin families are three files —
 * Regular, Bold, Italic — with no Bold Italic, and `next/font/google` takes a
 * list of weights crossed with a list of styles, which can only ever ask for
 * two or four. So each of those six is requested **twice**: the two uprights
 * in one call, the single italic in another. Both calls register under the
 * same family name, so this changes nothing downstream — it is purely a way
 * of spelling a three-face request. Google's real Bold Italic never enters
 * the build, and an element that arrives from an import asking for one
 * degrades the way the renderer does instead of being drawn a face that only
 * the browser has.
 *
 * The Arabic three have no italic upstream at all, so one call each.
 *
 * ### Why `display: "block"` and `preload: false`
 *
 * This is a design surface, so *wrong metrics* are worse than *late text*: a
 * swapped-in fallback would have the operator judging whether a name overruns
 * its box against letterforms that are not the ones going to the printer.
 * `block` shows nothing until the real face lands, then never lies.
 *
 * `preload` would put a `<link rel=preload>` on the editor route for every
 * face, most of which a given design does not use. Off, each is fetched the
 * first time an element actually asks for it, and cached from then on.
 */

/*
 * Every option object below is spelled out rather than shared through a
 * constant. `next/font` is a build-time transform that reads its arguments out
 * of the source, so it only accepts literals — a hoisted `const latin = {…}`
 * fails the build rather than being inlined.
 *
 * The Arabic families carry the `latin` subset too, because card text mixes in
 * Latin digits and ID numbers.
 */

const inter = Inter({ subsets: ["latin"], weight: ["400", "700"], style: "normal", display: "block", preload: false })
const interItalic = Inter({ subsets: ["latin"], weight: "400", style: "italic", display: "block", preload: false })

const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], style: "normal", display: "block", preload: false })
const latoItalic = Lato({ subsets: ["latin"], weight: "400", style: "italic", display: "block", preload: false })

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"], style: "normal", display: "block", preload: false })
const montserratItalic = Montserrat({ subsets: ["latin"], weight: "400", style: "italic", display: "block", preload: false })

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"], style: "normal", display: "block", preload: false })
const openSansItalic = Open_Sans({ subsets: ["latin"], weight: "400", style: "italic", display: "block", preload: false })

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"], style: "normal", display: "block", preload: false })
const poppinsItalic = Poppins({ subsets: ["latin"], weight: "400", style: "italic", display: "block", preload: false })

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "700"], style: "normal", display: "block", preload: false })
const robotoItalic = Roboto({ subsets: ["latin"], weight: "400", style: "italic", display: "block", preload: false })

const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "block", preload: false })
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "block", preload: false })
const notoSansArabic = Noto_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "block", preload: false })

type Registered = { style: { fontFamily: string } }

/**
 * The family name a split pair registered — which is one name, not two.
 *
 * Naming both halves is also what keeps the italic call referenced. `next/font`
 * compiles each call into a stylesheet import, and a binding nothing reads
 * could be shaken out of the bundle, taking the italic `@font-face` with it.
 */
function splitFamily(upright: Registered, italic: Registered): string {
  void italic
  return upright.style.fontFamily
}

/**
 * Family name → the family `next/font` actually registered for it.
 *
 * A family absent from this map is a system face and is named as written.
 */
const SELF_HOSTED: Record<string, string> = {
  Inter: splitFamily(inter, interItalic),
  Lato: splitFamily(lato, latoItalic),
  Montserrat: splitFamily(montserrat, montserratItalic),
  "Open Sans": splitFamily(openSans, openSansItalic),
  Poppins: splitFamily(poppins, poppinsItalic),
  Roboto: splitFamily(roboto, robotoItalic),
  Cairo: cairo.style.fontFamily,
  Tajawal: tajawal.style.fontFamily,
  "Noto Sans Arabic": notoSansArabic.style.fontFamily,
}

/**
 * The CSS `font-family` value for a stored `fontFamily`.
 *
 * Every renderer of a text element goes through this — the stage, the fill-in
 * preview and the picker's own specimens — so there is one place where a
 * stored name becomes letterforms.
 */
export function fontStack(family?: string): string {
  const name = family ?? DEFAULT_FONT_FAMILY
  const hosted = SELF_HOSTED[name]
  if (hosted) return `${hosted}, Arial, sans-serif`
  return `"${name}", Arial, sans-serif`
}
