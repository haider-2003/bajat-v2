import { cn } from "@/lib/utils"

/**
 * One face of the small Bajat card — the piece `IdCardFlip` and
 * `IdCardSignal` are both drawn from.
 *
 * The front of the stack's front card at 1/7 scale, so the 404 and the
 * failed-load illustrations read as the object from the splash and the
 * sign-in screen seen again (§18.1), not as two new props that happen to
 * resemble it. Anything that draws the card draws it through here; a tweak
 * to the gradient or the furniture lands on every page at once.
 */

/**
 * The card's resting pose. Lit from the top left like the stack's front
 * card, tilted the same few degrees. Also the `0%` frame of `card-flip`
 * and the ends of `signal-reach` in globals.css, so both loops close on
 * exactly this.
 */
export const CARD_REST = "rotateX(10deg) rotateY(-14deg) rotate(-3deg)"

/** The stack's front-card face. */
const FACE = "linear-gradient(140deg, #6470ff 0%, #4f5dea 38%, #141a4d 100%)"

/** Its specular sheen, raked across the face. */
const SHEEN =
  "linear-gradient(118deg, transparent 28%, rgba(255,255,255,0.14) 44%, rgba(255,255,255,0.03) 54%, transparent 68%)"

/**
 * One side of the card: the gradient, the throw, the rim light and the sheen
 * — the stack's front-card recipe, scaled to this card's size. The furniture
 * goes in as children, in an SVG so it scales with the card.
 *
 * Shadows are `box-shadow` on the face rather than a `filter` on whatever
 * moves it: a filter flattens the 3D context of the element it sits on,
 * which would stop a flipped face hiding its back.
 */
export function CardFace({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
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
 * The front's furniture — the stack's front card at 1/7 scale: 60×38 for its
 * 420×268. Every measurement is the stack's value × 0.143, so the 24px
 * padding becomes 3.4, the 48px portrait well 6.9, and so on; the two
 * drawings stay the same object rather than a resemblance. White at the
 * stack's own opacities.
 *
 * Split into what the card *is* and what is *printed on it*, because the
 * loading illustration draws the first and fills in the second.
 */

/** The recessed slots — the status pill's ground and the portrait well. */
const SLOTS = [
  { x: 48.6, y: 3.85, width: 8, height: 2, rx: 1, opacity: 0.15 },
  { x: 3.4, y: 15.55, width: 6.9, height: 6.9, rx: 1.1, opacity: 0.15 },
]

/** The printed content, in reading order — which is the order it loads in. */
const BARS = [
  // Top row — issuer tile and name bar, then the status pill's text.
  { x: 3.4, y: 3.4, width: 2.9, height: 2.9, rx: 0.7, opacity: 0.8 },
  { x: 7.4, y: 4.3, width: 9.1, height: 1.1, rx: 0.55, opacity: 0.7 },
  { x: 50.05, y: 4.42, width: 5.1, height: 0.86, rx: 0.43, opacity: 0.6 },
  // The three identity bars beside the portrait.
  { x: 12.3, y: 16.2, width: 18.3, height: 1.4, rx: 0.7, opacity: 0.9 },
  { x: 12.3, y: 18.7, width: 13.7, height: 1.1, rx: 0.55, opacity: 0.45 },
  { x: 12.3, y: 20.9, width: 9.1, height: 0.86, rx: 0.43, opacity: 0.3 },
  // Chips — uneven widths, as on the stack; equal ones read as a grid.
  { x: 3.4, y: 33.5, width: 8, height: 1.1, rx: 0.55, opacity: 0.55 },
  { x: 12.26, y: 33.5, width: 5.7, height: 1.1, rx: 0.55, opacity: 0.55 },
  { x: 18.82, y: 33.5, width: 9.1, height: 1.1, rx: 0.55, opacity: 0.55 },
  { x: 28.78, y: 33.5, width: 4.6, height: 1.1, rx: 0.55, opacity: 0.55 },
  { x: 34.24, y: 33.5, width: 6.9, height: 1.1, rx: 0.55, opacity: 0.55 },
]

/** Between one bar starting to fill and the next. */
const FILL_STAGGER_S = 0.08

/**
 * The front face.
 *
 * With `filling`, the printed bars run `card-fill` (globals.css) in reading
 * order: each sits at a ghost of itself, comes up to its full weight, holds,
 * and falls back — the skeleton pulse of §8.11, drawn on the card. The whole
 * run starts a second in (a negative delay), so the first bars are already
 * arriving when the card appears rather than after a full ghost hold.
 */
export function CardFront({ filling = false }: { filling?: boolean }) {
  return (
    <svg viewBox="0 0 60 38" aria-hidden className="block h-full w-full">
      {SLOTS.map((r, i) => (
        <rect key={`slot-${i}`} {...r} fill="#fff" />
      ))}
      {BARS.map(({ opacity, ...r }, i) =>
        filling ? (
          // Nested opacity multiplies: the group keeps the bar's own weight
          // and the rect inside runs ghost → 1, so every bar fills to exactly
          // the strength it has at rest, whatever that is.
          <g key={`bar-${i}`} opacity={opacity}>
            <rect
              {...r}
              fill="#fff"
              className="animate-[card-fill_2.8s_infinite_both]"
              style={{ animationDelay: `${i * FILL_STAGGER_S - 1}s` }}
            />
          </g>
        ) : (
          <rect key={`bar-${i}`} {...r} opacity={opacity} fill="#fff" />
        )
      )}
    </svg>
  )
}
