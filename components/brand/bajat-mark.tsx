import { cn } from "@/lib/utils"

/**
 * The Bajat mark — two layered credentials.
 *
 * A front card drawn whole, with the card behind it drawn *only where it
 * clears the front*. Nothing overlaps, which is what keeps the glyph readable
 * at 20px: two full outlines crossing each other stop reading as two objects
 * and collapse into a lattice at sidebar size.
 *
 * Abstract on purpose. An earlier attempt drew a smart-card contact chip —
 * a literal illustration of an object, which reads as an icon lifted from a
 * set rather than as a brand. This one describes what the product *does*
 * (identity, issued and stacked) without depicting a card's contents.
 *
 * ## Light and dark
 *
 * The mark is monochrome and painted in `currentColor`, so it inherits the
 * text colour of whatever it sits in and needs no variant of its own:
 *
 *   - `text-text`  — the app. Resolves to #171717 on light, #EDEDED on dark,
 *                    so the mark flips with the theme automatically.
 *   - `text-white` — the login brand panel, which is dark in both themes.
 *   - `text-text dark:text-white` — the splash, whose ground is the page grey
 *                    on light and the panel's blue-black on dark.
 *
 * This is the reason the old violet→pink gradient tile had to go: a fixed
 * two-colour fill cannot respond to the theme at all. It sat at the same
 * lightness on a white page and a near-black one, so it read as a decorative
 * sticker beside the brand rather than as the brand.
 *
 * Stroke weight is tuned for 20–24px. Below ~16px, step `strokeWidth` up to
 * about 2 rather than scaling the glyph down as-is.
 */
export function BajatMark({
  className,
  title,
}: {
  className?: string
  /** Supply only where the mark is the sole label; otherwise it stays decorative. */
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-6 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* Back card — only the run that clears the front card, so the two
          outlines never cross. Start at the seam, up and over, back down. */}
      <path d="M7 9V6.5A2.5 2.5 0 0 1 9.5 4h8A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H17" />
      {/* Front card */}
      <rect x="3" y="9" width="14" height="10" rx="2.5" />
    </svg>
  )
}
