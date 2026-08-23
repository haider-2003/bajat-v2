"use client"

import { flexRender, type Table as TanTable } from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import type { Features } from "@/lib/table-features"
import type { MemberRequest } from "@/features/members-requests/types"

/**
 * Table view — DESIGN.md §8.
 *
 * 40px sticky header on a subtle tint, 48px rows, hairline separators, no
 * zebra striping. The pagination bar is passed in as `footer` so it sits
 * inside the same border as the table rather than floating beneath it (§8.9).
 */
export function TableView({
  table,
  footer,
}: {
  table: TanTable<Features, MemberRequest>
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
              <TableRow
                key={hg.id}
                className="border-b-0 hover:bg-transparent"
              >
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
                  <p className="text-base font-semibold text-text">
                    No requests match these filters
                  </p>
                  <p className="mx-auto mt-2 max-w-[320px] text-[13px] text-text-muted">
                    Try clearing a filter or widening the search.
                  </p>
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
