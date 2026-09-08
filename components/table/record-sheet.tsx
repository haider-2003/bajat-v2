"use client"

import * as React from "react"
import { flexRender, type Table as TanTable } from "@tanstack/react-table"

import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { Features } from "@/lib/table-features"
import { cn } from "@/lib/utils"

/**
 * The record view — what a row opens.
 *
 * ### Why there is one of these and not eleven
 *
 * Before this, "look at a row" was an eye button on the printer, a tinted
 * Preview tile on the templates gallery, and nothing at all on the other nine
 * screens. Three vocabularies for one verb, and eight screens where the verb
 * did not exist. Now the gesture is the same everywhere — click the row
 * (components/table/table-view.tsx) — and this is what it opens.
 *
 * What varies per screen is the *content*: which fields a record has, and what
 * to call them. That is passed in as `sections`, in exactly the way
 * `columns.tsx` is written per screen. What does not vary is the frame: the
 * title block, the field grid, the footer holding the same verbs the row's
 * action control holds.
 *
 * ### It shows the row first and the fetch second
 *
 * The caller already has the row — it was clicked — so the sheet opens with it
 * filled in, and `GET /entity/{id}` replaces it in place when it lands. The
 * alternative, a spinner over data already in hand, makes the fast path feel
 * slower than the table it opened from.
 *
 * `loading` therefore means "loading and nothing to show yet", which only
 * happens if a screen opens the sheet from an id rather than from a row.
 */

export type RecordField = {
  key: string
  label: string
  /**
   * Pre-formatted. A cell renderer from `components/table/cells.tsx` is the
   * usual thing to put here, so a value reads the same in the sheet as it does
   * in the column it came from.
   */
  value: React.ReactNode
  /** Takes the full width instead of half — for a long value or a chip row. */
  wide?: boolean
}

export type RecordSection = {
  key: string
  /** Omit on the first section: a lone heading over the top block is noise. */
  label?: string
  fields: RecordField[]
}

/* ------------------------------------------------------------------ *
 * One label/value pair
 * ------------------------------------------------------------------ */

/**
 * The label sits *above* the value rather than beside it.
 *
 * A two-column `label: value` layout has to pick a label column width, and
 * that width is wrong in the other language — Arabic and English labels for
 * the same field differ by enough that one of the two always ends up either
 * clipped or floating. Stacking sidesteps the choice, and reads faster in both.
 */
function Field({ field }: { field: RecordField }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", field.wide && "col-span-2")}>
      <span className="text-[11px] font-medium text-text-muted">
        {field.label}
      </span>
      <span className="min-w-0 text-[13px] text-text">{field.value}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The sheet
 * ------------------------------------------------------------------ */

export function RecordSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  media,
  aside,
  sections,
  loading = false,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The record's name — what the row is identified by in its first column. */
  title: React.ReactNode
  /** One quiet line under it: an email, an id, an organization. */
  subtitle?: React.ReactNode
  /** A leading visual — an avatar, a node swatch, a card thumbnail. */
  media?: React.ReactNode
  /** Sits opposite the title, for the one thing worth reading first: a status badge. */
  aside?: React.ReactNode
  sections: RecordSection[]
  /** True only when there is no row to fall back on. See the note above. */
  loading?: boolean
  /**
   * The same verbs the row's action control carries. Passed in rather than
   * derived, because the sheet is not the only place they exist and the screen
   * is what owns the dialogs behind them.
   */
  footer?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogCloseButton />

        <DialogHeader>
          <div className="flex min-w-0 items-start gap-3">
            {media && <span className="shrink-0 pt-0.5">{media}</span>}

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <DialogTitle className="truncate">{title}</DialogTitle>
              {subtitle && (
                <DialogDescription className="truncate">
                  {subtitle}
                </DialogDescription>
              )}
            </div>

            {/* Clears the close button, which is absolutely positioned 16px in. */}
            {aside && <span className="shrink-0">{aside}</span>}
          </div>
        </DialogHeader>

        <DialogBody>
          {loading ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {sections.map((section, i) => (
                <section key={section.key} className="flex flex-col gap-3">
                  {section.label && (
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] font-semibold text-text-muted">
                        {section.label}
                      </span>
                      {/* The rule runs out from the label rather than sitting
                          under the whole block, so a section reads as a
                          heading with a tail and not as another card. */}
                      <span aria-hidden className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "grid grid-cols-2 gap-x-5 gap-y-4",
                      // The first block sits directly under the title, which
                      // already has the header's 20px beneath it.
                      i > 0 && "pt-0"
                    )}
                  >
                    {section.fields.map((field) => (
                      <Field key={field.key} field={field} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </DialogBody>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * The table's own columns, as a record view
 * ------------------------------------------------------------------ */

/**
 * The record sheet, built from the columns the screen already declared.
 *
 * ### Why this is derived and not written out again
 *
 * A screen's `columns.tsx` already says, for every field the entity has, what
 * it is called (`meta.label`) and how it is drawn (`cell`). A hand-written
 * field list per screen would be a second copy of both, in twelve files, and
 * the first time someone renamed a column the sheet would quietly keep the old
 * word. Reading the column list means the sheet cannot drift from the table
 * it opened from, and a new column appears in it for free.
 *
 * ### It shows the columns the table is currently *hiding*
 *
 * `getAllCells`, not `getVisibleCells`. On a narrow viewport §8.12 drops
 * columns by priority, and on any viewport the View menu lets them be turned
 * off — which is exactly when a way to see the whole record matters. This is
 * that way. The actions column is the one thing skipped: it is controls, not
 * data, and the footer holds those verbs already.
 *
 * ### Finding the row again
 *
 * The screen holds the row it was handed (see `useRecordSheet`), but cells can
 * only be rendered from the table's own `Row`, and after a refetch that object
 * is a new one. So it is looked up by `id` each render rather than captured —
 * which also means an edit made from inside the sheet is reflected in it as
 * soon as the list refetches.
 */
export function TableRecordSheet<TRow extends { id: string | number }>({
  table,
  row,
  onOpenChange,
  title,
  subtitle,
  media,
  aside,
  footer,
}: {
  table: TanTable<Features, TRow>
  /** The clicked row, or null when the sheet is shut. */
  row: TRow | null
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  media?: React.ReactNode
  aside?: React.ReactNode
  footer?: React.ReactNode
}) {
  // Deliberately not memoized. `table` is a stable object and `row` is the
  // one that was clicked, so a memo keyed on either would keep serving the
  // row model from the moment the sheet opened — and the sheet would go on
  // showing the old values after an edit, a refetch or a sort. Re-finding is
  // a scan of one page of rows, and only while the sheet is open.
  const live = row
    ? (table.getRowModel().rows.find((r) => r.original.id === row.id) ?? null)
    : null

  const sections: RecordSection[] = live
    ? [
        {
          key: "fields",
          fields: live
            .getAllCells()
            .filter((cell) => cell.column.id !== "actions")
            .map((cell) => ({
              key: cell.column.id,
              label: cell.column.columnDef.meta?.label ?? cell.column.id,
              value: flexRender(cell.column.columnDef.cell, cell.getContext()),
            })),
        },
      ]
    : []

  return (
    <RecordSheet
      open={row !== null}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      media={media}
      aside={aside}
      sections={sections}
      // The row was in hand when it was clicked, so there is never a moment
      // with nothing to show — except the one where a refetch has dropped it
      // from the page entirely, which reads correctly as an empty record.
      loading={row !== null && live === null}
      footer={footer}
    />
  )
}

/* ------------------------------------------------------------------ *
 * The state behind it
 * ------------------------------------------------------------------ */

/**
 * What every screen needs to hold to have a record sheet.
 *
 * The *row* is held rather than its id, for the reason in the note above: the
 * sheet opens filled in from the row and upgrades to the fetched record when
 * it arrives. Holding an id would mean a spinner over data already in hand.
 *
 * Usage is three lines on the screen:
 *
 * ```tsx
 * const shown = useRecordSheet<Node>()
 * const detail = useGetNode(shown.row?.id)
 * const record = detail.data ?? shown.row
 * ```
 */
export function useRecordSheet<TRow extends { id: string | number }>() {
  const [row, setRow] = React.useState<TRow | null>(null)

  const show = React.useCallback((next: TRow) => setRow(next), [])
  const close = React.useCallback(() => setRow(null), [])
  const onOpenChange = React.useCallback((next: boolean) => {
    if (!next) setRow(null)
  }, [])

  /**
   * Wraps one of the screen's verbs so it *replaces* the sheet instead of
   * opening a second dialog on top of it.
   *
   * The sheet is where the decision to edit was made, so it has done its job
   * by the time the form appears; leaving it mounted underneath would stack
   * two backdrops and leave Escape closing only the top one.
   *
   *     <BranchActions
   *       branch={shown.row}
   *       onEdit={shown.closeThen(setEditing)}
   *       onDelete={shown.closeThen(setDeleting)}
   *     />
   *
   * A fresh function per render is deliberate and cheap: this is one control
   * inside one dialog, not one per row.
   */
  const closeThen = React.useCallback(
    (run: (next: TRow) => void) => (next: TRow) => {
      setRow(null)
      run(next)
    },
    []
  )

  return { row, open: row !== null, show, close, closeThen, onOpenChange }
}
