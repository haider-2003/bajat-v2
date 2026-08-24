"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Colour picker — a row of tone tiles.
 *
 * Not documented in DESIGN.md (nothing in the references picks a colour), so
 * it is assembled from rules that are: §10.7's radio semantics, §10.6's rule
 * that a selection carries a check rather than relying on colour alone, and
 * §7.4's material.
 *
 * ### Why tiles and not dots
 *
 * The first pass was flat circles, which is what every colour picker looks
 * like and told you nothing: a hue reads completely differently as a 20px dot
 * than as the face of a button. Each tile is now painted with that hue's real
 * §7.4 tone — the same three gradient stops, rim and label colour a solid
 * control will be made of — at the same 8px control radius. So the picker is a
 * row of miniature buttons, and choosing one is choosing what you already saw.
 *
 * A tile supplies its own tone through four local properties, which is §7.4's
 * contract ("a tone restates only these values") applied per swatch. The check
 * is §7.4's #F7F7F8 label, legible on every tone by construction — the tones
 * are chosen so white clears AA on all three of their stops. The selected ring
 * uses `currentColor`, which is the *accent* hue rather than the darker tone,
 * so the halo shows the colour the rest of the UI will use.
 *
 * Built on Base UI's `RadioGroup`, so the row is one tab stop with arrow-key
 * movement between swatches rather than seven separate stops.
 */

export type SwatchItem<T extends string> = {
  value: T
  label: string
  /** The hue as a `text-` utility — used for the selected ring. */
  tone: string
  /** `--sw-top/mid/bot` for this hue's §7.4 tone. */
  tile: string
}

export function SwatchPicker<T extends string>({
  value,
  onValueChange,
  items,
  label,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  items: readonly SwatchItem<T>[]
  /** Accessible name for the group — there is no visible <label>. */
  label: string
  className?: string
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {items.map((item) => (
        <Radio.Root
          key={item.value}
          value={item.value}
          aria-label={item.label}
          title={item.label}
          className={cn(
            // 8px radius and a 28px box — the control geometry from §7.1, so
            // the tile is the size and shape of a small icon button.
            "group/swatch grid size-7 shrink-0 place-items-center rounded-md",
            "bg-[linear-gradient(180deg,var(--sw-top)_0%,var(--sw-mid)_52%,var(--sw-bot)_100%)]",
            // Top highlight and a contact shadow — §7.4's layers minus the
            // lift, which would make seven of them read as a busy row, and
            // minus the rim, which the buttons themselves no longer draw.
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(12,12,16,0.20)]",
            "transition-[box-shadow,transform] duration-120",
            "hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_6px_-1px_rgba(12,12,16,0.28)]",
            "active:translate-y-0",
            // Selected and focused both ring in the hue, offset off the card.
            "outline-none ring-offset-surface",
            "data-checked:ring-2 data-checked:ring-current data-checked:ring-offset-2",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            item.tone,
            item.tile
          )}
        >
          <Check
            aria-hidden
            className="size-3.5 text-[#f7f7f8] opacity-0 transition-opacity duration-120 group-data-checked/swatch:opacity-100"
            strokeWidth={2.5}
          />
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
