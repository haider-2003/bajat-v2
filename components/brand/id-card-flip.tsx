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
 *
 * Shadows are `box-shadow` on each face rather than a `filter` on the
 * flipper: a filter flattens the 3D context of whatever it sits on, which
 * would stop the faces hiding their backs.
 */

/**
 * The flipper's resting pose — also the `0%` frame of `card-flip`, so the
 * loop closes on exactly this. Lit from the top left like the stack's front
 * card, tilted the same few degrees.
 */
const REST = "rotateX(10deg) rotateY(-14deg) rotate(-3deg)"

/** The stack's front-card face. */
const FACE = "linear-gradient(140deg, #6470ff 0%, #4f5dea 38%, #141a4d 100%)"

/** Its specular sheen, raked across the face. */
const SHEEN =
  "linear-gradient(118deg, transparent 28%, rgba(255,255,255,0.14) 44%, rgba(255,255,255,0.03) 54%, transparent 68%)"

/**
 * One side of the card: the gradient, the throw, the rim light and the sheen
 * — the stack's front-card recipe, scaled to this card's size. The furniture
 * goes in as children, in an SVG so it scales with the card.
 */
function Face({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 rounded-xl backface-hidden",
        // Tight contact shadow plus a wide soft one — "hovering", not
        // "printed on".
        "shadow-[0_1px_2px_rgba(0,0,0,0.22),0_22px_40px_-8px_rgba(0,0,0,0.38)]",
        className
      )}
      style={{ backgroundImage: FACE }}
    >
      {children}
      {/* Rim light — a 1px top bevel plus a full hairline edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_0_1px_rgba(255,255,255,0.10)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{ backgroundImage: SHEEN }}
      />
    </div>
  )
}

/**
 * The front — the stack's front card at 1/7 scale: 60×38 for its 420×268.
 * Every measurement is the stack's value × 0.143, so the 24px padding
 * becomes 3.4, the 48px portrait well 6.9, and so on; the two drawings stay
 * the same object rather than a resemblance. White at the stack's own
 * opacities.
 */
function FrontFurniture() {
  return (
    <svg viewBox="0 0 60 38" aria-hidden className="block h-full w-full">
      {/* Top row — issuer tile and name bar, then the status pill. */}
      <rect x="3.4" y="3.4" width="2.9" height="2.9" rx="0.7" fill="#fff" opacity="0.8" />
      <rect x="7.4" y="4.3" width="9.1" height="1.1" rx="0.55" fill="#fff" opacity="0.7" />
      <rect x="48.6" y="3.85" width="8" height="2" rx="1" fill="#fff" opacity="0.15" />
      <rect x="50.05" y="4.42" width="5.1" height="0.86" rx="0.43" fill="#fff" opacity="0.6" />

      {/* Portrait well and the three identity bars. */}
      <rect x="3.4" y="15.55" width="6.9" height="6.9" rx="1.1" fill="#fff" opacity="0.15" />
      <rect x="12.3" y="16.2" width="18.3" height="1.4" rx="0.7" fill="#fff" opacity="0.9" />
      <rect x="12.3" y="18.7" width="13.7" height="1.1" rx="0.55" fill="#fff" opacity="0.45" />
      <rect x="12.3" y="20.9" width="9.1" height="0.86" rx="0.43" fill="#fff" opacity="0.3" />

      {/* Chips — uneven widths, as on the stack; equal ones read as a grid. */}
      <rect x="3.4" y="33.5" width="8" height="1.1" rx="0.55" fill="#fff" opacity="0.55" />
      <rect x="12.26" y="33.5" width="5.7" height="1.1" rx="0.55" fill="#fff" opacity="0.55" />
      <rect x="18.82" y="33.5" width="9.1" height="1.1" rx="0.55" fill="#fff" opacity="0.55" />
      <rect x="28.78" y="33.5" width="4.6" height="1.1" rx="0.55" fill="#fff" opacity="0.55" />
      <rect x="34.24" y="33.5" width="6.9" height="1.1" rx="0.55" fill="#fff" opacity="0.55" />
    </svg>
  )
}

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
        style={{ transform: REST }}
      >
        <Face>
          <FrontFurniture />
        </Face>
        <Face className="rotate-y-180">
          <BackFurniture />
        </Face>
      </div>
    </div>
  )
}
