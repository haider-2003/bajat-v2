import type { MemberRequest } from "@/features/members-requests/types"
import type { Organization } from "@/features/organizations/types"

/**
 * `GET /statistics` — the dashboard overview payload.
 *
 * One endpoint, no params, no pagination, so this resource is hand-written
 * rather than generated from `createApiFactory` (docs/network-layer.md §7).
 *
 * ### Everything here is optional
 *
 * The Postman collection documents eight fields; it does not promise any of
 * them, and this screen is the first thing an admin sees after signing in. A
 * missing key must degrade to an empty section, never to a crash on the
 * landing page — so every field is widened to optional and every consumer
 * reads through `deriveOverview`, which fills the gaps once and centrally.
 *
 * Keys are camelCase because the response interceptor has already converted
 * them; the wire sends `total_identities`, `identities_in_year`, and so on.
 */
export type DashboardStatistics = {
  totalIdentities?: number
  totalMembers?: number
  totalMemberRequests?: number
  totalPendingMemberRequests?: number
  totalOrganizations?: number
  /** Twelve rows, oldest first. `month` arrives as a number, a name, or an ISO date. */
  identitiesInYear?: MonthlyIdentityCount[]
  latestMembersRequests?: MemberRequest[]
  topOrganizations?: TopOrganization[]
}

/**
 * One month of issuance.
 *
 * `month` is deliberately loose. The collection's description says only
 * `{month,total}` and gives no example, and the three plausible spellings — a
 * 1-based index, an English month name, an ISO `2026-09` — are all strings or
 * numbers that would type-check against each other. `monthIndexOf` in
 * derive.ts normalises whichever one turns up rather than guessing here.
 */
export type MonthlyIdentityCount = {
  month?: string | number | null
  total?: number | null
}

/**
 * A row of `top_organizations`.
 *
 * Documented only as an array. Observed shapes for "an organization plus a
 * count" differ in where the count lives, so all three spellings are accepted
 * and `readOrgTotal` picks whichever is present. The organization's own fields
 * are spread in, so a row is usable as an `Organization` too.
 */
export type TopOrganization = Partial<Organization> & {
  identitiesCount?: number | null
  totalIdentities?: number | null
  total?: number | null
}

/* ────────────────────────────────────────────────────────────────────────────
   View model — what the charts actually read.

   The screen never touches `DashboardStatistics` directly. `deriveOverview`
   maps the payload onto these shapes, so a chart component has no opinion
   about which fields the API sends, and widening the endpoint later is a
   change to derive.ts alone.
   ──────────────────────────────────────────────────────────────────────────── */

/** The window every section is scoped to (§ the one filter row). */
export type OverviewRange = "30d" | "90d" | "12m"

/** One point on the issuance pulse. */
export type PulsePoint = {
  /** Bucket label, already localised — "Mar", "W12", "14 Sep". */
  label: string
  value: number
  /** The same bucket one period earlier, for the hover readout. Null when unknown. */
  previous: number | null
  /** The bucket the viewer is currently inside. At most one point is current. */
  isCurrent: boolean
}

/** A stage of the request → card pipeline. */
export type PipelineStage = {
  id: "submitted" | "review" | "approved" | "issued"
  label: string
  value: number
  /** Lost between the previous stage and this one. Zero on the first stage. */
  dropped: number
  /** Median days a request waits in this stage. */
  dwellDays: number
}

/** One row of the organization ranking. */
export type OrgRank = {
  id: number
  name: string
  value: number
}

/** One cell of the activity grid: a weekday × a two-hour block. */
export type ActivityCell = {
  /** 0 = Monday … 6 = Sunday. */
  day: number
  /** 0 = 00:00–02:00 … 11 = 22:00–24:00. */
  block: number
  value: number
}

/** Everything the overview screen renders, in one shape. */
export type OverviewModel = {
  totals: {
    identities: number
    members: number
    requests: number
    pending: number
    organizations: number
  }
  /**
   * Period-over-period change in identities issued, as a fraction
   * (0.0275 = +2.75%), or **null** when there is nothing to compare against.
   *
   * Null is not zero. A tenant whose previous period was empty went from 0 to
   * 12, which is a rise with no percentage — reporting that as `0%` says
   * "unchanged", which is the opposite of what happened.
   */
  identitiesDelta: number | null
  pulse: PulsePoint[]
  pipeline: PipelineStage[]
  organizations: OrgRank[]
  activity: ActivityCell[]
  latestRequests: MemberRequest[]
  /**
   * Which parts of the model are modelled rather than measured.
   *
   * Most of this screen is real: the four pipeline stages all come out of
   * documented fields (see `derivePipeline`), and so do the totals, the
   * monthly series, the ranking and the queue. Three things do not, and they
   * are flagged here so the UI can say so out loud rather than passing an
   * estimate off as a measurement.
   */
  estimated: {
    /** Median days in stage — no field on the endpoint carries a duration. */
    dwell: boolean
    /** The weekday x hour grid — the endpoint reports no timestamps to bin. */
    activity: boolean
    /** Pulse buckets finer than a month, split out of the real monthly totals. */
    subMonthly: boolean
    /** True when there was no payload at all and the whole model is placeholder. */
    all: boolean
  }
}
