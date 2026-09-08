"use client"

import { flexRender, type Table as TanTable } from "@tanstack/react-table"

import { EmptyState } from "@/components/table/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Features } from "@/lib/table-features"
import { cn } from "@/lib/utils"

/**
 * Whether a click on the row was meant for the row.
 *
 * A row is full of things that are already controls — the action group, a copy
 * button, a checkbox, a link out to an organization — and a click that landed
 * on one of those has already been handled. Walking up from the target rather
 * than comparing against `currentTarget` is what catches the icon *inside* the
 * button, which is what the pointer actually hits.
 *
 * The selection check is the other half: dragging across a cell to copy an ID
 * ends in a mouseup on the row, and without it every attempt to select text
 * would open the record instead.
 */
function shouldOpen(e: React.MouseEvent<HTMLTableRowElement>) {
  const target = e.target as HTMLElement | null
  if (
    target?.closest(
      "a,button,input,select,textarea,[role='menuitem'],[data-no-row-open]"
    )
  ) {
    return false
  }
  return !window.getSelection()?.toString()
}

/**
 * Table view — DESIGN.md §8.
 *
 * 40px sticky header on a subtle tint, 48px rows, hairline separators, no
 * zebra striping. The pagination bar is passed in as `footer` so it sits
 * inside the same border as the table rather than floating beneath it (§8.9).
 *
 * ### Why this one *is* shared, when `columns.tsx` is not
 *
 * A column list maps one entity's fields to one table's columns, so there is
 * nothing in it another screen could reuse. The chrome around those columns is
 * the opposite: every table in this product has the same header height, the
 * same row height, the same scroll boundary and the same empty state, and a
 * second copy of it is a second place for those to drift.
 *
 * So it is generic over the row type. The only screen-specific thing left is
 * what to call the rows when there are none, which is why `emptyTitle` is a
 * required prop rather than a default nobody would notice was wrong.
 *
 * ### The row is the "open" control
 *
 * There is no eye button in this product. Reading a record is what a row is
 * clicked for, so the row *is* that control — one gesture, learned once, that
 * works on every screen — and `components/table/row-actions.tsx` is left
 * holding only the verbs that *change* something.
 *
 * A row with `onRowClick` is a tab stop with an accessible name, Enter and
 * Space, and a visible focus ring. What it is not is a link — the record
 * opens in a sheet over the table, not at its own URL — and not a `button`
 * either; see the note at the call site for why re-roling a `<tr>` costs more
 * than it buys.
 */

export function TableView<TRow extends Record<string, unknown>>({
  table,
  emptyTitle,
  emptyHint,
  footer,
  onRowClick,
  rowLabel,
}: {
  table: TanTable<Features, TRow>
  /** Shown when the filters match nothing — e.g. "No members match these filters". */
  emptyTitle: string
  /**
   * The line under it. Defaults to `EmptyState`'s "try clearing a filter",
   * which is the right advice for a filtered-to-nothing table and the wrong
   * advice for a list that is legitimately empty — a screen that can be both
   * passes the hint that matches the state it is actually in.
   */
  emptyHint?: string
  /** The pagination bar, rendered inside the table's own border (§8.9). */
  footer?: React.ReactNode
  /**
   * Opens the row. See the note above — this is the *only* way a record is
   * opened for reading, so the same gesture works on every screen that has a
   * record to show, and screens that have none simply omit it.
   */
  onRowClick?: (row: TRow) => void
  /**
   * Names the row for the screen reader — "Open Baghdad Branch". Required
   * whenever `onRowClick` is passed, because a clickable row with no name
   * announces itself as the whole of its own text content.
   */
  rowLabel?: (row: TRow) => string
}) {
  const rows = table.getRowModel().rows
  const visibleCount = table.getVisibleLeafColumns().length

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {/* The container owns horizontal scroll — never the page body (§8.2). */}
      <div className="max-h-[calc(100svh-260px)] overflow-auto scrollbar-quiet">
        <Table className="border-separate border-spacing-0">
          <TableHeader className="[&_tr]:border-b-0">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-b-0 hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      "sticky top-0 z-10 h-10 border-b border-border bg-background-subtle px-4",
                      "first:ps-5 last:pe-5"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                {...(onRowClick && {
                  // Focusable, labelled and activatable — but deliberately
                  // *not* `role="button"`. A `<tr>` re-roled as a button stops
                  // being a row, and the table around it stops being a table:
                  // a screen reader loses row and column position on every
                  // record in the list to announce one verb it can get from
                  // the label instead.
                  tabIndex: 0,
                  "aria-label": rowLabel?.(row.original),
                  onClick: (e: React.MouseEvent<HTMLTableRowElement>) =>
                    shouldOpen(e) && onRowClick(row.original),
                  onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (e.key !== "Enter" && e.key !== " ") return
                    if (e.target !== e.currentTarget) return
                    // Space scrolls the container otherwise, and the row it was
                    // meant to open leaves the viewport instead of opening.
                    e.preventDefault()
                    onRowClick(row.original)
                  },
                })}
                className={cn(
                  "h-12 border-b-0",
                  "hover:bg-[rgba(0,0,0,0.025)] dark:hover:bg-[rgba(255,255,255,0.035)]",
                  onRowClick && [
                    "cursor-pointer",
                    // The ring is inset because a row has no outer margin — an
                    // outset one would be clipped by the scroll container on the
                    // first and last rows.
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  ]
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="h-12 border-b border-border px-4 py-0 first:ps-5 last:pe-5"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleCount} className="h-48 text-center">
                  <EmptyState title={emptyTitle} hint={emptyHint} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {footer}
    </div>
  )
}
