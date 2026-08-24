"use client"

import * as React from "react"
import { Monitor, Moon, Palette, SunMedium } from "lucide-react"

import {
  SettingsBlock,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-section"
import { Segmented, type SegmentedItem } from "@/components/ui/segmented"
import { SwatchPicker } from "@/components/ui/swatch-picker"
import {
  CONTROL_STYLES,
  FLAT_VARIANTS,
  useControlStyle,
  useControlSurface,
  useFlatVariant,
  type ControlStyle,
  type ControlSurface,
  type FlatVariant,
} from "@/components/ui/control-style"
import { ACCENTS, useBrand, type PrimaryStyle } from "@/components/layout/brand"
import { useTheme, type Theme } from "@/components/layout/theme-provider"
import { cn } from "@/lib/utils"

/**
 * Appearance — theme, brand colour, and control surface.
 *
 * The theme controls used to live in the sidebar footer as a one-click flip
 * and a cycler. Both were two-state affordances standing in for multi-state
 * preferences: the flip could never express "system", and the cycler only told
 * you the current value after you had already changed it. As named rows, every
 * option is visible before it is picked.
 *
 * Nothing here owns state. `ThemeProvider`, the brand store and the
 * control-style store each keep their own value in localStorage and apply it to
 * `<html>`; this section is a view onto all three, so there is nothing to keep
 * in sync with the rest of the app.
 */

const THEME_ITEMS: readonly SegmentedItem<Theme>[] = [
  { value: "light", label: "Light", icon: SunMedium },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

const PRIMARY_ITEMS: readonly SegmentedItem<PrimaryStyle>[] = [
  {
    value: "neutral",
    label: "Neutral",
    hint: "Black on light, white on dark — DESIGN.md §2.1 Strategy A",
  },
  {
    value: "accent",
    label: "Accent",
    hint: "Solid actions take the accent hue — DESIGN.md §2.1 Strategy B",
  },
]

const CONTROL_LABELS: Record<ControlStyle, string> = {
  flat: "Flat",
  raised: "Raised",
  ink: "Ink",
}

const CONTROL_ITEMS: readonly SegmentedItem<ControlStyle>[] = CONTROL_STYLES.map(
  (value) => ({ value, label: CONTROL_LABELS[value] })
)

const FLAT_LABELS: Record<FlatVariant, string> = {
  tinted: "Tinted",
  solid: "Solid",
  outline: "Outline",
}

const FLAT_HINTS: Record<FlatVariant, string> = {
  tinted: "Pale accent fill — DESIGN.md §14.2's accent badge",
  solid: "The same fill the primary uses, at full strength",
  outline: "No fill — §7.2's secondary button in the brand hue",
}

const FLAT_ITEMS: readonly SegmentedItem<FlatVariant>[] = FLAT_VARIANTS.map(
  (value) => ({ value, label: FLAT_LABELS[value], hint: FLAT_HINTS[value] })
)

export function AppearanceSection() {
  const { theme, resolved, setTheme } = useTheme()
  const { accent, primary, setAccent, setPrimary } = useBrand()
  const { style, setStyle } = useControlStyle()
  const { variant, setVariant } = useFlatVariant()
  const surface = useControlSurface()

  const accentLabel = ACCENTS.find((a) => a.value === accent)?.label ?? "Violet"

  return (
    <SettingsSection
      id="appearance"
      icon={Palette}
      title="Appearance"
      description="How Bajat looks on this device. These preferences are stored in this browser only — they do not follow your account."
    >
      <SettingsRow
        label="Theme"
        description={
          theme === "system"
            ? `Following your system setting, which is currently ${resolved}.`
            : `Always ${theme}, regardless of your system setting.`
        }
        control={
          <Segmented
            label="Theme"
            value={theme}
            onValueChange={setTheme}
            items={THEME_ITEMS}
          />
        }
      />

      <SettingsRow
        label="Accent color"
        description={`${accentLabel}. Used for focus rings, selected rows, links and checks — status and chart colors are unaffected.`}
        control={
          <SwatchPicker
            label="Accent color"
            value={accent}
            onValueChange={setAccent}
            items={ACCENTS}
          />
        }
      />

      <SettingsRow
        label="Primary buttons"
        description={
          primary === "neutral"
            ? "Neutral — solid actions stay black on light and white on dark."
            : `Accent — solid actions take the ${accentLabel.toLowerCase()} hue.`
        }
        control={
          <Segmented
            label="Primary buttons"
            value={primary}
            onValueChange={setPrimary}
            items={PRIMARY_ITEMS}
          />
        }
      />

      <SettingsRow
        label="Control style"
        description="Experimental — the surface treatment shared by the active sidebar item and the toolbar's filter buttons."
        control={
          <Segmented
            label="Control style"
            value={style}
            onValueChange={setStyle}
            items={CONTROL_ITEMS}
          />
        }
      />

      {/* Only `flat` has a form to choose; the tone styles are one material
          each, so the row would be inert under them. */}
      {style === "flat" && (
        <SettingsRow
          label="Flat style"
          description={`${FLAT_HINTS[variant]}.`}
          control={
            <Segmented
              label="Flat style"
              value={variant}
              onValueChange={setVariant}
              items={FLAT_ITEMS}
            />
          }
        />
      )}

      <SettingsBlock>
        <AppearancePreview surface={surface} />
      </SettingsBlock>
    </SettingsSection>
  )
}

/* ------------------------------------------------------------------ *
 * Preview
 * ------------------------------------------------------------------ */

/**
 * Every token these rows move, on the two grounds it has to survive: the
 * sidebar's grey rail and the content panel's white.
 *
 * Judging a treatment on one ground was the failure the control-style
 * experiment existed to avoid (see control-style.tsx), and the sidebar cycler
 * could only ever show the rail half. The accent is worth showing for the
 * opposite reason — it lands almost entirely in states you cannot see at rest
 * (focus, selection), so a still of them is the only way to compare hues
 * without hunting for a focused field.
 */
function AppearancePreview({ surface }: { surface: ControlSurface }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">
        Preview
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
        {/* On the sidebar's grey rail */}
        <div className="rounded-md bg-sidebar p-2 ring-1 ring-border">
          <div className="flex flex-col gap-0.5">
            <PreviewNavItem />
            <PreviewNavItem active className={surface.face} />
            <PreviewNavItem />
          </div>
        </div>

        {/* On the content panel's white ground */}
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface p-2 ring-1 ring-border">
          {/* Primary action — the tone, so it moves with *both* the accent
              choice (§2.1) and the control style (§7.4) */}
          <span
            className={cn(
              "inline-flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium",
              surface.solid
            )}
          >
            Create
          </span>

          {/* Toolbar control — flips between flat / raised / ink */}
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium",
              surface.face
            )}
          >
            Status
            <span className={cn("text-[11px]", surface.muted)}>2</span>
          </span>

          {/* Selected — accent-soft fill inside an accent border (§14.2) */}
          <span className="inline-flex h-8 items-center rounded-md border border-accent-border bg-accent-soft px-2.5 text-[13px] font-medium text-accent-violet">
            Selected
          </span>

          {/* Focused — accent border plus a 3px accent-alpha ring (§10.1) */}
          <span className="inline-flex h-8 items-center rounded-md border border-accent-violet px-2.5 text-[13px] text-text ring-3 ring-ring/45">
            Focused
          </span>
        </div>
      </div>
    </div>
  )
}

function PreviewNavItem({
  active,
  className,
}: {
  active?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-nav-item items-center gap-2.5 rounded-md px-2.5",
        className
      )}
    >
      <span
        className={cn(
          "size-3.5 shrink-0 rounded-[3px]",
          active ? "bg-current opacity-70" : "bg-text-muted/35"
        )}
      />
      <span
        className={cn(
          "h-1.5 rounded-full",
          active ? "w-16 bg-current opacity-60" : "w-12 bg-text-muted/30"
        )}
      />
    </span>
  )
}
