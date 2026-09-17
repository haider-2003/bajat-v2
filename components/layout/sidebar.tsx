"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  ChevronDown,
  Menu,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  X,
} from "lucide-react"

import { BajatMark } from "@/components/brand/bajat-mark"
import { useDir, useT } from "@/i18n/context"
import { Link, useLocalePathname } from "@/i18n/navigation"
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

import { SidebarSearchDialog } from "./sidebar-search-dialog"
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
 * Travelling highlight
 * ------------------------------------------------------------------ */

/**
 * Which row the pointer is over, and which list it lives in.
 *
 * The zone matters because each list draws its own highlight: pointing at
 * something in the footer must not drag the chip out of the scrolling section
 * list, it should just light the footer row and leave the active one where it
 * is.
 */
type HoveredRow = { zone: string; key: string } | null

/**
 * One chip per list, moved rather than redrawn.
 *
 * The active row used to own `chip.face` outright and every other row faded a
 * flat hover fill in and out underneath the cursor, so crossing the rail read
 * as a row of lights blinking on and off. Here a single element carries the
 * face and slides between rows: it rests on the current page, follows the
 * pointer while it is over the list, and returns when it leaves.
 *
 * It is measured rather than styled into place because the rows are not a
 * uniform height — a group's children are 32px against a leaf's 34 — so the
 * chip animates its height along with its offset.
 *
 * Rows are found by walking `[data-nav-key]` rather than with an attribute
 * selector: the keys are hrefs, and quoting those into a selector is a escaping
 * problem with no upside.
 *
 * The list it measures against is its own parent, read off the DOM rather
 * than handed in as a ref: React attaches refs child-first, so on mount this
 * layout effect runs *before* the parent's ref exists, and a chip that waited
 * on one never placed itself until the first hover moved `litKey`. The DOM
 * itself is complete by then — every row is already in it — so the parent is
 * simply there to be read.
 */
function NavHighlight({
  litKey,
  pathname,
  face,
}: {
  litKey: string | null
  /** Not read — a dependency, so the chip re-measures when the current row moves. */
  pathname: string
  face: string
}) {
  const chipRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const chip = chipRef.current
    const container = chip?.parentElement
    if (!container || !chip) return

    const place = () => {
      const rows = Array.from(
        container.querySelectorAll<HTMLElement>("[data-nav-key]")
      )
      const row = litKey
        ? rows.find((r) => r.dataset.navKey === litKey)
        : rows.find((r) => r.hasAttribute("data-nav-current"))

      if (!row) {
        chip.style.opacity = "0"
        return
      }

      const c = container.getBoundingClientRect()
      const r = row.getBoundingClientRect()

      // The first placement is a jump, not a slide: without this the chip
      // flies in from the top of the list on every mount. Suppress the
      // transition, commit the position, then hand it back.
      const first = chip.dataset.placed !== "true"
      if (first) chip.style.transition = "none"

      chip.style.transform = `translateY(${r.top - c.top}px)`
      chip.style.height = `${r.height}px`
      chip.style.opacity = "1"

      if (first) {
        // Reading a layout property flushes both writes above while the
        // transition is still off, so they are not what ends up animating.
        void chip.offsetHeight
        chip.style.transition = ""
        chip.dataset.placed = "true"
      }
    }

    place()

    // Rows shift when a group opens, a section collapses, the rail narrows or
    // a webfont lands. Watching the container covers all four.
    const observer = new ResizeObserver(place)
    observer.observe(container)
    return () => observer.disconnect()
  }, [litKey, pathname])

  // Position, height and opacity are written straight to the node above; the
  // classes only supply the material and the easing.
  return (
    <div
      ref={chipRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-0 rounded-md opacity-0",
        "transition-[transform,height,opacity] duration-200 ease-out",
        "motion-reduce:transition-none",
        face
      )}
    />
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
  zone,
  hovered,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  chip: ControlSurface
  zone: string
  hovered: HoveredRow
}) {
  const t = useT()
  const Icon = item.icon
  const label = t(item.labelKey)
  const ref = React.useRef<HTMLAnchorElement>(null)
  // The chip is under this row when the pointer is on it, or when the pointer
  // is somewhere else entirely and this is the page you are on.
  const lit = hovered?.key === item.href || (active && hovered?.zone !== zone)

  return (
    <Link
      ref={ref}
      href={item.href}
      aria-current={active ? "page" : undefined}
      data-nav-key={item.href}
      data-nav-current={active ? "" : undefined}
      className={cn(
        // `relative` keeps the row above the highlight, which is an earlier
        // sibling and would otherwise paint over it.
        "group/item relative flex h-nav-item items-center gap-2.5 rounded-md px-2.5",
        "text-sm font-medium transition-colors duration-120",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        collapsed && "justify-center px-0",
        // No fill here any more — `NavHighlight` carries it.
        lit ? chip.faceText : "text-text-secondary"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          // Icons sit one contrast step lighter than their label (§15.3).
          lit ? "text-current" : "text-text-muted"
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
  zone,
  hovered,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  chip: ControlSurface
  zone: string
  hovered: HoveredRow
}) {
  const t = useT()
  const childActive = item.children?.some((c) => c.href === pathname) ?? false
  const Icon = item.icon

  // Open state is derived, not synced: a group holding the active route is
  // open unless the user has explicitly toggled it since.
  const [override, setOverride] = React.useState<boolean | null>(null)
  const open = override ?? childActive
  const headerLit =
    hovered?.key === item.href ||
    (childActive && !open && hovered?.zone !== zone)

  if (collapsed) {
    return (
      <NavLeaf
        item={item}
        active={childActive}
        collapsed
        chip={chip}
        zone={zone}
        hovered={hovered}
      />
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        data-nav-key={item.href}
        // A closed group standing in for the child you are on is the row that
        // holds the chip; once it opens, the child itself takes it.
        data-nav-current={childActive && !open ? "" : undefined}
        className={cn(
          "group/item relative flex h-nav-item w-full items-center gap-2.5 rounded-md px-2.5",
          "text-sm font-medium transition-colors duration-120",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
          headerLit ? chip.faceText : "text-text-secondary"
        )}
      >
        <Icon
          className={cn(
            "size-4 shrink-0 transition-colors",
            headerLit ? "text-current" : "text-text-muted"
          )}
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
            const childLit =
              hovered?.key === child.href || (active && hovered?.zone !== zone)
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={active ? "page" : undefined}
                data-nav-key={child.href}
                data-nav-current={active ? "" : undefined}
                className={cn(
                  // Child text aligns under the parent's text, not its icon (§5.7).
                  // Logical padding, so the indent moves to the right edge
                  // under RTL instead of stranding the labels mid-rail.
                  "relative flex h-8 items-center rounded-md ps-[38px] pe-2.5 text-sm transition-colors duration-120",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                  childLit
                    ? `font-medium ${chip.faceText}`
                    : "font-normal text-text-secondary"
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
  onClose,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  /** Drawer only — takes the collapse toggle's slot as the one close control. */
  onClose?: () => void
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

      {onClose ? (
        // The drawer cannot collapse, so the toggle's slot holds its close
        // control instead. Floating a separate X over the header left two
        // buttons in the corner, one of which did nothing.
        <IconButton label={t("sidebar.closeNavigation")} onClick={onClose}>
          <X className="size-4" strokeWidth={1.5} />
        </IconButton>
      ) : (
        <IconButton label={t("sidebar.collapse")} onClick={onToggleCollapse}>
          <PanelLeft data-flip-rtl className="size-4" strokeWidth={1.5} />
        </IconButton>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Zone 2 — search field, sunken fill + keyboard hint (§6.7)
 * ------------------------------------------------------------------ */

function SidebarSearch({
  collapsed,
  onOpen,
}: {
  collapsed: boolean
  onOpen: () => void
}) {
  const t = useT()

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 pb-2">
        <IconButton
          label={t("common.search")}
          onClick={onOpen}
          className="size-nav-item"
        >
          <Search className="size-4" strokeWidth={1.5} />
        </IconButton>
      </div>
    )
  }

  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={onOpen}
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
  onOpenSearch,
  onClose,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenSearch: () => void
  /** Drawer only — the body shows a close control and closes after a pick. */
  onClose?: () => void
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

  // One pointer, so one hovered row for the whole rail. The zone it came from
  // decides which list's chip moves and which keeps sitting on its own row.
  const [pointed, setPointed] = React.useState<HoveredRow>(null)

  /**
   * The row a click or tap just chose, held lit until its route arrives.
   *
   * A touch fires `pointerleave` the moment the finger lifts, before the
   * click — so without this the chip lit the tapped row, slid straight back
   * to the page you were *leaving*, and sat there for as long as the new
   * page took to load. Tagged with the pathname it was picked on: the shell
   * mounts per page so the state resets on its own, but should it ever not,
   * the hold still ends the instant the route changes.
   */
  const [picked, setPicked] = React.useState<
    (NonNullable<HoveredRow> & { from: string }) | null
  >(null)
  const held = picked?.from === pathname ? picked : null
  // What the lists light: the pointer wins while it is over a row, then the
  // held pick, then nothing — at which point each chip rests on its own
  // current row.
  const hovered: HoveredRow = pointed ?? held

  /**
   * `pointerover` bubbles, so one handler per list is enough.
   *
   * A miss is ignored rather than cleared: the 2px gaps between rows would
   * otherwise bounce the chip back to the active row and out again on every
   * crossing, which is the flicker this whole thing is meant to remove. Only
   * leaving the list clears it.
   */
  const onRowOver = (zone: string) => (e: React.PointerEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-nav-key]")
    const key = row?.dataset.navKey
    if (key) setPointed({ zone, key })
  }
  const clearHover = () => setPointed(null)

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  /**
   * A click on a nav link. Delegated, like the hover handling: every link in
   * the body is a nav link.
   *
   * Holds the chip on the row that was picked (see `picked`), and — drawer
   * only — closes the drawer when the tap is for the page you are already
   * on. Every other pick leaves the drawer up: it closes when the route
   * changes (the pathname check in `Sidebar`), so the lit row stands as the
   * "on its way" signal for as long as the new page takes, rather than the
   * drawer vanishing to show the old page doing nothing. The same-page tap
   * changes no route, so it is the one case that has to close on the tap.
   */
  const onPick = (e: React.MouseEvent) => {
    // A modified click opens a new tab and leaves this page — and its drawer —
    // where they are.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const target = e.target as HTMLElement
    if (!target.closest("a[href]")) return
    const row = target.closest<HTMLElement>("[data-nav-key]")
    const zone = row?.closest<HTMLElement>("[data-nav-zone]")?.dataset.navZone
    const key = row?.dataset.navKey
    if (key && zone) setPicked({ zone, key, from: pathname })
    if (onClose && key === pathname) onClose()
  }

  // Stable, so it runs once per mount rather than on every render. Children
  // are already attached by the time a parent's ref fires, so the element has
  // its full scroll height and the offset lands rather than clamping to 0.
  const restoreRailScroll = React.useCallback((el: HTMLElement | null) => {
    if (el) el.scrollTop = railScrollTop
  }, [])

  const renderItem = (item: NavItem, zone: string) =>
    item.children?.length ? (
      <NavGroup
        key={item.href}
        item={item}
        pathname={pathname}
        collapsed={collapsed}
        chip={chip}
        zone={zone}
        hovered={hovered}
      />
    ) : (
      <NavLeaf
        key={item.href}
        item={item}
        active={pathname === item.href}
        collapsed={collapsed}
        chip={chip}
        zone={zone}
        hovered={hovered}
      />
    )

  return (
    <div
      data-collapsed={collapsed}
      className="flex h-full min-h-0 flex-col bg-sidebar"
      onClick={onPick}
    >
      {/* Zones 1–3 are fixed; only zone 4 scrolls. */}
      <div className="shrink-0">
        <WorkspaceSwitcher
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onClose={onClose}
        />
        <SidebarSearch collapsed={collapsed} onOpen={onOpenSearch} />

        {/* Zone 3 — primary nav */}
        <nav
          className={cn(collapsed ? "px-2" : "px-3")}
          aria-label={t("sidebar.primaryNav")}
        >
          <div
            data-nav-zone="primary"
            className="relative flex flex-col gap-0.5"
            onPointerOver={onRowOver("primary")}
            onPointerLeave={clearHover}
          >
            <NavHighlight
              litKey={hovered?.zone === "primary" ? hovered.key : null}
              pathname={pathname}
              face={chip.face}
            />
            {primaryNav.map((item) => renderItem(item, "primary"))}
          </div>
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
        <div
          data-nav-zone="sections"
          className="relative"
          onPointerOver={onRowOver("sections")}
          onPointerLeave={clearHover}
        >
          <NavHighlight
            litKey={hovered?.zone === "sections" ? hovered.key : null}
            pathname={pathname}
            face={chip.face}
          />
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
                  {section.items.map((item) => renderItem(item, "sections"))}
                </div>
              )}
            </div>
            )
          })}
        </div>
      </nav>

      {/* Zone 5 — footer, pinned outside the scroll region */}
      <div className={cn("shrink-0 pb-3", collapsed ? "px-2" : "px-3")}>
        <div className="mb-2 h-px bg-border" />
        <div
          data-nav-zone="footer"
          className="relative flex flex-col gap-0.5"
          onPointerOver={onRowOver("footer")}
          onPointerLeave={clearHover}
        >
          <NavHighlight
            litKey={hovered?.zone === "footer" ? hovered.key : null}
            pathname={pathname}
            face={chip.face}
          />
          {footerNav.map((item) => renderItem(item, "footer"))}
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

  // ⌘K / Ctrl-K, owned here rather than in `SidebarSearch`: the rail and the
  // mobile drawer both render a body, and two listeners would race to open two
  // dialogs the moment the drawer is up.
  const [searchOpen, setSearchOpen] = React.useState(false)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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
          onOpenSearch={() => setSearchOpen(true)}
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
            <SidebarBody
              collapsed={false}
              onToggleCollapse={() => {}}
              onOpenSearch={() => setSearchOpen(true)}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Rendered once, outside both bodies. Navigating out of it closes the
          drawer on its own — the pathname check above does that. */}
      <SidebarSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
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
