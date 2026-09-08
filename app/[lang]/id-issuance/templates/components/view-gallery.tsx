"use client"

import * as React from "react"
import type { Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import { SoftBadge } from "@/components/ui/data-bits"
import { Skeleton } from "@/components/ui/skeleton"
import {
  templateIssued,
  templatePrice,
  templateStatus,
  templateValidity,
} from "@/features/templates/display"
import type { Template } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import type { Features } from "@/lib/table-features"
import { cn } from "@/lib/utils"
import { EMPTY_VALUE, formatText } from "@/utils/format"

import { TemplateFace } from "./template-face"
import {
  TemplateActionRow,
  type TemplateActionHandlers,
} from "./template-actions"

/**
 * Gallery — DESIGN.md §9, and the **default** view for this screen.
 *
 * Every other list here opens as a table, because every other list is made of
 * records. A template is a *picture*: nobody recognises "Staff Card 2026" by
 * its title, they recognise it by the blue band across the top.
 *
 * ### The artwork is staged, not framed
 *
 * The face sits on a sunken stage that runs to the tile's edges, and it is the
 * one element on this screen with a real shadow. That is not a violation of
 * §1.5 — the *tile* obeys it exactly (border only at rest, §9.6's border-strong
 * and `--shadow-md` on hover). The shadow belongs to the thing in the picture:
 * a card is a physical object 0.76mm thick, and drawing it lying on a surface
 * is what makes a grid of them read as designs rather than as thumbnails.
 *
 * Two-sided templates say so by showing the back peeking out from behind the
 * front, fanning a little further on hover. It replaces the "2 sides" label
 * that used to sit over the artwork: the stack *is* the label, and it does not
 * cover the design to say so.
 *
 * A disabled template is drawn desaturated. Retired artwork should look
 * retired — the badge names the state, the grey is what makes it visible from
 * across a grid of twelve.
 *
 * ### Three zones, two seams
 *
 * Stage, content, actions — and a full-bleed hairline between each. §9.4 asks
 * for exactly this: a card footer is a `--color-border-subtle` top rule with a
 * right-aligned button pair under it. An earlier pass had no footer rule at
 * all, and the pair floated in the tile's bottom corner with nothing holding
 * it. Two rules delimit; four would band the tile like a receipt, which is why
 * the terms line sits in the content zone rather than getting a rule of its
 * own.
 *
 * It is also the responsive fallback: below `lg` the table collapses to this
 * rather than squeezing nine columns (§8.12).
 */
export function GalleryView({
  table,
  handlers,
}: {
  table: TanTable<Features, Template>
  handlers: TemplateActionHandlers
}) {
  const t = useT()
  const templates = table.getRowModel().rows.map((row) => row.original)

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16">
        <EmptyState title={t("templates.emptyTitle")} />
      </div>
    )
  }

  return (
    // Auto-fill reflows without media queries (§18.5). 16px gap (§9.1).
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} handlers={handlers} />
      ))}
    </div>
  )
}

function TemplateCard({
  template,
  handlers,
}: {
  template: Template
  handlers: TemplateActionHandlers
}) {
  const t = useT()
  const status = templateStatus(t, template)

  /**
   * The description, unless it is just the title again.
   *
   * Templates are named and described by hand, and a good number end up with
   * the same string in both. Printing it twice makes the tile look like a
   * rendering bug, so the second copy is dropped and the tile is simply
   * shorter — the grid stretches every tile in a row to the tallest anyway,
   * and the footer is pinned to the bottom, so nothing goes out of alignment.
   */
  const raw = template.description?.trim() ?? ""
  const description =
    raw && raw.toLowerCase() !== template.title?.trim().toLowerCase()
      ? raw
      : ""

  /**
   * The terms, as one line. Built from the parts that have a value — a card
   * whose price never loaded should read "1,204 issued · 12 months", not
   * "1,204 issued · — · 12 months".
   */
  const meta = [
    template.identitiesCount === undefined
      ? null
      : t("templates.issuedCount", {
          count: templateIssued(template.identitiesCount),
        }),
    templatePrice(t, template.price),
    templateValidity(t, template.identityDuration),
    template.branchRequired ? t("templates.branchRequired") : null,
  ].filter((part): part is string => !!part && part !== EMPTY_VALUE)

  return (
    // §9.1 / §9.6: 12px radius, 1px border, no resting shadow; the border firms
    // and a soft shadow arrives on hover. No lift.
    <article
      className={cn(
        "group/template flex flex-col overflow-hidden rounded-xl border border-border bg-surface",
        "transition-[border-color,box-shadow,background-color] duration-120",
        "hover:border-border-strong hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        "dark:hover:bg-[rgba(255,255,255,0.02)] dark:hover:shadow-none"
      )}
    >
      {/* The stage. Runs to the tile's edges and carries the seam under it. */}
      <div className="relative border-b border-border bg-surface-sunken px-6 pt-6 pb-7">
        {/* The artwork and everything layered on it. Three stacked planes in
            one box: the faces, an invisible full-bleed button that previews
            them, and the overlay actions on top. */}
        <div className="relative">
          <BackPeek src={template.backImage} disabled={!status.enabled} />

          <TemplateFace
            src={template.frontImage}
            alt=""
            className={cn(
              "relative rounded-md bg-surface",
              // The card's own shadow, not the tile's — see the note above.
              "shadow-[0_10px_24px_-8px_rgba(0,0,0,0.28),0_2px_6px_-2px_rgba(0,0,0,0.12)]",
              "dark:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.7)]",
              // The face used to grow 3% on hover. It doesn't any more: the
              // overlay is now what happens on hover, and a face swelling out
              // from under a scrim pinned to its resting box left the wash
              // inset by a few pixels on every edge. The stack fanning (see
              // `BackPeek`) carries the movement instead.
              !status.enabled && "opacity-60 grayscale"
            )}
          />

          {/* The picture of the thing is what everyone reaches for first, so
              it is a control too — a sibling of the faces rather than a parent,
              so it can cover both without nesting a button inside a button.
              The `Preview` button below is the same action with a name on it,
              for the keyboard and for anyone who does not think to click a
              picture. */}
          <button
            type="button"
            onClick={() => handlers.onPreview(template)}
            aria-label={t("templates.previewLabel", { title: template.title })}
            className="absolute inset-0 z-10 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface-sunken"
          />
        </div>

        {/* Only the exception is labelled. An enabled template is the norm and
            needs no sticker over its own design. */}
        {!status.enabled && (
          <div className="pointer-events-none absolute end-3 top-3">
            <SoftBadge tone="neutral" className="border border-border bg-surface">
              Disabled
            </SoftBadge>
          </div>
        )}
      </div>

      {/* Body — 20px padding (§9.1). Pure information: every verb this tile
          has now lives on the artwork above. */}
      <div className="flex flex-1 flex-col p-5">
        <h3
          title={template.title}
          className="truncate text-sm font-medium tracking-[-0.01em] text-text"
        >
          {formatText(template.title)}
        </h3>

        {/* Clamped rather than truncated: a description is a sentence, and one
            line of it usually stops mid-clause. Two lines is enough to tell two
            similar cards apart, which is all it is here for. */}
        {description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-text-muted">
            {description}
          </p>
        )}

        {/* The terms, at `text-muted` rather than `text-placeholder`: these are
            the numbers somebody came to the tile for, and placeholder grey is
            the tone this system reserves for absent values.

            `mt-auto` pushes it and the row beneath it to the tile's bottom
            edge — the grid stretches every tile in a row to the tallest, so
            without it a short tile leaves both floating in the middle. */}
        <p className="mt-auto truncate pt-2.5 text-xs tabular-nums text-text-muted">
          {meta.length > 0 ? meta.join(" · ") : t("templates.noTerms")}
        </p>

        {/* Always visible, never a hover reveal: below `lg` this view *is* the
            mobile layout, and a control that only exists under a pointer does
            not exist on a phone. */}
        <TemplateActionRow
          template={template}
          handlers={handlers}
          className="mt-3.5"
        />
      </div>
    </article>
  )
}

/**
 * The back face, peeking out from behind the front.
 *
 * A plain image rather than a `TemplateFace`: this one has no fallback state.
 * An expired link behind the front card would put a broken-image glyph in the
 * middle of the stack, which says "something is wrong" about a template where
 * nothing is — so a failure hides the peek and the card simply looks
 * one-sided until the artwork is refreshed.
 *
 * Absolutely positioned so it takes no space: the front face defines the
 * stage's height on its own, and the fan grows on hover without reflowing the
 * tile beneath it.
 */
function BackPeek({
  src,
  disabled,
}: {
  src: string | null | undefined
  disabled: boolean
}) {
  const [brokenSrc, setBrokenSrc] = React.useState<string | null>(null)
  if (!src || brokenSrc === src) return null

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        // The resting offset is layout, not motion — it survives a reduced-
        // motion preference, because without it there is no stack to see. Only
        // the fan on hover is gated.
        "-translate-x-2 -translate-y-1.5 -rotate-[4deg] scale-[0.97]",
        "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
        "motion-safe:group-hover/template:-translate-x-3.5",
        "motion-safe:group-hover/template:-rotate-[7deg]"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={() => setBrokenSrc(src)}
        className={cn(
          "size-full rounded-md bg-surface object-contain opacity-90",
          "shadow-[0_8px_18px_-8px_rgba(0,0,0,0.24)] dark:shadow-none",
          disabled && "opacity-50 grayscale"
        )}
      />
    </span>
  )
}

/**
 * The gallery's own waiting state — the grid's shape, greyed out (§8.11).
 *
 * Local rather than in `components/table/load-states.tsx`: that module's two
 * states are the table's, and the thing being waited for here is a grid of
 * staged CR-80 faces, which no other screen has.
 */
export function LoadingGallery({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-surface"
        >
          <div className="border-b border-border bg-surface-sunken px-6 pt-6 pb-7">
            <Skeleton className="aspect-[85.6/54] w-full rounded-md" />
          </div>
          <div className="p-5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="mt-2.5 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
            <Skeleton className="mt-4 h-3 w-1/2" />
            <div className="mt-3.5 flex flex-col gap-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="size-9 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
