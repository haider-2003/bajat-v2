import { CARD_REST, CardFace, CardFront } from "@/components/brand/id-card-face"
import { cn } from "@/lib/utils"

/**
 * The loading illustration — the Bajat ID card, being written.
 *
 * The same card as the 404's and the failed state's (`id-card-face.tsx`),
 * at the same tilt. Its printed bars fill in one after another in reading
 * order — issuer, name, the identity lines, the chips — hold, and clear
 * again, while the card lifts a little toward the light and settles. A
 * credential being filled in while you wait for it, which is what every
 * request this stands in for is doing.
 *
 * ## One motion, all CSS
 *
 * `card-fill` (globals.css) runs on each bar with a stagger — see
 * `CardFront`'s `filling` mode — and `card-lift` on the card itself, both
 * on the same 2.8s clock and both started a second in, so the card is
 * already at work when it appears. The rest pose is set inline as well as
 * at the loop's ends, so the card sits still where it should whether or not
 * the animation ever runs — and under reduced motion the global clamp
 * leaves it there, printed in full.
 */

/**
 * Decorative: the line under it says what the picture says, so it is
 * hidden from assistive tech rather than described twice.
 */
export function IdCardFill({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("w-44 perspective-[1000px] sm:w-48", className)}>
      <div
        className="relative aspect-[60/38] animate-[card-lift_2.8s_-1s_infinite]"
        style={{ transform: CARD_REST }}
      >
        <CardFace>
          <CardFront filling />
        </CardFace>
      </div>
    </div>
  )
}
