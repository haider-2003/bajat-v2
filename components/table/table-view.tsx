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
 */
export function TableView<TRow extends Record<string, unknown>>({
  table,
  emptyTitle,
  footer,
}: {
  table: TanTable<Features, TRow>
  /** Shown when the filters match nothing — e.g. "No members match these filters". */
  emptyTitle: string
  /** The pagination bar, rendered inside the table's own border (§8.9). */
  footer?: React.ReactNode
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
                      "first:pl-5 last:pr-5"
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
                className={cn(
                  "h-12 border-b-0",
                  "hover:bg-[rgba(0,0,0,0.025)] dark:hover:bg-[rgba(255,255,255,0.035)]"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="h-12 border-b border-border px-4 py-0 first:pl-5 last:pr-5"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleCount} className="h-48 text-center">
                  <EmptyState title={emptyTitle} />
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
