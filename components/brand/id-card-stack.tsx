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
 * fan keeps its depth. preserve-3d is only needed for *nested* 3D scenes —
 * which is exactly what the front card's flip (below) is, so it carries its
 * own perspective and its own preserve-3d, scoped to that one card.
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
 * The reverse of the front card — the 2FA enrolment QR
 * ------------------------------------------------------------------ */

/**
 * What the flip reveals.
 *
 * The copy is passed in rather than read from the dictionary here: this file is
 * presentational and is rendered from two different trees, so a `useT()` inside
 * it would tie it to one of them.
 */
export type CardQr = {
  /** A data URL — see `qrCodeSrc` in `features/auth/qr.ts`. */
  src: string
  title: string
  hint: string
}

/**
 * The back of the indigo card: a magnetic stripe where a real credential's back
 * carries one, and the code printed beside its instruction.
 *
 * The QR sits on a white tile with its own padding, not straight on the card. A
 * scanner needs a light ground and a quiet zone around the modules; the card's
 * indigo gives it neither, and a code that cannot be read is the one thing this
 * face cannot afford.
 */
function QrFace({ qr }: { qr: CardQr }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mt-6 h-9 shrink-0 bg-black/35" />
      <div className="flex flex-1 items-center gap-5 p-6">
        <div className="shrink-0 rounded-xl bg-white p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
          {/* A data URL, so there is nothing for next/image to fetch, resize or
              cache — and `alt=""` because the whole stack is decorative to
              assistive tech (the wrapper below is `aria-hidden`). No wording of
              an alt text makes a QR usable without a camera; the form beside
              this panel carries the instruction in words. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.src} alt="" className="block size-27" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-[13px] font-semibold text-white">{qr.title}</p>
          <p className="text-[11px] leading-relaxed text-white/60">{qr.hint}</p>
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
    animation: "intro-card-in 700ms cubic-bezier(0.16, 0.84, 0.28, 1) both",
    delays: [120, 220, 320],
  },
} as const

/**
 * One side of a card: the gradient, the throw, the rim light and the sheen.
 *
 * Positioning is the caller's — `relative` for a lone card, `absolute inset-0`
 * for a face stacked inside the flipper — because both establish the containing
 * block the rim and the sheen are laid out against.
 */
function CardSurface({
  depth,
  bg,
  className,
  children,
}: {
  depth: "front" | "back"
  bg: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "h-full overflow-hidden rounded-2xl",
        depth === "front"
          ? // Tight contact shadow plus a deep, wide throw
            "shadow-[0_2px_6px_rgba(0,0,0,0.4),0_28px_60px_-12px_rgba(0,0,0,0.65)]"
          : // Back cards: no contact shadow, softer and weaker
            "shadow-[0_20px_50px_-16px_rgba(0,0,0,0.55)]",
        className
      )}
      style={{ backgroundImage: bg }}
    >
      {children}

      {/* Rim light — a 1px top bevel plus a full hairline edge.
          Weaker on the back cards, which catch less light. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl",
          depth === "front"
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
      {depth === "back" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl bg-[#050912]/45"
        />
      )}
    </div>
  )
}

export function IdCardStack({
  mode = "panel",
  className,
  /**
   * Hand the front card a reverse and it turns over to show it.
   *
   * Used by the sign-in panel when a reset user has to enrol a new
   * authenticator: the card the splash just set down flips, and the new QR is
   * on its back. Passing the code is what triggers the turn, so the caller only
   * decides *whether* there is one — never when to animate.
   *
   * A transition rather than a keyframe animation, on purpose. The entrance
   * keyframes are suppressed once the splash has handed off
   * (`[data-handoff-target][data-handoff="done"] > *` in globals.css), and that
   * rule reaches direct children only — a transition on a grandchild is
   * untouched by it, so the flip plays whether or not the intro ran.
   */
  qr,
}: {
  mode?: keyof typeof ENTRANCE
  className?: string
  qr?: CardQr | null
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
      {CARDS.map((card, i) => {
        /**
         * The front card is always built as a flipper, `qr` or not.
         *
         * A transition needs a from-value that was already in the DOM: mounting
         * the flipper only once the code arrives would mount it at
         * `rotateY(180deg)`, and the card would simply *be* face-down with
         * nothing to see. So the structure is there from the start and only the
         * angle changes — which is also what keeps the splash's copy of this
         * stack and the panel's the same object rather than two shapes.
         */
        const flipper = card.key === "primary"

        return (
          <div
            key={card.key}
            aria-hidden
            className={cn(
              "absolute inset-0",
              card.depth === "front" ? "z-20" : "z-10",
              // The container's perspective reaches its own children only, so
              // the flipper — one level deeper — needs its own. A touch longer
              // than the fan's, which keeps the turn from bowing at the edges.
              flipper && "perspective-[1600px]"
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
            {flipper ? (
              <div
                className={cn(
                  "relative h-full transform-3d",
                  // Slow enough to read as one object turning over rather than
                  // a swap, and held back a beat so the code arriving and the
                  // card moving are two events instead of one.
                  "transition-transform delay-200 duration-[900ms]",
                  "ease-[cubic-bezier(0.65,0,0.25,1)]"
                )}
                style={{ transform: qr ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <CardSurface
                  depth={card.depth}
                  bg={card.bg}
                  className="absolute inset-0 backface-hidden"
                >
                  {card.face}
                </CardSurface>
                {/* Pre-turned, so it faces out once the flipper comes round.
                    Absent until there is a code: an empty reverse would be a
                    blank indigo plate for anyone who catches the card mid-turn
                    on a browser that ignores `backface-visibility`. */}
                {qr && (
                  <CardSurface
                    depth={card.depth}
                    bg={card.bg}
                    className="absolute inset-0 rotate-y-180 backface-hidden"
                  >
                    <QrFace qr={qr} />
                  </CardSurface>
                )}
              </div>
            ) : (
              <CardSurface depth={card.depth} bg={card.bg} className="relative">
                {card.face}
              </CardSurface>
            )}
          </div>
        )
      })}
    </div>
  )
}
