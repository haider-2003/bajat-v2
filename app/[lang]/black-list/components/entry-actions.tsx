"use client"

import { Trash2 } from "lucide-react"

import { RowActions } from "@/components/table/row-actions"
import type { BlackList } from "@/features/black-list/types"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * What can be done to one entry: remove it. That is the whole vocabulary.
 *
 * ### One verb, so no menu
 *
 * Every other list screen puts three or four verbs behind an overflow menu. A
 * menu holding a single item is a click added in front of a button — §15.5's
 * rule that a control must earn its indirection. So `RowActions` is given a
 * primary and no `items`, and renders as a single segment.
 *
 * It is still `RowActions` rather than a hand-rolled button, which is what
 * this used to be. The verb is unique to this screen; the *control* should not
 * be, and a second implementation of the same 28px bordered box is a second
 * place for its radius, seam and focus ring to drift from everyone else's.
 *
 * ### It is not a red button
 *
 * §7.2's destructive fill is a tinted red box, and a table of thirty rows each
 * carrying one is a wall of red where nothing reads as urgent any more. The
 * `danger` tone turns the segment red only under the cursor; the red button
 * lives in the confirmation, where there is exactly one of it and it is the
 * click that actually does the thing.
 *
 * ### The screen owns the dialog
 *
 * `onRemove` is passed in rather than owned here: the confirmation is mounted
 * once by the client, not once per row. Thirty rows each holding a mounted
 * `Dialog` is thirty portals waiting to be opened.
 */
export function RemoveEntryButton({
  entry,
  onRemove,
  /** Cards give it the full width of the footer; table rows keep it compact. */
  full = false,
  className,
}: {
  entry: BlackList
  onRemove: (entry: BlackList) => void
  full?: boolean
  className?: string
}) {
  const t = useT()

  return (
    <RowActions
      label={entry.name}
      primary={{
        label: t("common.remove"),
        icon: Trash2,
        tone: "danger",
        onSelect: () => onRemove(entry),
      }}
      className={cn(full && "w-full justify-center", className)}
    />
  )
}
