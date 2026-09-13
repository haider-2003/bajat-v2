import { CARD_REST, CardFace, CardFront } from "@/components/brand/id-card-face"
import { cn } from "@/lib/utils"

/**
 * The 404 illustration — the Bajat ID card, turning over and over.
 *
 * The front is the front card of `IdCardStack` — same indigo gradient, same
 * furniture, same rim light and sheen — so this reads as the object from the
 * splash and the sign-in screen seen a third time (§18.1), not a new prop.
 * The back is the reverse of that same card: a magnetic stripe, and "404"
 * printed where a serial number would go. The card holds face up, turns,
 * holds face down, turns back: a credential being checked and coming up 404
 * every time.
 *
 * The face itself lives in `id-card-face.tsx`, shared with the failed-load
 * illustration (`IdCardSignal`) so the two stay one object.
 *
 * ## One motion, all CSS
 *
 * The standard three-layer flip. An outer box carries the `perspective`; a
 * `preserve-3d` flipper carries the rotation (`card-flip` in globals.css);
 * the two faces sit on top of each other with their backs hidden, the rear
 * one pre-turned 180° so it faces out once the flipper has come round. The
 * flipper's rest pose is set inline as well as at `0%`, so the card sits at
 * the same angle whether or not the animation ever runs — and under reduced
 * motion the global clamp collapses it to one instant iteration, leaving the
 * card face up at rest.
 *
 * The animation starts 1.45s in (a negative delay), so the first turn comes
 * ~0.6s after the page appears instead of after the full 2.05s hold. Only the
 * phase moves: the card is already at rest anywhere inside that opening hold,
 * so there is no jump, and every hold after the first keeps its full length.
 */

/**
 * The back. A magnetic stripe bled edge to edge — the stack's strip card
 * has the same one, at the same black — and the code in the mono face,
 * the way IDs and keys are set everywhere else in the app. The stripe sits
 * below the top corners' radius, so nothing needs clipping.
 */
function BackFurniture() {
  return (
    <svg viewBox="0 0 60 38" aria-hidden className="block h-full w-full">
      <rect x="0" y="4.6" width="60" height="6.4" fill="#000" opacity="0.35" />
      <text
        x="30"
        y="29.4"
        textAnchor="middle"
        fontSize="14.5"
        fontWeight="600"
        letterSpacing="-0.04em"
        fill="#fff"
        fillOpacity="0.94"
        className="font-mono"
      >
        404
      </text>
    </svg>
  )
}

/**
 * Decorative: the copy beside it says everything the picture says, so it is
 * hidden from assistive tech rather than described twice.
 */
export function IdCardFlip({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("w-56 perspective-[1000px] sm:w-64", className)}>
      <div
        className="relative aspect-[60/38] transform-3d animate-[card-flip_5s_-1.45s_infinite]"
        style={{ transform: CARD_REST }}
      >
        <CardFace>
          <CardFront />
        </CardFace>
        <CardFace className="rotate-y-180">
          <BackFurniture />
        </CardFace>
      </div>
    </div>
  )
}
