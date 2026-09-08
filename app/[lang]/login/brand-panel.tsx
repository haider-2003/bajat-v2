import { IdCard, ShieldCheck, Workflow } from "lucide-react"

import { BajatMark } from "@/components/brand/bajat-mark"
import { IdCardStack } from "@/components/brand/id-card-stack"
import { getTranslations } from "@/i18n/server"
import type { TranslationKey } from "@/i18n/translate"

/**
 * Login brand panel — the dark half of the split screen.
 *
 * Reuses the intro splash's card fan and palette (near-black ground,
 * indigo/green gradients) so the sign-in screen reads as a continuation of it.
 * Hidden below `lg`, where the form takes the full width (DESIGN.md §18.1).
 *
 * Motion is a one-time staggered entrance and nothing more: the stack settles
 * and holds. The user's task is the form on the left, and a card that keeps
 * drifting keeps reclaiming the eye. Reduced motion is handled globally in
 * globals.css (§18.0 rule 10).
 */

const POINTS: { icon: typeof IdCard; key: TranslationKey }[] = [
  { icon: IdCard, key: "auth.panel.pointTemplates" },
  { icon: Workflow, key: "auth.panel.pointRouting" },
  { icon: ShieldCheck, key: "auth.panel.pointAccess" },
]

/**
 * A server component, so it reads its copy straight from the dictionary rather
 * than through the client provider — nothing on this panel is interactive.
 */
export async function BrandPanel() {
  const t = await getTranslations()

  return (
    <div className="relative hidden overflow-hidden bg-[#080d16] lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Ambient glow, matching the intro's radial green (§2.2 gradients) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[680px] -translate-x-1/2 -translate-y-1/2 animate-[glow-drift_14s_ease-in-out_infinite] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(18,163,122,0.28) 0%, rgba(18,163,122,0) 70%)",
        }}
      />
      {/* A second, cooler glow up top: gives the stack a light direction to
          catch, rather than lighting it from dead centre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/4 size-[520px] rounded-full opacity-45"
        style={{
          background:
            "radial-gradient(circle, rgba(99,112,255,0.30) 0%, rgba(99,112,255,0) 70%)",
        }}
      />
      {/* Hairline grid, masked to a soft ellipse so it never reaches an edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 45%, #000 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 55% at 50% 45%, #000 20%, transparent 75%)",
        }}
      />

      {/* Wordmark */}
      <div className="relative flex items-center gap-2.5">
        <BajatMark className="size-6 text-white" />
        <span className="text-base font-semibold tracking-[-0.01em] text-white">
          {t("app.name")}
        </span>
      </div>

      <div className="relative flex items-center justify-center py-10">
        <IdCardStack mode="panel" />
      </div>

      {/* Value line + supporting points */}
      <div className="relative">
        <p className="max-w-sm text-xl font-semibold leading-snug tracking-[-0.015em] text-white">
          {t("auth.panel.headline")}
        </p>
        <ul className="mt-6 space-y-3">
          {POINTS.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-white/45" strokeWidth={1.5} />
              <span className="text-[13px] text-white/65">{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
