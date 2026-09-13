import { CARD_REST, CardFace, CardFront } from "@/components/brand/id-card-face"
import { cn } from "@/lib/utils"

/**
 * The failed-load illustration — the Bajat ID card, tapped against a reader
 * that never answers.
 *
 * The same card as the 404's (`id-card-face.tsx`), at the same tilt, so a
 * request that came back with nothing and a page that does not exist are
 * recognisably the same object in two kinds of trouble. Beside it, the
 * three arcs of a contactless read: the card leans in, the arcs light up
 * outward one after another, the outermost — dashed — never quite makes it,
 * and everything fades back to wait. Then it tries again. A request going
 * out and no reply coming back, which is exactly what every failure this
 * stands in for amounts to.
 *
 * ## One motion, all CSS
 *
 * Two keyframe sets in globals.css share a 3.2s cycle: `signal-reach` nudges
 * the card toward the arcs and back, and `signal-ping` brings each arc up
 * and lets it fall, staggered by a delay per arc. The rest pose is set
 * inline as well as at the ends of the loop, so the card sits still where
 * it should whether or not the animation ever runs — and under reduced
 * motion the global clamp leaves it there, arcs at their resting ghost.
 *
 * The arcs are drawn in `currentColor` on `text-text`, monochrome like the
 * mark: hue belongs to the card, and a coloured ping would make the reader
 * the subject instead of the card.
 */

/**
 * Arcs about (2, 36) in a 44×72 box, radii 11 / 21 / 31, each spanning
 * ±48° — the contactless symbol's proportions, opening away from the card.
 * Delays are seconds into the shared cycle — the tap lands first, then the
 * arcs light in order, ~0.2s apart.
 */
const ARCS = [
  { d: "M9.36 27.83 A11 11 0 0 1 9.36 44.17", delay: 0.3 },
  { d: "M16.05 20.39 A21 21 0 0 1 16.05 51.61", delay: 0.5 },
  // The one that breaks up: dashed, and never brought to full strength.
  { d: "M22.74 12.96 A31 31 0 0 1 22.74 59.04", delay: 0.7, broken: true },
] as const

/**
 * Decorative: the copy beside it says everything the picture says, so it is
 * hidden from assistive tech rather than described twice. Laid out
 * physically left-to-right regardless of locale — it is a drawing, and its
 * light comes from the top left either way.
 */
export function IdCardSignal({ className }: { className?: string }) {
  return (
    <div aria-hidden dir="ltr" className={cn("flex items-center", className)}>
      <div className="w-40 perspective-[1000px] sm:w-44">
        <div
          className="relative aspect-[60/38] animate-[signal-reach_3.2s_infinite]"
          style={{ transform: CARD_REST }}
        >
          <CardFace>
            <CardFront />
          </CardFace>
        </div>
      </div>

      <svg
        viewBox="0 0 44 72"
        // Sized against the card: the outer arc spans about two thirds of
        // its height, so the ping is a peer of the card rather than a badge
        // on it. The stroke is in viewBox units and lands at ~2px.
        className="ms-2 h-28 w-[68px] shrink-0 text-text"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
      >
        {ARCS.map((arc) => (
          <path
            key={arc.d}
            d={arc.d}
            // Nested opacity multiplies, so the broken arc's ghost is
            // fainter too: distance, not a second colour.
            opacity={"broken" in arc ? 0.6 : undefined}
            strokeDasharray={"broken" in arc ? "3 5" : undefined}
            // `both`: hold the first frame through the delay, or every arc flashes
            // at full strength for a moment on mount before its ping begins.
            className="animate-[signal-ping_3.2s_infinite_both]"
            style={{ animationDelay: `${arc.delay}s` }}
          />
        ))}
      </svg>
    </div>
  )
}
