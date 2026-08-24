"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronsUpDown,
  Menu,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  X,
} from "lucide-react"

import { BajatMark } from "@/components/brand/bajat-mark"
import { useLogout } from "@/features/auth/api"
import { useAuthStore } from "@/features/auth/store"
import { cn } from "@/lib/utils"
import {
  footerNav,
  navSections,
  primaryNav,
  type NavItem,
  type NavSection,
} from "./sidebar-nav-data"
import {
  useControlSurface,
  type ControlSurface,
} from "@/components/ui/control-style"

import { useShell } from "./shell-context"

/**
 * Bajat sidebar — DESIGN.md §5.
 *
 * Variant A ("floating content", §5.3): the sidebar shares the page's grey
 * background and carries no right border; the content panel is a white card
 * that appears to float. The active nav item is therefore a raised white chip
 * in light mode, and a flat white-alpha fill in dark mode (§5.4) — the two
 * themes use different mechanisms for the same state.
 *
 * UI only. Counts are sample data and hrefs are placeholders.
 */

const COUNT_CAP = 99

/* ------------------------------------------------------------------ *
 * Count — plain right-aligned muted numeral, not a pill badge (§5.5)
 * ------------------------------------------------------------------ */

function NavCount({ value, muted }: { value: number; muted?: string }) {
  return (
    <span
      className={cn(
        "ml-auto shrink-0 text-[11px] font-normal tabular-nums",
        // An active chip hands down its own muted tone; a resting row has no
        // face, so it falls back to the sidebar's. Previously this asked
        // whether the style was `ink`, which stopped being the only dark face
        // the moment flat gained a solid form.
        muted ?? "text-text-muted"
      )}
    >
      {Math.min(value, COUNT_CAP)}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Tooltip shown only while collapsed (§5.10)
 * ------------------------------------------------------------------ */

/**
 * Tooltip for collapsed rail items.
 *
 * Rendered through a portal rather than as a child of the nav item: the
 * scroll container clips its own overflow, so an in-flow tooltip would be
 * cut off at the 56px rail edge. Position is measured from the anchor.
 */
function CollapsedLabel({
  label,
  anchorRef,
}: {
  label: string
  anchorRef: React.RefObject<HTMLElement | null>
}) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null
  )

  React.useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const show = () => {
      const r = el.getBoundingClientRect()
      setPos({ top: r.top + r.height / 2, left: r.right + 8 })
    }
    const hide = () => setPos(null)

    el.addEventListener("mouseenter", show)
    el.addEventListener("mouseleave", hide)
    el.addEventListener("focusin", show)
    el.addEventListener("focusout", hide)
    return () => {
      el.removeEventListener("mouseenter", show)
      el.removeEventListener("mouseleave", hide)
      el.removeEventListener("focusin", show)
      el.removeEventListener("focusout", hide)
    }
  }, [anchorRef])

  if (!pos) return null

  return createPortal(
    <span
      role="tooltip"
      style={{ top: pos.top, left: pos.left }}
      className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs font-medium text-text shadow-[0_12px_32px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06)]"
    >
      {label}
    </span>,
    document.body
  )
}

/* ------------------------------------------------------------------ *
 * Leaf nav item — 34px, 8px radius, 16px icon, 10px gap (§5.2)
 * ------------------------------------------------------------------ */

function NavLeaf({
  item,
  active,
  collapsed,
  chip,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  chip: ControlSurface
}) {
  const Icon = item.icon
  const ref = React.useRef<HTMLAnchorElement>(null)

  return (
    <Link
      ref={ref}
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/item relative flex h-nav-item items-center gap-2.5 rounded-md px-2.5",
        "text-sm font-medium transition-[background-color,box-shadow,color] duration-120",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        collapsed && "justify-center px-0",
        active
          ? chip.face
          : "text-text-secondary hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.045)]"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          // Icons sit one contrast step lighter than their label (§15.3).
          active
            ? "text-current"
            : "text-text-muted group-hover/item:text-text"
        )}
        strokeWidth={1.5}
      />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.count !== undefined && (
            <NavCount
              value={item.count}
              muted={active ? chip.muted : undefined}
            />
          )}
        </>
      )}
      {collapsed && <CollapsedLabel label={item.label} anchorRef={ref} />}
    </Link>
  )
}

/* ------------------------------------------------------------------ *
 * Expandable group — trailing chevron rotates 0°→180° (§5.5)
 * ------------------------------------------------------------------ */

function NavGroup({
  item,
  pathname,
  collapsed,
  chip,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  chip: ControlSurface
}) {
  const childActive = item.children?.some((c) => c.href === pathname) ?? false
  const Icon = item.icon

  // Open state is derived, not synced: a group holding the active route is
  // open unless the user has explicitly toggled it since.
  const [override, setOverride] = React.useState<boolean | null>(null)
  const open = override ?? childActive

  if (collapsed) {
    return (
      <NavLeaf item={item} active={childActive} collapsed chip={chip} />
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        className={cn(
          "group/item flex h-nav-item w-full items-center gap-2.5 rounded-md px-2.5",
          "text-sm font-medium transition-colors duration-120",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
          childActive && !open
            ? "text-text"
            : "text-text-secondary hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.045)]"
        )}
      >
        <Icon
          className="size-4 shrink-0 text-text-muted transition-colors group-hover/item:text-text"
          strokeWidth={1.5}
        />
        <span className="truncate">{item.label}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 text-text-muted transition-transform duration-150",
            open && "rotate-180"
          )}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {item.children?.map((child) => {
            const active = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Child text aligns under the parent's text, not its icon (§5.7).
                  "flex h-8 items-center rounded-md pl-[38px] pr-2.5 text-sm transition-colors duration-120",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                  active
                    ? "bg-[rgba(0,0,0,0.05)] font-medium text-text dark:bg-[rgba(255,255,255,0.06)]"
                    : "font-normal text-text-secondary hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.045)]"
                )}
              >
                <span className="truncate">{child.label}</span>
                {child.count !== undefined && <NavCount value={child.count} />}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Section header — 11px/600 uppercase +0.08em, hover reveals ··· and + (§5.6)
 * ------------------------------------------------------------------ */

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="group/section flex h-7 items-center gap-1 pl-2.5 pr-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-text-muted transition-transform duration-150",
            !open && "-rotate-90"
          )}
          strokeWidth={2}
        />
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {label}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
        <IconButton label={`${label} options`}>
          <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
        </IconButton>
        <IconButton label={`Add to ${label}`}>
          <Plus className="size-3.5" strokeWidth={1.5} />
        </IconButton>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Ghost icon button (§7.2)
 * ------------------------------------------------------------------ */

function IconButton({
  label,
  children,
  onClick,
  className,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md",
        "text-text-muted transition-colors duration-120",
        "hover:bg-[rgba(0,0,0,0.06)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.07)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * Zone 1 — workspace switcher (§5.1)
 * ------------------------------------------------------------------ */

function WorkspaceSwitcher({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  // Collapsed: the 56px header holds the expand control alone, rendered as a
  // bordered chip so it reads as a control at rest. Hiding it behind a
  // hover-swap on the logo left no discoverable way back out of the rail, and
  // stacking logo + button pushed the nav down past the fold.
  if (collapsed) {
    return (
      <div className="flex h-14 items-center justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          aria-expanded={false}
          title="Expand sidebar"
          className={cn(
            "flex size-nav-item items-center justify-center rounded-md",
            "bg-surface text-text-secondary shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-border",
            "transition-colors duration-120 hover:text-text",
            "hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_4%)]",
            "dark:bg-[rgba(255,255,255,0.06)] dark:shadow-none dark:ring-0",
            "dark:hover:bg-[rgba(255,255,255,0.10)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <PanelLeft aria-hidden className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-14 items-center gap-2.5 px-3">
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5",
          "transition-colors duration-120 hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.045)]",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="Switch organization"
      >
        {/* 20px identity mark (§5.2) — inherits the theme via currentColor */}
        <BajatMark className="size-5 text-text" />
        <span className="truncate text-sm font-semibold text-text">Bajat</span>
        <ChevronDown
          className="size-3.5 shrink-0 text-text-muted"
          strokeWidth={1.5}
        />
      </button>

      <IconButton label="Collapse sidebar" onClick={onToggleCollapse}>
        <PanelLeft className="size-4" strokeWidth={1.5} />
      </IconButton>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Zone 2 — search field, sunken fill + keyboard hint (§6.7)
 * ------------------------------------------------------------------ */

function SidebarSearch({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex justify-center px-2 pb-2">
        <IconButton label="Search" className="size-nav-item">
          <Search className="size-4" strokeWidth={1.5} />
        </IconButton>
      </div>
    )
  }

  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md bg-surface-sunken px-2.5",
          "text-left transition-colors duration-120",
          "hover:bg-[rgba(0,0,0,0.055)] dark:bg-surface-sunken dark:hover:bg-[rgba(255,255,255,0.06)]",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Search
          className="size-4 shrink-0 text-text-placeholder"
          strokeWidth={1.5}
        />
        <span className="flex-1 truncate text-sm text-text-placeholder">
          Search
        </span>
        <kbd className="shrink-0 font-mono text-[11px] tracking-[0.02em] text-text-placeholder">
          ⌘K
        </kbd>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Zone 5 — footer profile row, 52px (§5.9)
 * ------------------------------------------------------------------ */

function ProfileRow({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const logoutMutation = useLogout()

  // No account menu yet, so the row doubles as sign-out. The local logout runs
  // either way: a failed server call must never trap someone in a signed-in
  // shell (docs/authentication.md §7).
  const onClick = () => {
    const finish = () => {
      logout()
      router.push("/login")
    }
    logoutMutation.mutate(undefined, { onSuccess: finish, onError: finish })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Sign out"
      aria-label="Account menu"
      className={cn(
        "group/profile flex h-[52px] w-full items-center gap-2.5 rounded-md px-2.5",
        "transition-colors duration-120 hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.045)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-0"
      )}
    >
      <span
        aria-hidden
        className="size-7 shrink-0 rounded-full"
        style={{
          backgroundImage: "linear-gradient(135deg, #FB923C 0%, #EF4444 100%)",
        }}
      />
      {!collapsed && (
        <>
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="w-full truncate text-[13px] font-medium leading-tight text-text">
              {user?.name ?? "Signed in"}
            </span>
            <span className="w-full truncate text-[11px] leading-tight text-text-muted">
              {user?.email ?? user?.phone ?? ""}
            </span>
          </span>
          <ChevronsUpDown
            className="size-3.5 shrink-0 text-text-muted"
            strokeWidth={1.5}
          />
        </>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * Sidebar body — shared by the fixed rail and the mobile drawer
 * ------------------------------------------------------------------ */

function SidebarBody({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const pathname = usePathname()
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(navSections.map((s) => [s.label ?? "", true]))
  )
  // TEMPORARY — the active-chip treatment, shared with the toolbar's filter
  // buttons so both switch together. Chosen from Settings → Appearance.
  // See components/ui/control-style.tsx.
  const chip = useControlSurface()

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const renderItem = (item: NavItem) =>
    item.children?.length ? (
      <NavGroup
        key={item.href}
        item={item}
        pathname={pathname}
        collapsed={collapsed}
        chip={chip}
      />
    ) : (
      <NavLeaf
        key={item.href}
        item={item}
        active={pathname === item.href}
        collapsed={collapsed}
        chip={chip}
      />
    )

  return (
    <div
      data-collapsed={collapsed}
      className="flex h-full min-h-0 flex-col bg-sidebar"
    >
      {/* Zones 1–3 are fixed; only zone 4 scrolls. */}
      <div className="shrink-0">
        <WorkspaceSwitcher
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
        <SidebarSearch collapsed={collapsed} />

        {/* Zone 3 — primary nav */}
        <nav
          className={cn(
            "flex flex-col gap-0.5",
            collapsed ? "px-2" : "px-3"
          )}
          aria-label="Primary"
        >
          {primaryNav.map(renderItem)}
        </nav>

        {/* Divider: 1px hairline with 8px of air (§5.2) */}
        <div className={cn("my-2", collapsed ? "px-2" : "px-3")}>
          <div className="h-px bg-border" />
        </div>
      </div>

      {/* Zone 4 — sectioned nav, scrollable */}
      <nav
        className={cn(
          "min-h-0 flex-1 overflow-y-auto pb-2 scrollbar-quiet",
          // A vertical scroll container cannot also be overflow-x:visible —
          // the browser coerces x to auto — so the content must simply never
          // exceed the rail width. Tooltips are portalled out instead.
          collapsed ? "overflow-x-hidden px-2" : "px-3"
        )}
        aria-label="Sections"
      >
        {navSections.map((section: NavSection) => {
          const key = section.label ?? ""
          const open = openSections[key] ?? true

          return (
            <div key={key} className="mb-3 last:mb-0">
              {section.label && !collapsed && (
                <SectionHeader
                  label={section.label}
                  open={open}
                  onToggle={() => toggleSection(key)}
                />
              )}
              {/* Collapsed rails drop section labels and show a divider (§5.10) */}
              {section.label && collapsed && (
                <div className="mx-auto mb-2 h-px w-6 bg-border" />
              )}
              {(open || collapsed) && (
                <div className="flex flex-col gap-0.5">
                  {section.items.map(renderItem)}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Zone 5 — footer, pinned outside the scroll region */}
      <div className={cn("shrink-0 pb-3", collapsed ? "px-2" : "px-3")}>
        <div className="mb-2 h-px bg-border" />
        <div className="flex flex-col gap-0.5">
          {footerNav.map(renderItem)}

          <ProfileRow collapsed={collapsed} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Public shell — fixed rail ≥1024px, off-canvas drawer below (§18.2)
 * ------------------------------------------------------------------ */

export function Sidebar() {
  const { collapsed, setCollapsed, drawerOpen, setDrawerOpen } = useShell()
  const pathname = usePathname()

  // Close the drawer on navigation (§18.2). Adjusting during render — rather
  // than in an effect — avoids a frame where the drawer lingers over the new
  // route. See react.dev "You Might Not Need an Effect".
  const [lastPath, setLastPath] = React.useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setDrawerOpen(false)
  }

  // Close the drawer on Escape (§18.2).
  React.useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawerOpen, setDrawerOpen])

  return (
    <>
      {/* Full-height rail — 248px expanded, 56px collapsed (§5.2, §5.10).
          A plain flex child rather than a fixed overlay + spacer: the shell
          owns the viewport height, so one element can hold the width. */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          "hidden h-full shrink-0 lg:block",
          "transition-[width] duration-150 ease-out",
          collapsed ? "w-14" : "w-[248px]"
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {/* Off-canvas drawer — 280px over a 32% scrim (§18.2) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--overlay)] animate-in fade-in duration-150"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[280px] shadow-[0_24px_64px_rgba(0,0,0,0.16)] animate-in slide-in-from-left duration-200"
          >
            <IconButton
              label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-4 z-10"
            >
              <X className="size-4" strokeWidth={1.5} />
            </IconButton>
            <SidebarBody collapsed={false} onToggleCollapse={() => {}} />
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Mobile drawer trigger (§18.3)
 * ------------------------------------------------------------------ */

/**
 * Opens the off-canvas nav below `lg`.
 *
 * Exported so page headers can render it *inside* their flow as the first
 * item. Floating it over the header made it overlap the title on narrow
 * viewports.
 */
export function SidebarTrigger({ className }: { className?: string }) {
  const { setDrawerOpen } = useShell()

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label="Open navigation"
      className={cn(
        // 44px touch target below lg, per §18.7.
        "-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md lg:hidden",
        "text-text-muted transition-colors duration-120",
        "hover:bg-[rgba(0,0,0,0.06)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.07)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Menu className="size-5" strokeWidth={1.5} />
    </button>
  )
}
