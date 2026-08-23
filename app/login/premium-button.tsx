"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Login-route button — matched to the "Add Candidate" / "Upgrade" references.
 *
 * Traits taken from those buttons:
 *  - 14px radius, not a pill and not the 8px app control
 *  - a surface carrying a *slight* vertical gradient, so the face catches
 *    light at the top instead of reading as flat fill
 *  - a hairline rim plus a 1px inner top highlight — this is what sells the
 *    raised edge; without it the button flattens out
 *  - a two-step shadow: a tight contact shadow and a wider soft lift
 *  - 15px/500 label with a touch of negative tracking
 *
 * Depth is built entirely from `box-shadow` layers so every state can animate;
 * the hover brighten rides on an `::after` white wash rather than a second
 * gradient, because gradient stops don't interpolate.
 *
 * Colour lives in four custom properties (`--pb-top/mid/bot/rim`) rather than
 * in the shadow stack, so a `tone` only restates those four values and every
 * tone keeps the identical highlight, rim and lift.
 *
 * Scoped to the login route on purpose — components/ui/button.tsx stays as
 * shadcn shipped it, so the rest of the app is untouched.
 */

const premiumButtonVariants = cva(
  [
    "relative isolate inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-5",
    "text-[15px] font-medium tracking-[-0.01em] whitespace-nowrap",
    "transition-[box-shadow,transform,background-color,color] duration-150 ease-out",
    "outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none",
    // The hover wash. Sits under the label (which is z-10) and inherits the
    // radius so it never clips a corner.
    "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-[inherit]",
    "after:bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0)_60%)]",
    "after:opacity-0 after:transition-opacity after:duration-150",
    "hover:after:opacity-100 disabled:after:opacity-0",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        premium: [
          "border border-[var(--pb-rim)] bg-clip-padding text-[#f7f7f8]",
          "bg-[linear-gradient(180deg,var(--pb-top)_0%,var(--pb-mid)_52%,var(--pb-bot)_100%)]",
          // rim + top highlight, then contact shadow, then the soft lift
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_0_0_1px_rgba(255,255,255,0.045),0_1px_2px_rgba(12,12,16,0.32),0_5px_14px_-4px_rgba(12,12,16,0.28)]",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_0_1px_rgba(255,255,255,0.07),0_1px_2px_rgba(12,12,16,0.34),0_8px_20px_-5px_rgba(12,12,16,0.34)]",
          // Pressed: sinks a pixel, loses the lift, gains a shallow inner shade.
          "active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.03),0_1px_1px_rgba(12,12,16,0.24)]",
          "disabled:border-transparent disabled:bg-none disabled:bg-[#3f3f46]/45 disabled:text-white/55 disabled:shadow-none",
          // Dark ground: the face has to sit *above* #0a0a0a, so the outer
          // lift is dropped — shadows don't read on a near-black page.
          "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.5)]",
          "dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_rgba(0,0,0,0.55)]",
          "dark:active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)]",
          "dark:disabled:bg-[#242428] dark:disabled:text-white/30",
        ],
        soft: [
          // The "Run AI" companion: white face, hairline rim, whisper of lift.
          "border border-border bg-surface text-text",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(12,12,16,0.06)]",
          "hover:border-border-strong hover:bg-background-subtle hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_-1px_rgba(12,12,16,0.10)]",
          "active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(12,12,16,0.08)]",
          "disabled:text-text-placeholder disabled:shadow-none",
          "dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none",
          "dark:hover:bg-white/[0.08] dark:hover:shadow-none",
          "dark:disabled:bg-white/[0.02] dark:disabled:text-text-placeholder",
        ],
      },
      /**
       * Surface colour. Each tone is three gradient stops plus a rim; the rim
       * is always darker than the bottom stop so the edge stays defined
       * against a light page. `ink` is the reference black.
       */
      tone: {
        ink: "[--pb-top:#2a2a2f] [--pb-mid:#1a1a1d] [--pb-bot:#131316] [--pb-rim:#0c0c0e] dark:[--pb-top:#2e2e34] dark:[--pb-mid:#202024] dark:[--pb-bot:#1a1a1e] dark:[--pb-rim:rgba(255,255,255,0.10)]",
        violet:
          "[--pb-top:#8b6cff] [--pb-mid:#6f47f0] [--pb-bot:#5e35dc] [--pb-rim:#3d1fa4]",
        blue: "[--pb-top:#5292ff] [--pb-mid:#2f70e6] [--pb-bot:#2360cd] [--pb-rim:#164390]",
        emerald:
          "[--pb-top:#36c47a] [--pb-mid:#1ba362] [--pb-bot:#128a52] [--pb-rim:#0a5c37]",
        amber:
          "[--pb-top:#f5ad46] [--pb-mid:#e28d1e] [--pb-bot:#c87613] [--pb-rim:#8b4e09]",
        rose: "[--pb-top:#f76e77] [--pb-mid:#e2444f] [--pb-bot:#cb3441] [--pb-rim:#8f1f2b]",
      },
    },
    defaultVariants: {
      variant: "premium",
      tone: "ink",
    },
  }
)

export function PremiumButton({
  variant,
  tone,
  icon: Icon,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof premiumButtonVariants> & {
    icon?: React.ElementType
  }) {
  return (
    <button
      type="button"
      className={cn(premiumButtonVariants({ variant, tone }), className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} />}
        {children}
      </span>
    </button>
  )
}

export { premiumButtonVariants }
