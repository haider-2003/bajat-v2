"use client"

import * as React from "react"
import { Monitor, Moon, Palette, RotateCcw, SunMedium } from "lucide-react"

import {
  SettingsBlock,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { Segmented, type SegmentedItem } from "@/components/ui/segmented"
import { SwatchPicker } from "@/components/ui/swatch-picker"
import { TemplatePicker } from "@/components/ui/template-picker"
import {
  CONTROL_STYLES,
  DEFAULT_FLAT,
  DEFAULT_STYLE,
  FLAT_VARIANTS,
  useControlStyle,
  useControlSurface,
  useFlatVariant,
  type ControlStyle,
  type ControlSurface,
  type FlatVariant,
} from "@/components/ui/control-style"
import {
  ACCENTS,
  DEFAULT_TEMPLATE,
  TEMPLATES,
  matchTemplate,
  useBrand,
  type PrimaryStyle,
  type Template,
} from "@/components/layout/brand"
import { useTheme, type Theme } from "@/components/layout/theme-provider"
import { useT } from "@/i18n/context"
import type { TranslationKey, Translator } from "@/i18n/translate"
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

/**
 * The option tables hold **keys**, and the arrays `Segmented` renders are built
 * inside the component from a translator.
 *
 * They used to be module constants holding finished strings, which is the one
 * shape that cannot survive a second language: a module is evaluated once per
 * process, and its strings would freeze to whichever locale happened to render
 * first. Keys are locale-free, so the tables stay static and only the mapping
 * moves into the render.
 */
const THEME_KEYS: readonly { value: Theme; label: TranslationKey; icon: typeof SunMedium }[] = [
  { value: "light", label: "settings.appearance.theme.light", icon: SunMedium },
  { value: "dark", label: "settings.appearance.theme.dark", icon: Moon },
  { value: "system", label: "settings.appearance.theme.system", icon: Monitor },
]

const PRIMARY_KEYS: readonly {
  value: PrimaryStyle
  label: TranslationKey
  hint: TranslationKey
}[] = [
  {
    value: "neutral",
    label: "settings.appearance.primary.neutral",
    hint: "settings.appearance.primary.neutralHint",
  },
  {
    value: "accent",
    label: "settings.appearance.primary.accent",
    hint: "settings.appearance.primary.accentHint",
  },
]

const CONTROL_LABEL_KEYS: Record<ControlStyle, TranslationKey> = {
  flat: "settings.appearance.control.flat",
  raised: "settings.appearance.control.raised",
  ink: "settings.appearance.control.ink",
}

const FLAT_LABEL_KEYS: Record<FlatVariant, TranslationKey> = {
  tinted: "settings.appearance.flat.tinted",
  solid: "settings.appearance.flat.solid",
  outline: "settings.appearance.flat.outline",
}

const FLAT_HINT_KEYS: Record<FlatVariant, TranslationKey> = {
  tinted: "settings.appearance.flat.tintedHint",
  solid: "settings.appearance.flat.solidHint",
  outline: "settings.appearance.flat.outlineHint",
}

/** The accent swatches carry a hue name each, keyed the same way. */
const ACCENT_LABEL_KEYS: Record<string, TranslationKey> = {
  violet: "settings.appearance.accents.violet",
  indigo: "settings.appearance.accents.indigo",
  blue: "settings.appearance.accents.blue",
  cyan: "settings.appearance.accents.cyan",
  green: "settings.appearance.accents.green",
  orange: "settings.appearance.accents.orange",
  clay: "settings.appearance.accents.clay",
  pink: "settings.appearance.accents.pink",
}

function accentLabel(t: Translator, value: string): string {
  const key = ACCENT_LABEL_KEYS[value]
  return key ? t(key) : value
}

export function AppearanceSection() {
  const t = useT()
  const { theme, resolved, setTheme } = useTheme()
  const { accent, primary, template, setAccent, setPrimary, applyTemplate } =
    useBrand()
  const { style, setStyle } = useControlStyle()
  const { variant, setVariant } = useFlatVariant()
  const surface = useControlSurface()

  const THEME_ITEMS: SegmentedItem<Theme>[] = THEME_KEYS.map((item) => ({
    value: item.value,
    label: t(item.label),
    icon: item.icon,
  }))

  const PRIMARY_ITEMS: SegmentedItem<PrimaryStyle>[] = PRIMARY_KEYS.map((item) => ({
    value: item.value,
    label: t(item.label),
    hint: t(item.hint),
  }))

  const CONTROL_ITEMS: SegmentedItem<ControlStyle>[] = CONTROL_STYLES.map(
    (value) => ({ value, label: t(CONTROL_LABEL_KEYS[value]) })
  )

  const FLAT_ITEMS: SegmentedItem<FlatVariant>[] = FLAT_VARIANTS.map((value) => ({
    value,
    label: t(FLAT_LABEL_KEYS[value]),
    hint: t(FLAT_HINT_KEYS[value]),
  }))

  // The swatch list is built from the palette, whose `label` is the English
  // hue name; the translated name is looked up by the stable `value`.
  const ACCENT_ITEMS = ACCENTS.map((item) => ({
    ...item,
    label: accentLabel(t, item.value),
  }))

  const activeAccentLabel = accentLabel(t, accent)

  /**
   * Derived, never stored: a template stops being "active" the moment one of
   * the rows below is changed by hand, so no card can claim a look the app is
   * no longer wearing.
   */
  const activeTemplate = matchTemplate(template, accent, primary)

  /** Everything the reset touches, already at its shipped value. */
  const isDefault =
    activeTemplate === DEFAULT_TEMPLATE &&
    style === DEFAULT_STYLE &&
    variant === DEFAULT_FLAT

  const reset = React.useCallback(() => {
    applyTemplate(DEFAULT_TEMPLATE)
    setStyle(DEFAULT_STYLE)
    setVariant(DEFAULT_FLAT)
  }, [applyTemplate, setStyle, setVariant])

  return (
    <SettingsSection
      id="appearance"
      icon={Palette}
      title={t("settings.appearance.title")}
      description={t("settings.appearance.description")}
    >
      {/* A full-width block rather than a row: the cards are the control, and
          they need the whole width to read as screens rather than chips. */}
      <SettingsBlock>
        <div className="mb-3">
          <span className="block text-[13px] font-medium text-text">
            {t("settings.appearance.template")}
          </span>
          <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
            {activeTemplate
              ? t("settings.appearance.templateHint")
              : t("settings.appearance.templateCustomHint")}
          </p>
        </div>
        <TemplatePicker
          label={t("settings.appearance.template")}
          value={activeTemplate}
          onValueChange={(next: Template) => applyTemplate(next)}
          items={TEMPLATES}
          theme={resolved}
        />
      </SettingsBlock>

      <SettingsRow
        label={t("settings.appearance.themeLabel")}
        description={
          theme === "system"
            ? t("settings.appearance.themeSystemHint", {
                resolved: t(
                  resolved === "dark"
                    ? "settings.appearance.theme.dark"
                    : "settings.appearance.theme.light"
                ).toLocaleLowerCase(),
              })
            : t("settings.appearance.themeFixedHint", {
                theme: t(
                  theme === "dark"
                    ? "settings.appearance.theme.dark"
                    : "settings.appearance.theme.light"
                ).toLocaleLowerCase(),
              })
        }
        control={
          <Segmented
            label={t("settings.appearance.themeLabel")}
            value={theme}
            onValueChange={setTheme}
            items={THEME_ITEMS}
          />
        }
      />

      <SettingsRow
        label={t("settings.appearance.accentLabel")}
        description={t("settings.appearance.accentHint", {
          accent: activeAccentLabel,
        })}
        control={
          <SwatchPicker
            label={t("settings.appearance.accentLabel")}
            value={accent}
            onValueChange={setAccent}
            items={ACCENT_ITEMS}
          />
        }
      />

      <SettingsRow
        label={t("settings.appearance.primaryLabel")}
        description={
          primary === "neutral"
            ? t("settings.appearance.primaryNeutralHint")
            : t("settings.appearance.primaryAccentHint", {
                accent: activeAccentLabel.toLocaleLowerCase(),
              })
        }
        control={
          <Segmented
            label={t("settings.appearance.primaryLabel")}
            value={primary}
            onValueChange={setPrimary}
            items={PRIMARY_ITEMS}
          />
        }
      />

      <SettingsRow
        label={t("settings.appearance.controlLabel")}
        description={t("settings.appearance.controlHint")}
        control={
          <Segmented
            label={t("settings.appearance.controlLabel")}
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
          label={t("settings.appearance.flatLabel")}
          description={t(FLAT_HINT_KEYS[variant])}
          control={
            <Segmented
              label={t("settings.appearance.flatLabel")}
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

      {/* Last row, and the only destructive one — an escape hatch after a
          template has been tried, not something to reach for first.

          It deliberately leaves the theme alone. Light/dark is a comfort
          choice rather than a styling one, and flipping someone into light
          mode because they wanted their colours back is the kind of surprise a
          reset should not contain. */}
      <SettingsRow
        label={t("settings.appearance.resetLabel")}
        description={
          isDefault
            ? t("settings.appearance.resetDoneHint")
            : t("settings.appearance.resetHint")
        }
        control={
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            disabled={isDefault}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            {t("settings.appearance.resetAction")}
          </Button>
        }
      />
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
  const t = useT()

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">
        {t("settings.appearance.preview")}
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
            {t("common.create")}
          </span>

          {/* Toolbar control — flips between flat / raised / ink */}
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium",
              surface.face
            )}
          >
            {t("common.status")}
            <span className={cn("text-[11px]", surface.muted)}>2</span>
          </span>

          {/* Selected — accent-soft fill inside an accent border (§14.2) */}
          <span className="inline-flex h-8 items-center rounded-md border border-accent-border bg-accent-soft px-2.5 text-[13px] font-medium text-accent-violet">
            {t("settings.appearance.previewSelected")}
          </span>

          {/* Focused — accent border plus a 3px accent-alpha ring (§10.1) */}
          <span className="inline-flex h-8 items-center rounded-md border border-accent-violet px-2.5 text-[13px] text-text ring-3 ring-ring/45">
            {t("settings.appearance.previewFocused")}
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
