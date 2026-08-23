import { cn } from "@/lib/utils"

/**
 * The Bajat card fan — shared by the intro splash and the login brand panel.
 *
 * One artwork, two entrances. The splash and the sign-in screen are meant to
 * read as the same object seen twice (§18.1), which only holds if they *are*
 * the same object; keeping two copies in sync by hand is how that promise
 * quietly breaks.
 *
 * The stack is a real 3D fan: the container carries the perspective and each
 * card sits at its own Z depth, so the back two recede optically instead of
 * merely being rotated. Depth is reinforced four ways — a dark scrim, a weaker
 * rim light, a wider/softer shadow, and less furniture on the cards further
 * back. Any one of those alone is too subtle to read.
 *
 * The container sets `perspective` but must NOT set `transform-style:
 * preserve-3d`. The two back cards sit at the same Z with opposite `rotateY`
 * and overlap across most of their width, so their planes cross; inside a
 * preserve-3d context the browser renders that intersection literally — each
 * card's nearer half drawn in front — and ignores `z-index`, which shows up as
 * one card rendering half-hidden. Flat children get painted in z-index order
 * instead, and `perspective` still applies to each card's own rotation, so the
 * fan keeps its depth. preserve-3d is only needed for *nested* 3D scenes.
 *
 * Motion: each card's resting position is its `--fan` transform, set inline so
 * the layout is correct even if no animation ever runs. The keyframes then
 * animate *to* `var(--fan)` from a collapsed, unfanned stack, so the cards
 * appear to spread into place. Both entrances are one-shot — nothing loops.
 */

/* ------------------------------------------------------------------ *
 * Card furniture — abstract on purpose, never a real ID
 * ------------------------------------------------------------------ */

function Bar({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <span className={cn("block rounded-full", className)} style={style} />
}

/** Front card: full furniture, the one the eye lands on. */
function PrimaryFace() {
  return (
    <div className="flex h-full flex-col justify-between p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="size-5 rounded-md bg-white/80" />
          <Bar className="h-2 w-16 bg-white/70" />
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1">
          <Bar className="h-1.5 w-9 bg-white/60" />
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        {/* Portrait well — inset so it reads as recessed into the card */}
        <span className="size-12 rounded-lg bg-white/15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]" />
        <div className="space-y-2">
          <Bar className="h-2.5 w-32 bg-white/90" />
          <Bar className="h-2 w-24 bg-white/45" />
          <Bar className="h-1.5 w-16 bg-white/30" />
        </div>
      </div>

      {/* Uneven widths — equal chips read as a placeholder grid */}
      <div className="flex gap-1.5">
        {[56, 40, 64, 32, 48].map((w, k) => (
          <Bar key={k} className="h-2 bg-white/55" style={{ width: w }} />
        ))}
      </div>
    </div>
  )
}

/** Back-left: a credential strip. Sparser, since it sits behind. */
function StripFace() {
  return (
    <div className="flex h-full flex-col justify-between p-6">
      <div className="flex items-center justify-between">
        <Bar className="h-2 w-20 bg-white/60" />
        <span className="size-6 rounded-md bg-white/20" />
      </div>
      {/* Magnetic stripe, bled to both edges */}
      <div className="-mx-6 h-9 bg-black/35" />
      <div className="space-y-2">
        <Bar className="h-2 w-28 bg-white/50" />
        <Bar className="h-1.5 w-20 bg-white/25" />
      </div>
    </div>
  )
}

/** Back-right: an access card — contact chip plus a scannable block. */
function AccessFace() {
  return (
    <div className="flex h-full flex-col justify-between p-6">
      <div className="flex items-start justify-between">
        <Bar className="h-2 w-16 bg-white/55" />
        <span className="h-7 w-9 rounded-[5px] bg-white/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" />
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-1.5">
          <Bar className="h-2 w-24 bg-white/45" />
          <Bar className="h-1.5 w-14 bg-white/25" />
        </div>
        <div className="grid grid-cols-4 gap-[3px]">
          {Array.from({ length: 12 }, (_, k) => (
            <span
              key={k}
              className={cn(
                "size-1.5 rounded-[2px]",
                k % 3 === 0 ? "bg-white/45" : "bg-white/20"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The fan
 * ------------------------------------------------------------------ */

const CARDS = [
  {
    key: "strip",
    // rotateY + translateZ do the receding; the 2D rotate only sets the fan
    fan: "rotateY(13deg) rotate(-8deg) translate3d(-76px, 10px, -70px)",
    bg: "linear-gradient(140deg, #12a37a 0%, #0a5a45 46%, #07231b 100%)",
    depth: "back" as const,
    face: <StripFace />,
  },
  {
    key: "access",
    fan: "rotateY(-12deg) rotate(6deg) translate3d(80px, 18px, -70px)",
    bg: "linear-gradient(140deg, #2b3a5c 0%, #141c2e 100%)",
    depth: "back" as const,
    face: <AccessFace />,
  },
  {
    key: "primary",
    fan: "rotate(-2deg)",
    bg: "linear-gradient(140deg, #6470ff 0%, #4f5dea 38%, #141a4d 100%)",
    depth: "front" as const,
    face: <PrimaryFace />,
  },
]

/** Per-mode entrance. `intro` travels further and holds a longer stagger. */
const ENTRANCE = {
  panel: {
    animation: "card-in 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
    delays: [0, 90, 180],
  },
  intro: {
    animation: "intro-card-in 900ms cubic-bezier(0.16, 0.84, 0.28, 1) both",
    delays: [140, 260, 380],
  },
} as const

export function IdCardStack({
  mode = "panel",
  className,
}: {
  mode?: keyof typeof ENTRANCE
  className?: string
}) {
  const { animation, delays } = ENTRANCE[mode]

  return (
    <div
      // The splash flies its own copy of this stack onto this one; see the
      // hand-off note in globals.css.
      data-handoff-target={mode === "panel" ? "" : undefined}
      className={cn(
        // `perspective` alone, deliberately NOT `transform-style: preserve-3d`
        // — see the note on plane intersection above.
        "relative h-[268px] w-[420px] [perspective:1400px]",
        className
      )}
    >
      {CARDS.map((card, i) => (
        <div
          key={card.key}
          aria-hidden
          className={cn(
            "absolute inset-0",
            card.depth === "front" ? "z-20" : "z-10"
          )}
          style={{
            // Resting position. Also the keyframes' `to` value, so the card
            // lands exactly here whether or not the animation ever plays.
            ["--fan" as string]: card.fan,
            transform: card.fan,
            animation,
            animationDelay: `${delays[i]}ms`,
          }}
        >
          <div
            className={cn(
              "relative h-full overflow-hidden rounded-2xl",
              card.depth === "front"
                ? // Tight contact shadow plus a deep, wide throw
                  "shadow-[0_2px_6px_rgba(0,0,0,0.4),0_28px_60px_-12px_rgba(0,0,0,0.65)]"
                : // Back cards: no contact shadow, softer and weaker
                  "shadow-[0_20px_50px_-16px_rgba(0,0,0,0.55)]"
            )}
            style={{ backgroundImage: card.bg }}
          >
            {card.face}

            {/* Rim light — a 1px top bevel plus a full hairline edge.
                Weaker on the back cards, which catch less light. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 rounded-2xl",
                card.depth === "front"
                  ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_0_1px_rgba(255,255,255,0.10)]"
                  : "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
              )}
            />
            {/* Specular sheen, raked across the face */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                backgroundImage:
                  "linear-gradient(118deg, transparent 28%, rgba(255,255,255,0.14) 44%, rgba(255,255,255,0.03) 54%, transparent 68%)",
              }}
            />
            {/* Scrim: the single strongest depth cue — the back cards simply
                receive less light than the front one. */}
            {card.depth === "back" && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl bg-[#050912]/45"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
