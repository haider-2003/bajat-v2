import { cn } from "@/lib/utils"

/**
 * Small presentational primitives shared by the table / board / card views.
 * Each maps to a specific rule in DESIGN.md.
 */

/* ---- Identity gradients (§2.2) — theme-stable ---- */

export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #A78BFA 0%, #F472B6 100%)",
  "linear-gradient(135deg, #38BDF8 0%, #6366F1 100%)",
  "linear-gradient(135deg, #FB923C 0%, #EF4444 100%)",
  "linear-gradient(135deg, #34D399 0%, #06B6D4 100%)",
  "linear-gradient(135deg, #F472B6 0%, #FBBF24 100%)",
  "linear-gradient(135deg, #818CF8 0%, #C084FC 100%)",
]

export function gradientFor(seed: number) {
  return AVATAR_GRADIENTS[seed % AVATAR_GRADIENTS.length]
}

/** Round gradient orb used for people (§8.6 "entity cell"). */
export function GradientOrb({
  seed,
  size = 20,
  className,
}: {
  seed: number
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn("shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: gradientFor(seed),
      }}
    />
  )
}

/**
 * Avatar stack — 20px orbs overlapping by 8px, each with a 2px surface ring
 * so they read as separate discs (§8.6).
 */
export function AvatarStack({
  seeds,
  max = 4,
  className,
}: {
  seeds: number[]
  max?: number
  className?: string
}) {
  if (seeds.length === 0) {
    return <span className="text-[13px] text-text-placeholder">—</span>
  }

  const shown = seeds.slice(0, max)
  const extra = seeds.length - shown.length

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((seed, i) => (
        <span
          key={i}
          aria-hidden
          className="size-5 shrink-0 rounded-full ring-2 ring-surface"
          style={{ marginLeft: i === 0 ? 0 : -8, backgroundImage: gradientFor(seed) }}
        />
      ))}
      {extra > 0 && (
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-bg text-[10px] font-medium text-text-muted ring-2 ring-surface"
          style={{ marginLeft: -8 }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}

/* ---- Status tones (§14.2) ---- */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent"

const TONE_SOFT: Record<Tone, string> = {
  neutral: "bg-neutral-bg text-text-secondary",
  info: "bg-info-bg text-info",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  accent: "bg-accent-soft text-accent-violet",
}

const TONE_BORDER: Record<Tone, string> = {
  neutral: "border-neutral-border",
  info: "border-info-border",
  success: "border-success-border",
  warning: "border-warning-border",
  danger: "border-danger-border",
  accent: "border-accent-border",
}

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-text-muted",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent-violet",
}

/**
 * Soft badge — 20px tall, 8px padding, 6px radius, 12px/500 (§14.1).
 *
 * `bordered` distinguishes the two families the spec keeps separate:
 * priority uses bordered badges, workflow status uses flat ones.
 */
export function SoftBadge({
  tone = "neutral",
  bordered = false,
  className,
  children,
}: {
  tone?: Tone
  bordered?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        TONE_SOFT[tone],
        bordered && cn("border", TONE_BORDER[tone]),
        className
      )}
    >
      {children}
    </span>
  )
}

/** 8px solid status dot (§14.3). */
export function StatusDot({ tone = "neutral" }: { tone?: Tone }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", TONE_DOT[tone])}
    />
  )
}

/** Neutral count chip (§14.4). */
export function CountChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-[rgba(0,0,0,0.05)] px-1.5 text-[11px] font-medium tabular-nums text-text-muted dark:bg-[rgba(255,255,255,0.07)]">
      {children}
    </span>
  )
}

/**
 * Segmented progress meter (§8.6).
 *
 * Discrete ticks rather than a continuous bar — the distinctive treatment in
 * the reference set.
 */
export function SegmentedMeter({
  value,
  tone = "info",
  ticks = 16,
}: {
  value: number
  tone?: Tone
  ticks?: number
}) {
  const filled = Math.round((Math.min(100, Math.max(0, value)) / 100) * ticks)

  return (
    <span className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-right text-[13px] tabular-nums text-text-secondary">
        {value}%
      </span>
      <span aria-hidden className="flex items-center gap-px">
        {Array.from({ length: ticks }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-0.5 rounded-full",
              i < filled ? TONE_DOT[tone] : "bg-border"
            )}
          />
        ))}
      </span>
    </span>
  )
}

/** Empty cells are affordances, never blanks (§8.6). */
export function EmptyCell({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-text-placeholder">
      <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
      {label}
    </span>
  )
}
