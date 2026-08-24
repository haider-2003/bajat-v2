import {
  Activity,
  Building2,
  CreditCard,
  FileStack,
  GitBranch,
  Home,
  IdCard,
  Inbox,
  KeyRound,
  LayoutTemplate,
  Network,
  Printer,
  Settings,
  ShieldBan,
  ShieldCheck,
  Truck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"

/**
 * Bajat dashboard navigation.
 *
 * Sections mirror the top-level structure in docs/dashboard-overview.md,
 * grouped into the sectioned-nav zones described in DESIGN.md §5.1.
 *
 * Presentation only — hrefs are placeholders and `count` values are sample
 * data. Permission gating (see the overview doc) is not wired up yet.
 */

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Trailing muted numeral, capped at 99 per DESIGN.md §5.5. */
  count?: number
  /** Nested children. Depth is capped at 2 levels (§5.7). */
  children?: NavChild[]
}

export type NavChild = {
  label: string
  href: string
  count?: number
}

export type NavSection = {
  /** Uppercase overline label; omit for the ungrouped primary zone (§5.6). */
  label?: string
  items: NavItem[]
}

/** Zone 3 — primary nav, sits above the divider (§5.1). */
export const primaryNav: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Members Requests", href: "/members-requests", icon: Inbox, count: 23 },
]

/** Zone 4 — sectioned nav, scrollable (§5.1). */
export const navSections: NavSection[] = [
  {
    label: "ID Issuance",
    items: [
      {
        label: "Templates",
        href: "/id-issuance/templates",
        icon: LayoutTemplate,
      },
      {
        label: "Requests",
        href: "/id-issuance/requests",
        icon: IdCard,
        count: 48,
      },
      { label: "ID Flow", href: "/id-issuance/flow", icon: Workflow },
      {
        label: "Export History",
        href: "/id-issuance/exports",
        icon: FileStack,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "App Users", href: "/members", icon: Users, count: 99 },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Printer", href: "/printer", icon: Printer, count: 12 },
      { label: "Delivery", href: "/delivery", icon: Truck },
      { label: "Nodes", href: "/nodes", icon: Network },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Organization",
        href: "/organizations",
        icon: Building2,
        children: [
          { label: "Organizations", href: "/organizations" },
          { label: "Organization Users", href: "/organizations/users", count: 34 },
          { label: "Organization Roles", href: "/organizations/roles" },
        ],
      },
      {
        label: "Branches",
        href: "/branches",
        icon: GitBranch,
        children: [
          { label: "Branches", href: "/branches" },
          { label: "Branch Users", href: "/branches/users" },
          { label: "Branch Roles", href: "/branches/roles" },
        ],
      },
      {
        label: "API Integration",
        href: "/api-integration",
        icon: KeyRound,
        children: [
          { label: "API Keys", href: "/api-integration/keys" },
          { label: "Webhooks", href: "/api-integration/webhooks" },
        ],
      },
      { label: "Black List", href: "/black-list", icon: ShieldBan },
    ],
  },
  {
    label: "Management",
    items: [
      {
        label: "Platform",
        href: "/management",
        icon: ShieldCheck,
        children: [
          { label: "Admins", href: "/management/admins" },
          { label: "Admin Roles", href: "/management/roles" },
        ],
      },
      { label: "Audit Log", href: "/management/audit", icon: Activity },
    ],
  },
]

/** Zone 5 — footer utility items above the profile row (§5.9). */
export const footerNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
]
