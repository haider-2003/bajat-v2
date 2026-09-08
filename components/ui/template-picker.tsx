"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { Check } from "lucide-react"

import type { TemplateDef, TemplatePreview } from "@/components/layout/brand"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * Template picker — a row of miniature apps.
 *
 * Same reasoning as `SwatchPicker`: a palette reads completely differently as
 * a row of dots than as a screen. A template moves the page, the rail, the
 * surfaces, the borders and the button all at once, and the only way to judge
 * that is to see them in the relationship they will actually be in. So each
 * card is a 3-second sketch of the app — rail on the left, a card and a button
 * on the page — painted with that template's real values.
 *
 * The preview is drawn from literal hex in the template definition rather than
 * from tokens, because every card has to show a *different* palette than the
 * one currently applied. Tokens would paint all of them the same.
 *
 * The card follows whichever theme is painted, so `preview` is chosen by the
 * caller from `resolved` rather than by a `dark:` variant.
 *
 * Built on Base UI's `RadioGroup`: one tab stop, arrow keys between cards
 * (§10.7), and the selection carries a check rather than relying on colour
 * alone (§10.6).
 */

export function TemplatePicker<T extends string>({
  value,
  onValueChange,
  items,
  theme,
  label,
  className,
}: {
  /** The active template, or `null` when the settings are hand-mixed. */
  value: T | null
  onValueChange: (value: T) => void
  items: readonly TemplateDef[]
  /** Which half of each template's preview to paint. */
  theme: "light" | "dark"
  /** Accessible name for the group — there is no visible <label>. */
  label: string
  className?: string
}) {
  const t = useT()

  return (
    <RadioGroup
      // Base UI treats `null` as "nothing selected", which is exactly the
      // hand-mixed state: no card claims to be active until one matches.
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {items.map((item) => (
        <Radio.Root
          key={item.value}
          value={item.value}
          className={cn(
            // §9.1's card geometry at row scale — 12px radius, hairline.
            "group/tpl cursor-pointer rounded-lg border border-border bg-surface p-2 text-start",
            "transition-[border-color,box-shadow] duration-120",
            "hover:border-border-strong",
            "outline-none",
            // Selected and focused both ring in the accent (§10.1).
            "data-checked:border-accent-violet data-checked:ring-2 data-checked:ring-ring",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
          )}
        >
          <TemplateThumb preview={item.preview[theme]} />

          <div className="mt-2 flex items-start gap-1.5 px-0.5 pb-0.5">
            <div className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-text">
                {t(item.labelKey)}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
                {t(item.descriptionKey)}
              </span>
            </div>
            {/* Reserves its own width, so checking a card never reflows the
                label beside it. */}
            <span
              aria-hidden
              className={cn(
                "mt-px grid size-4 shrink-0 place-items-center rounded-full",
                "bg-accent-violet text-white opacity-0 transition-opacity duration-120",
                "group-data-checked/tpl:opacity-100"
              )}
            >
              <Check className="size-2.5" strokeWidth={3} />
            </span>
          </div>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}

/**
 * The sketch: page ground, sidebar rail, one card, one button.
 *
 * Everything is a plain div with an inline background — no tokens, no
 * utilities that resolve to tokens — so a card can show a palette that is not
 * the one currently applied. Text is stood in for by bars at fixed opacities
 * of the template's ink, which is enough to show whether a ramp reads at all
 * without rendering unreadable 4px type.
 */
function TemplateThumb({ preview }: { preview: TemplatePreview }) {
  return (
    <div
      aria-hidden
      className="flex h-[74px] overflow-hidden rounded-md"
      style={{ background: preview.page, boxShadow: `inset 0 0 0 1px ${preview.line}` }}
    >
      {/* Sidebar rail. The seam is on its inner edge, which swaps sides with
          the reading direction — the rail itself is laid out by flex order. */}
      <div
        className="flex w-[26px] shrink-0 flex-col gap-1 p-1.5"
        style={{
          background: preview.rail,
          borderInlineEnd: `1px solid ${preview.line}`,
        }}
      >
        <Bar ink={preview.ink} w="100%" o={0.5} />
        <Bar ink={preview.ink} w="72%" o={0.22} />
        <Bar ink={preview.ink} w="86%" o={0.22} />
      </div>

      {/* Content panel */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
        <div
          className="flex flex-1 flex-col gap-1 rounded-[3px] p-1.5"
          style={{ background: preview.surface, boxShadow: `inset 0 0 0 1px ${preview.line}` }}
        >
          <Bar ink={preview.ink} w="60%" o={0.75} />
          <Bar ink={preview.ink} w="90%" o={0.25} />
          <Bar ink={preview.ink} w="78%" o={0.25} />
        </div>
        {/* The primary button — the one element that shows the strategy. */}
        <span
          className="h-[9px] w-[34px] shrink-0 rounded-[3px]"
          style={{ background: preview.button }}
        />
      </div>
    </div>
  )
}

function Bar({ ink, w, o }: { ink: string; w: string; o: number }) {
  return (
    <span
      className="block h-[3px] shrink-0 rounded-full"
      style={{ background: ink, width: w, opacity: o }}
    />
  )
}
