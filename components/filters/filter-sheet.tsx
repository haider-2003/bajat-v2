"use client"

import * as React from "react"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { FilterButton } from "./filter-button"

/**
 * Every filter on a list screen, behind one button — DESIGN.md §18.3.
 *
 * §18.3 is unambiguous: below 1024px "the toolbar's controls collapse into one
 * icon button that opens a sheet". A toolbar that only wraps instead is what
 * the reference screenshot showed — five controls at five different widths
 * breaking across three ragged lines, two of them reduced to unlabelled dark
 * squares, and a date chip stranded on a row of its own.
 *
 * ### It holds the controls, not the state
 *
 * The screen still owns every filter value, and the same control components go
 * inside here as sit in the desktop toolbar — passed in as children, sized
 * full-width by the caller. So there is no second copy of the filter logic to
 * keep in step, and a filter added to one layout cannot go missing from the
 * other.
 *
 * ### Nothing to apply
 *
 * Filters take effect as they are set, exactly as they do in the toolbar, so
 * this sheet has no Apply button and no draft state — closing it is not a
 * commit. That is also why `Done` is a quiet secondary (§13.5): the dialog
 * performs no consequential action, so it gets no solid anchor.
 */
export function FilterSheet({
  count,
  onClear,
  className,
  children,
}: {
  /** How many filters are set — shown on the trigger, and gates `Clear all`. */
  count: number
  onClear: () => void
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <FilterButton
            icon={SlidersHorizontal}
            label="Filters"
            // §6.6's two-tone label doing real work: the attribute stays muted
            // and the count reads at full contrast, so a glance at a collapsed
            // toolbar still says whether anything is filtering the list.
            value={count > 0 ? String(count) : undefined}
            className={className}
          />
        }
      />

      <DialogContent size="sm">
        <DialogCloseButton />

        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {/* §4.5's field-to-field gap — these read as one form. */}
          <div className="flex flex-col gap-3">{children}</div>
        </DialogBody>

        {/* Not `DialogFooter`: with no commit to make, the only actions are
            dismissal and reset, and the stacked full-width pair that footer
            builds would give a filter sheet the weight of a save dialog. */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {count > 0 && (
            <Button
              variant="ghost"
              type="button"
              className="h-11 md:h-9"
              onClick={onClear}
            >
              Clear all
            </Button>
          )}
          <DialogClose
            render={
              <Button
                variant="outline"
                type="button"
                className="ms-auto h-11 md:h-9"
              >
                Done
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The width every control takes inside the sheet: one full-width stack. */
export const SHEET_CONTROL = "h-11 w-full justify-start"
