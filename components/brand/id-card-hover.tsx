import { CARD_REST, CardFace, CardFront } from "@/components/brand/id-card-face"
import { cn } from "@/lib/utils"

/**
 * The coming-soon illustration — the Bajat ID card, held above the slot it
 * will go in.
 *
 * The same card as the 404's, the failed state's and the loading state's
 * (`id-card-face.tsx`), at the same tilt. Under it, flat on the ground, is
 * its own outline: a dashed footprint, the shape every drop zone and empty
 * slot in a UI draws to say "something goes here". The card hangs a little
 * above it, rising and settling, never landing. A place kept for a
 * credential that has not been issued yet — which is what every screen this
 * stands in for is.
 *
 * Distinct from its three siblings on purpose: the flip is a card being
 * *checked*, the signal a card being *tapped*, the fill a card being
 * *written*. This is a card *waiting to be placed* — nothing is broken and
 * nothing is in progress, so the motion is the calmest of the four.
 *
 * ## One motion, all CSS
 *
 * Two keyframe sets in globals.css: `card-hover` lifts the card 6px over a
 * 3.6s breath and lets it back down; `slot-march` walks the footprint's
 * dashes around it — the flow canvas's wire pulse — three times per breath.
 * The rest pose is set inline as well as at the loop's ends, so the card
 * sits still where it should whether or not the animation ever runs — and
 * under reduced motion the global clamp leaves it there, hovering, dashes
 * still. A still dashed outline is the placeholder idiom exactly, so unlike
 * the flow canvas's wire there is nothing to hide.
 *
 * The slot is drawn in `currentColor` on `text-text`, monochrome like the
 * signal's arcs: hue belongs to the card, and a coloured slot would make the
 * ground the subject instead of the card.
 */

/**
 * The footprint's dash pattern. The rounded rect's perimeter is ~187.3
 * units; a period of 3.12 divides it 60 times, so the pattern meets itself
 * at the path's start instead of leaving a stub. `slot-march` in
 * globals.css moves exactly one period per run for the same reason.
 */
const DASH = "1.56 1.56"

/**
 * Decorative: the copy beside it says everything the picture says, so it is
 * hidden from assistive tech rather than described twice. Laid out
 * physically left-to-right regardless of locale — it is a drawing, and its
 * light comes from the top left either way.
 */
export function IdCardHover({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      dir="ltr"
      // The slot's near edge hangs ~35px below the card's box, so the box
      // carries that much bottom padding: the composition's visual centre
      // is then the centre of what the parent centres.
      className={cn("w-56 pb-8 sm:w-64 sm:pb-9", className)}
    >
      {/* The card's box carries the `perspective`: it applies to direct
          children only, and both planes below have to share one vanishing
          point or the slot would foreshorten flat while the card did not. */}
      <div className="relative aspect-[60/38] perspective-[1000px]">
        {/* The slot. The card's own shape, laid flat: its box is the card's
            slid down by half its height, so the slot's centre sits on the
            card's bottom edge, then tipped 62° away from the viewer. Half of
            it shows in front of the card's foot, half is hidden behind it —
            the card floats over the middle of the outline, not beside it.
            The in-plane -3° matches the card's, so the two read as one
            object and its ground rather than two props. */}
        <div
          className="absolute inset-x-0 top-1/2 aspect-[60/38] text-text"
          style={{ transform: "rotate(-3deg) rotateX(62deg)" }}
        >
          <svg
            viewBox="0 0 60 38"
            className="block h-full w-full"
            fill="none"
            stroke="currentColor"
            // In viewBox units: the tipped plane thins the near and far edges
            // to about half, so this is set for those to still land at ~1px.
            strokeWidth={0.55}
            strokeLinecap="round"
          >
            <rect
              x="0.4"
              y="0.4"
              width="59.2"
              height="37.2"
              // The card's `rounded-xl`, at this width.
              rx="3.2"
              opacity={0.5}
              strokeDasharray={DASH}
              className="animate-[slot-march_1.2s_linear_infinite]"
            />
          </svg>
        </div>

        {/* The card, lifted off it. `relative` so it paints over the slot —
            the box carries `perspective` without `preserve-3d`, so the two
            planes stack in DOM order rather than by depth. */}
        <div
          className="relative aspect-[60/38] animate-[card-hover_3.6s_infinite]"
          style={{ transform: CARD_REST }}
        >
          <CardFace>
            <CardFront />
          </CardFace>
        </div>
      </div>
    </div>
  )
}
