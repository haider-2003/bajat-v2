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

import type { TranslationKey } from "@/i18n/translate"

/**
 * Bajat dashboard navigation.
 *
 * Sections mirror the top-level structure in docs/dashboard-overview.md,
 * grouped into the sectioned-nav zones described in DESIGN.md §5.1.
 *
 * Presentation only — hrefs are placeholders. Permission gating (see the
 * overview doc) is not wired up yet.
 *
 * ### Keys, not words
 *
 * Items carry a `labelKey` into the dictionary rather than the label itself.
 * This module is imported by the sidebar on both the server and the client, and
 * a literal here could only ever be one language — the rail would stay English
 * under `/ar` while every screen beside it turned over. `TranslationKey` makes
 * a key that no longer exists a build error.
 */

export type NavItem = {
  labelKey: TranslationKey
  href: string
  icon: LucideIcon
  /** Nested children. Depth is capped at 2 levels (§5.7). */
  children?: NavChild[]
}

export type NavChild = {
  labelKey: TranslationKey
  href: string
}

export type NavSection = {
  /** Uppercase overline label; omit for the ungrouped primary zone (§5.6). */
  labelKey?: TranslationKey
  items: NavItem[]
}

/** Zone 3 — primary nav, sits above the divider (§5.1). */
export const primaryNav: NavItem[] = [
  { labelKey: "nav.home", href: "/", icon: Home },
  { labelKey: "nav.membersRequests", href: "/members-requests", icon: Inbox },
]

/** Zone 4 — sectioned nav, scrollable (§5.1). */
export const navSections: NavSection[] = [
  {
    labelKey: "nav.sections.idIssuance",
    items: [
      {
        labelKey: "nav.templates",
        href: "/id-issuance/templates",
        icon: LayoutTemplate,
      },
      {
        labelKey: "nav.requests",
        href: "/id-issuance/requests",
        icon: IdCard,
      },
      { labelKey: "nav.idFlow", href: "/id-issuance/flow", icon: Workflow },
      {
        labelKey: "nav.exportHistory",
        href: "/id-issuance/exports",
        icon: FileStack,
      },
    ],
  },
  {
    labelKey: "nav.sections.operations",
    items: [
      { labelKey: "nav.appUsers", href: "/members", icon: Users },
      { labelKey: "nav.payments", href: "/payments", icon: CreditCard },
      { labelKey: "nav.printer", href: "/printer", icon: Printer },
      { labelKey: "nav.delivery", href: "/delivery", icon: Truck },
      { labelKey: "nav.nodes", href: "/nodes", icon: Network },
    ],
  },
  {
    labelKey: "nav.sections.administration",
    items: [
      {
        labelKey: "nav.organization",
        href: "/organizations",
        icon: Building2,
        children: [
          { labelKey: "nav.organizations", href: "/organizations" },
          { labelKey: "nav.organizationUsers", href: "/organizations/users" },
          { labelKey: "nav.organizationRoles", href: "/organizations/roles" },
        ],
      },
      {
        labelKey: "nav.branches",
        href: "/branches",
        icon: GitBranch,
        children: [
          { labelKey: "nav.branches", href: "/branches" },
          { labelKey: "nav.branchUsers", href: "/branches/users" },
          { labelKey: "nav.branchRoles", href: "/branches/roles" },
        ],
      },
      {
        labelKey: "nav.apiIntegration",
        href: "/api-integration",
        icon: KeyRound,
        children: [
          { labelKey: "nav.apiKeys", href: "/api-integration/keys" },
          { labelKey: "nav.webhooks", href: "/api-integration/webhooks" },
        ],
      },
      { labelKey: "nav.blackList", href: "/black-list", icon: ShieldBan },
    ],
  },
  {
    labelKey: "nav.sections.management",
    items: [
      {
        labelKey: "nav.platform",
        href: "/management",
        icon: ShieldCheck,
        children: [
          { labelKey: "nav.admins", href: "/management/admins" },
          { labelKey: "nav.adminRoles", href: "/management/roles" },
        ],
      },
      { labelKey: "nav.auditLog", href: "/management/audit", icon: Activity },
    ],
  },
]

/** Zone 5 — footer utility items above the profile row (§5.9). */
export const footerNav: NavItem[] = [
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
]
