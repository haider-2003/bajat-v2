"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  IdCard,
  Phone,
  User,
} from "lucide-react"

import {
  DateCell,
  HeadCell,
  IdCell,
  PhoneCell,
  TextCell,
} from "@/components/table/cells"
import { CountChip } from "@/components/ui/data-bits"
import type { Member } from "@/features/members/types"
import type { Translator } from "@/i18n/translate"
import type { Features } from "@/lib/table-features"
import { EMPTY_VALUE } from "@/utils/format"

/**
 * Column definitions — DESIGN.md §8.3 / §8.6.
 *
 * Deliberately **not** shared, for the reason spelled out in
 * components/table/cells.tsx: a column list maps one entity's fields to one
 * table's columns. What is shared is the cell treatments and the table chrome
 * around them.
 *
 * Every column maps to a field `GET /member` actually returns
 * (docs/api-types.md § members). There is no status column because a member
 * has no status — that concept belongs to the *request* that produced them.
 *
 * `meta.priority` drives which columns drop first on narrow viewports (§8.12).
 *
 * ### A factory, not a constant
 *
 * The list used to be a module-level `const`. Headers and `meta.label` are
 * both user-facing — the second is what the View menu lists columns by — so
 * the array now has to be built against a language. It is called from a
 * `useMemo` in the screen, keyed on `t`, so the table still sees one stable
 * array per locale rather than a new one per render.
 */
export function buildColumns(
  t: Translator
): ColumnDef<Features, Member, unknown>[] {
  return [
    {
      accessorKey: "id",
      header: () => <HeadCell icon={IdCard}>{t("members.columns.member")}</HeadCell>,
      cell: ({ row }) => <IdCell value={row.original.id} />,
      size: 96,
      meta: { priority: 90, label: t("members.columns.member") },
    },
    {
      accessorKey: "name",
      header: () => <HeadCell icon={User}>{t("members.columns.name")}</HeadCell>,
      // The row's identity, so it carries the primary emphasis (§8.6).
      cell: ({ row }) => <TextCell value={row.original.name} emphasis="primary" />,
      size: 260,
      meta: { priority: 100, label: t("members.columns.name") },
    },
    {
      accessorKey: "phone",
      header: () => <HeadCell icon={Phone}>{t("members.columns.phone")}</HeadCell>,
      cell: ({ row }) => <PhoneCell value={row.original.phone} />,
      size: 190,
      meta: { priority: 80, label: t("members.columns.phone") },
    },
    {
      id: "organizations",
      // Sorting and the accessor need one string; the cell renders the rest.
      accessorFn: (row) => row.organizations?.[0]?.name ?? "",
      header: () => (
        <HeadCell icon={Building2}>{t("members.columns.organizations")}</HeadCell>
      ),
      cell: ({ row }) => <OrganizationsCell member={row.original} />,
      size: 240,
      meta: { priority: 70, label: t("members.columns.organizations") },
    },
    {
      accessorKey: "joinDate",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("members.columns.joinDate")}</HeadCell>
      ),
      // Something a reviewer is expected to set, so an unset one reads as an
      // affordance rather than a dash (§8.6).
      cell: ({ row }) => (
        <DateCell
          value={row.original.joinDate}
          empty={{ icon: CalendarPlus, label: t("members.addDate") }}
        />
      ),
      size: 190,
      meta: { priority: 60, label: t("members.columns.joinDate") },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <HeadCell icon={CalendarDays}>{t("members.columns.added")}</HeadCell>
      ),
      cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      size: 190,
      meta: { priority: 50, label: t("members.columns.added") },
    },
  ]
}

/**
 * The many-to-many cell: the first organization by name, plus a count chip for
 * the rest.
 *
 * Listing all of them would make one row taller than every other and push the
 * dates off screen; a member on eight organizations is real, and the column is
 * 240px. The first name plus `+7` says which and how many, and the full list
 * is on the card and the detail view. That is §18.0.6's "truncate only where
 * the full value is available elsewhere", applied to a list instead of a
 * string.
 *
 * `organizations` is documented as always present. It is still read
 * defensively — a missing array here is a `.length` on undefined, which takes
 * the whole table down rather than dropping one cell.
 */
function OrganizationsCell({ member }: { member: Member }) {
  const organizations = member.organizations ?? []

  if (organizations.length === 0) {
    return <span className="text-[13px] text-text-placeholder">{EMPTY_VALUE}</span>
  }

  const [first, ...rest] = organizations

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <TextCell value={first.name} />
      {rest.length > 0 && <CountChip>+{rest.length}</CountChip>}
    </div>
  )
}
