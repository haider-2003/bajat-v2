"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  ChevronDown,
  Loader2,
  LogOut,
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
import { useDir, useT } from "@/i18n/context"
import {
  Link,
  useLocalePathname,
  useLocaleRouter,
} from "@/i18n/navigation"
import type { Translator } from "@/i18n/translate"
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
 * UI only — hrefs are placeholders.
 */

/**
 * Where zone 4 is scrolled to, kept outside the component tree.
 *
 * `AppShell` is rendered by each `page.tsx` rather than by a layout, so every
 * navigation unmounts the whole rail and mounts a new one — and a fresh DOM
 * node starts at `scrollTop: 0`. Parking the offset in module scope lets the
 * next instance pick up exactly where the last one left off. A module variable
 * rather than storage: this is a within-session convenience, and a reload
 * legitimately starts the rail at the top.
 */
let railScrollTop = 0

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
  // The rail sits on the reading-start edge, so the tooltip has to open away
  // from it — right of the rail in English, left of it in Arabic. This is the
  // one piece of sidebar geometry a logical property cannot express, because
  // the position is computed in JS rather than declared in CSS.
  const rtl = useDir() === "rtl"
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null
  )

  React.useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const show = () => {
      const r = el.getBoundingClientRect()
      setPos({
        top: r.top + r.height / 2,
        left: rtl ? r.left - 8 : r.right + 8,
      })
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
  }, [anchorRef, rtl])

  if (!pos) return null

  return createPortal(
    <span
      role="tooltip"
      style={{ top: pos.top, left: pos.left }}
      className={cn(
        "pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs font-medium text-text shadow-[0_12px_32px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06)]",
        // `left` is the anchor's *outer* edge in RTL, so the box has to hang
        // back from it rather than forward.
        rtl && "-translate-x-full"
      )}
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
  const t = useT()
  const Icon = item.icon
  const label = t(item.labelKey)
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
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <CollapsedLabel label={label} anchorRef={ref} />}
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
  const t = useT()
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
        <span className="truncate">{t(item.labelKey)}</span>
        <ChevronDown
          className={cn(
            "ms-auto size-3.5 shrink-0 text-text-muted transition-transform duration-150",
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
                  // Logical padding, so the indent moves to the right edge
                  // under RTL instead of stranding the labels mid-rail.
                  "flex h-8 items-center rounded-md ps-[38px] pe-2.5 text-sm transition-colors duration-120",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                  active
                    ? "bg-[rgba(0,0,0,0.05)] font-medium text-text dark:bg-[rgba(255,255,255,0.06)]"
                    : "font-normal text-text-secondary hover:bg-[rgba(0,0,0,0.04)] hover:text-text dark:hover:bg-[rgba(255,255,255,0.045)]"
                )}
              >
                <span className="truncate">{t(child.labelKey)}</span>
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
  t,
}: {
  /** Already translated — the section list holds a key, not a word. */
  label: string
  open: boolean
  onToggle: () => void
  t: Translator
}) {
  return (
    <div className="group/section flex h-7 items-center gap-1 ps-2.5 pe-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-center gap-1 rounded text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-text-muted transition-transform duration-150",
            // Closed, it points *into* the section — which is rightwards in
            // English and leftwards in Arabic.
            !open && "-rotate-90 rtl:rotate-90"
          )}
          strokeWidth={2}
        />
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {label}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
        <IconButton label={t("sidebar.sectionOptions", { section: label })}>
          <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
        </IconButton>
        <IconButton label={t("sidebar.addToSection", { section: label })}>
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
  const t = useT()

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
          aria-label={t("sidebar.expand")}
          aria-expanded={false}
          title={t("sidebar.expand")}
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
          <PanelLeft data-flip-rtl aria-hidden className="size-4" strokeWidth={1.5} />
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
        aria-label={t("sidebar.switchOrganization")}
      >
        {/* 20px identity mark (§5.2) — inherits the theme via currentColor */}
        <BajatMark className="size-5 text-text" />
        <span className="truncate text-sm font-semibold text-text">
          {t("app.name")}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-text-muted"
          strokeWidth={1.5}
        />
      </button>

      <IconButton label={t("sidebar.collapse")} onClick={onToggleCollapse}>
        <PanelLeft data-flip-rtl className="size-4" strokeWidth={1.5} />
      </IconButton>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Zone 2 — search field, sunken fill + keyboard hint (§6.7)
 * ------------------------------------------------------------------ */

function SidebarSearch({ collapsed }: { collapsed: boolean }) {
  const t = useT()

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 pb-2">
        <IconButton label={t("common.search")} className="size-nav-item">
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
          "text-start transition-colors duration-120",
          "hover:bg-[rgba(0,0,0,0.055)] dark:bg-surface-sunken dark:hover:bg-[rgba(255,255,255,0.06)]",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Search
          className="size-4 shrink-0 text-text-placeholder"
          strokeWidth={1.5}
        />
        <span className="flex-1 truncate text-sm text-text-placeholder">
          {t("common.search")}
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

/**
 * Who is signed in. **Not a control.**
 *
 * It used to be the sign-out button — the whole 52px row, with nothing on it
 * saying so. Two things were wrong with that: the only way to leave was to
 * click something that looks like an account switcher, and every stray click
 * near the bottom of the rail ended the session. Signing out now has its own
 * button below (`SignOutButton`), so this is a plain label: no hover face, no
 * chevron promising a menu that does not exist.
 */
function ProfileRow({ collapsed }: { collapsed: boolean }) {
  const t = useT()
  const user = useAuthStore((s) => s.user)

  return (
    <div
      className={cn(
        "flex h-[52px] w-full items-center gap-2.5 rounded-md px-2.5",
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
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="w-full truncate text-[13px] font-medium leading-tight text-text">
            {user?.name ?? t("sidebar.signedIn")}
          </span>
          <span className="w-full truncate text-[11px] leading-tight text-text-muted">
            {user?.email ?? user?.phone ?? ""}
          </span>
        </span>
      )}
    </div>
  )
}

/**
 * Sign out — the destructive outline button of §7.2, at nav-item height.
 *
 * Red and labelled, because leaving is the one action in the rail that cannot
 * be undone by clicking somewhere else. It reads as danger without shouting:
 * an outline, not a solid red fill, so a permanently visible control does not
 * dominate a footer it is used from once a day.
 *
 * The local logout runs whether or not the server call succeeds — a failed
 * request must never trap someone inside a signed-in shell
 * (docs/authentication.md §7).
 */
function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const t = useT()
  // The locale-aware router: `/login` is not a route, `/en/login` is.
  const router = useLocaleRouter()
  const logout = useAuthStore((s) => s.logout)
  const logoutMutation = useLogout()
  const pending = logoutMutation.isPending

  const signOut = () => {
    if (pending) return
    const finish = () => {
      logout()
      router.push("/login")
    }
    logoutMutation.mutate(undefined, { onSuccess: finish, onError: finish })
  }

  const Icon = pending ? Loader2 : LogOut

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      title={t("auth.signOut")}
      aria-label={t("auth.signOut")}
      aria-busy={pending}
      className={cn(
        "inline-flex h-nav-item items-center justify-center gap-2 rounded-md",
        "border border-danger/25 text-[13px] font-medium text-danger",
        "transition-colors duration-120 hover:bg-danger-bg hover:border-danger/40",
        "outline-none focus-visible:ring-2 focus-visible:ring-danger/40",
        "disabled:cursor-not-allowed disabled:opacity-70",
        // Collapsed the label goes, but the rim and the colour stay: a bare
        // red glyph would be indistinguishable from a status dot.
        collapsed ? "mx-auto w-nav-item" : "w-full"
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", pending && "animate-spin")}
        strokeWidth={1.5}
      />
      {!collapsed && (pending ? t("auth.signingOut") : t("auth.signOut"))}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * Sidebar body — shared by the fixed rail and the mobile drawer
 * ------------------------------------------------------------------ */

/**
 * ### The rail deliberately does not move on navigation
 *
 * An earlier pass scrolled zone 4 to bring the active item into view on every
 * route change. That lurched the rail under the cursor on every click, moving
 * the item you had just aimed at out from under you — so nothing here scrolls
 * the rail *to* anywhere. Where it sits is the user's business.
 *
 * Holding still, though, takes work: the shell is mounted per page, so each
 * navigation hands zone 4 a brand-new DOM node scrolled to the top. The ref
 * callback below writes the remembered offset back during commit — before
 * paint, so the restored position is the first one drawn, never a jump.
 */

function SidebarBody({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const t = useT()
  // Bare of the `/en` prefix, because that is what the nav hrefs are written
  // as. Comparing against the raw pathname would leave every item inactive.
  const pathname = useLocalePathname()
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    // Keyed by the *key*, not the label: a translated label would re-key every
    // section the moment the language changed, collapsing them all.
    () => Object.fromEntries(navSections.map((s) => [s.labelKey ?? "", true]))
  )
  // TEMPORARY — the active-chip treatment, shared with the toolbar's filter
  // buttons so both switch together. Chosen from Settings → Appearance.
  // See components/ui/control-style.tsx.
  const chip = useControlSurface()

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // Stable, so it runs once per mount rather than on every render. Children
  // are already attached by the time a parent's ref fires, so the element has
  // its full scroll height and the offset lands rather than clamping to 0.
  const restoreRailScroll = React.useCallback((el: HTMLElement | null) => {
    if (el) el.scrollTop = railScrollTop
  }, [])

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
          aria-label={t("sidebar.primaryNav")}
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
        ref={restoreRailScroll}
        onScroll={(e) => {
          railScrollTop = e.currentTarget.scrollTop
        }}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto pb-2 scrollbar-quiet",
          // A vertical scroll container cannot also be overflow-x:visible —
          // the browser coerces x to auto — so the content must simply never
          // exceed the rail width. Tooltips are portalled out instead.
          collapsed ? "overflow-x-hidden px-2" : "px-3"
        )}
        aria-label={t("sidebar.sectionsNav")}
      >
        {navSections.map((section: NavSection) => {
          const key = section.labelKey ?? ""
          const open = openSections[key] ?? true

          return (
            <div key={key} className="mb-3 last:mb-0">
              {section.labelKey && !collapsed && (
                <SectionHeader
                  label={t(section.labelKey)}
                  open={open}
                  onToggle={() => toggleSection(key)}
                  t={t}
                />
              )}
              {/* Collapsed rails drop section labels and show a divider (§5.10) */}
              {section.labelKey && collapsed && (
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
          <SignOutButton collapsed={collapsed} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Public shell — fixed rail ≥1024px, off-canvas drawer below (§18.2)
 * ------------------------------------------------------------------ */

export function Sidebar() {
  const t = useT()
  const rtl = useDir() === "rtl"
  const { collapsed, setCollapsed, drawerOpen, setDrawerOpen } = useShell()
  const pathname = useLocalePathname()

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
            aria-label={t("sidebar.navigation")}
            className={cn(
              "absolute inset-y-0 w-[280px] shadow-[0_24px_64px_rgba(0,0,0,0.16)] animate-in duration-200",
              // The drawer belongs on the reading-start edge, and has to fly
              // in from the edge it lives on. `start-0` handles the resting
              // position; the slide has no logical form, so it is branched.
              "start-0",
              rtl ? "slide-in-from-right" : "slide-in-from-left"
            )}
          >
            <IconButton
              label={t("sidebar.closeNavigation")}
              onClick={() => setDrawerOpen(false)}
              className="absolute end-2 top-4 z-10"
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
  const t = useT()
  const { setDrawerOpen } = useShell()

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label={t("sidebar.openNavigation")}
      className={cn(
        // 44px touch target below lg, per §18.7.
        "-ms-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md lg:hidden",
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
