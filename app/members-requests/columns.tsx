"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarPlus,
  CalendarDays,
  CircleDollarSign,
  IdCard,
  LayoutTemplate,
  MoreHorizontal,
  User,
  Users,
} from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  AvatarStack,
  EmptyCell,
  GradientOrb,
  SegmentedMeter,
  SoftBadge,
  StatusDot,
} from "@/components/ui/data-bits"
import { cn } from "@/lib/utils"
import {
  PRIORITY_META,
  STATUS_META,
  type MemberRequest,
} from "./data"
import type { Features } from "@/lib/table-features"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * Headers carry a data-type glyph (the archetype-B signature), and every cell
 * follows one of the documented content patterns. `meta.priority` drives which
 * columns drop first on narrow viewports (§8.12).
 */

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
})

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso))
}

export const currencyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 12px/500 muted header with a leading type glyph (§8.3). */
function HeadCell({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-text-muted">
      <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
      {children}
    </span>
  )
}

export const columns: ColumnDef<Features, MemberRequest, unknown>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label={`Select ${row.original.id}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
    meta: { priority: 100, label: "Select" },
  },
  {
    accessorKey: "id",
    header: () => <HeadCell icon={IdCard}>Request</HeadCell>,
    // Mono ID at 12px/500 muted (§8.6).
    cell: ({ row }) => (
      <span className="font-mono text-xs font-medium tracking-[0.02em] text-text-muted">
        {row.original.id}
      </span>
    ),
    size: 96,
    meta: { priority: 90, label: "Request" },
  },
  {
    accessorKey: "memberName",
    header: () => <HeadCell icon={User}>Member</HeadCell>,
    // Entity cell: gradient orb + name, with the row action revealed on hover.
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <GradientOrb seed={row.original.avatar} />
        <span className="truncate text-sm font-medium text-text">
          {row.original.memberName}
        </span>
        <button
          type="button"
          aria-label={`Actions for ${row.original.memberName}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "ml-1 hidden size-6 shrink-0 items-center justify-center rounded-md text-text-muted",
            "opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100",
            "hover:bg-[rgba(0,0,0,0.06)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.07)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
          )}
        >
          <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    ),
    size: 260,
    meta: { priority: 100, label: "Member" },
  },
  {
    accessorKey: "status",
    header: () => <HeadCell icon={CalendarDays}>Status</HeadCell>,
    // Flat soft badge for workflow status (§14.1).
    cell: ({ row }) => {
      const meta = STATUS_META[row.original.status]
      return (
        <span className="inline-flex items-center gap-2">
          <StatusDot tone={meta.tone} />
          <SoftBadge tone={meta.tone}>{meta.label}</SoftBadge>
        </span>
      )
    },
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
    size: 150,
    meta: { priority: 95, label: "Status" },
  },
  {
    accessorKey: "priority",
    header: () => <HeadCell icon={CalendarDays}>Priority</HeadCell>,
    // Bordered soft badge for priority (§14.1) — the other badge family.
    cell: ({ row }) => {
      const meta = PRIORITY_META[row.original.priority]
      return (
        <SoftBadge tone={meta.tone} bordered>
          {meta.label}
        </SoftBadge>
      )
    },
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
    size: 110,
    meta: { priority: 70, label: "Priority" },
  },
  {
    accessorKey: "template",
    header: () => <HeadCell icon={LayoutTemplate}>Template</HeadCell>,
    cell: ({ row }) => (
      <span className="truncate text-sm text-text-secondary">
        {row.original.template}
      </span>
    ),
    size: 180,
    meta: { priority: 40, label: "Template" },
  },
  {
    accessorKey: "branch",
    header: () => <HeadCell icon={Building2}>Branch</HeadCell>,
    cell: ({ row }) => (
      <span className="truncate text-sm text-text-secondary">
        {row.original.branch}
      </span>
    ),
    size: 160,
    meta: { priority: 30, label: "Branch" },
  },
  {
    accessorKey: "progress",
    header: () => <HeadCell icon={CalendarDays}>Progress</HeadCell>,
    cell: ({ row }) => {
      const tone = STATUS_META[row.original.status].tone
      return <SegmentedMeter value={row.original.progress} tone={tone} />
    },
    size: 170,
    meta: { priority: 50, label: "Progress" },
  },
  {
    accessorKey: "dueAt",
    header: () => <HeadCell icon={CalendarDays}>Due date</HeadCell>,
    // Empty cells render an affordance, never a blank (§8.6).
    cell: ({ row }) =>
      row.original.dueAt ? (
        <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <CalendarDays
            className="size-3.5 shrink-0 text-text-muted"
            strokeWidth={1.5}
          />
          {formatDate(row.original.dueAt)}
        </span>
      ) : (
        <EmptyCell icon={CalendarPlus} label="Add date" />
      ),
    size: 190,
    meta: { priority: 60, label: "Due date" },
  },
  {
    accessorKey: "amount",
    header: () => <HeadCell icon={CircleDollarSign}>Fee</HeadCell>,
    // Currency glyph leads, so the cell is left-aligned (§4.6 rule 3).
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 text-sm text-text">
        <CircleDollarSign
          className="size-3.5 shrink-0 text-text-muted"
          strokeWidth={1.5}
        />
        <span className="tabular-nums">
          {currencyFmt.format(row.original.amount)}
        </span>
      </span>
    ),
    size: 140,
    meta: { priority: 55, label: "Fee" },
  },
  {
    accessorKey: "reviewers",
    header: () => <HeadCell icon={Users}>Reviewers</HeadCell>,
    cell: ({ row }) => <AvatarStack seeds={row.original.reviewers} />,
    enableSorting: false,
    size: 120,
    meta: { priority: 45, label: "Reviewers" },
  },
]
