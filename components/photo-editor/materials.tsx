"use client"

import * as React from "react"

import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The editor's three materials, and the controls made from them.
 *
 *   Ground — the work sits on it, nothing else.
 *   Float  — a slab above the ground: ring + shadow, 16px radius.
 *   Well   — a groove cut into a slab. **One-of-N controls only.**
 *
 * A new control's design is settled by deciding which of the three it belongs
 * to; there is no fourth. Keeping that rule is the whole reason this file
 * exists rather than the classes being inlined at each call site.
 *
 * This is the one surface in the app that departs from DESIGN.md §1.5 — see
 * the token block in app/globals.css for why, and for the scope of it.
 */

export function Float({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[var(--editor-float)] shadow-[var(--editor-shadow)]",
        className
      )}
      {...props}
    />
  )
}

export function Well({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[11px] bg-[var(--editor-well)] p-0.5",
        className
      )}
      {...props}
    />
  )
}

/**
 * Vertical hairline between groups inside a slab.
 *
 * The block margin is a class rather than an inline style so a caller with a
 * shorter row can shorten the rule — an inline style could not be overridden.
 */
export function Divider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("mx-1 my-[7px] w-px shrink-0 self-stretch bg-[var(--editor-line)]", className)}
    />
  )
}

/**
 * Icon button.
 *
 * The pressed state is a **white chip with a ring**, not a grey fill: it sits
 * on a slab that is already white, so only the ring makes it read as raised.
 */
export function IconButton({
  icon: Icon,
  label,
  pressed,
  tone = "default",
  size = "md",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** Accessible name, and the tooltip text the caller renders. */
  label: string
  pressed?: boolean
  tone?: "default" | "danger"
  size?: "sm" | "md"
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[9px] text-text-secondary",
        "transition-[background-color,color,box-shadow] duration-120 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "hover:bg-[var(--editor-hover)] hover:text-text active:bg-[var(--editor-press)]",
        "disabled:pointer-events-none disabled:opacity-35",
        size === "sm" ? "size-6 rounded-[7px]" : "size-[30px]",
        pressed &&
          "bg-[var(--editor-float)] text-text shadow-[var(--editor-shadow-chip)]",
        tone === "danger" && "hover:bg-danger-bg hover:text-danger",
        className
      )}
      {...props}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={1.8} />
    </button>
  )
}

/**
 * A dropdown trigger with no border and no fill at rest — the label *is* the
 * control. Numbers go mono and tabular so the bar never reflows as digits
 * change under the cursor.
 */
export function Chip({
  label,
  sub,
  mono,
  open,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  label: string
  sub?: string
  mono?: boolean
  open?: boolean
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      className={cn(
        "inline-flex h-[30px] min-w-0 shrink-0 items-center gap-1.5 rounded-[9px] pe-1.5 ps-2.5",
        "text-[13px] font-medium whitespace-nowrap text-text",
        "transition-colors duration-120 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "hover:bg-[var(--editor-hover)]",
        open && "bg-[var(--editor-press)]",
        mono && "font-mono text-xs tabular-nums",
        className
      )}
      {...props}
    >
      {/* Truncates rather than widening: a long font name must not be allowed
          to set the width of the bar it sits in. */}
      <span className="min-w-0 truncate">{label}</span>
      {sub && <span className="truncate font-normal text-text-muted">· {sub}</span>}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="ms-auto size-3 shrink-0 text-text-placeholder"
      >
        <path d="m7 10 5 5 5-5" />
      </svg>
    </button>
  )
}

/** Circular, so it never reads as a button. Open state gets a gapped ring. */
export function Swatch({
  color,
  label,
  open,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  color: string
  label: string
  open?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      style={{ background: color }}
      className={cn(
        "size-[26px] shrink-0 rounded-full outline-none",
        "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]",
        "transition-transform duration-120 hover:scale-105",
        "focus-visible:ring-2 focus-visible:ring-ring",
        open &&
          "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14),0_0_0_2px_var(--editor-float),0_0_0_4px_var(--color-accent-violet)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Display form for a geometry number.
 *
 * Integers print bare; anything else keeps up to two decimals with the trailing
 * zeros trimmed, so `12.5` stays `12.5` and `12.50000000001` — which is what
 * floating-point arithmetic on a scaled drag actually produces — does not eat
 * the whole field.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100)
}

/**
 * A geometry field: a two-character key and its value, in one 30px control.
 *
 * ### Fixed width, on purpose
 *
 * It used to size itself to an invisible twin holding the widest expected
 * value, which is the right instinct for a field standing on its own and the
 * wrong one for a field in a row of five. Intrinsic widths made `X`, `Y`, `W`
 * and `H` disagree by a few pixels each, and — worse — made the whole property
 * bar's width a function of the numbers in it, so the bar breathed as an
 * element was dragged. A row of fields wants *one* width, declared by the
 * caller, which is also what lets the bar's fit model (property-bar.tsx) know
 * its own width without measuring anything.
 *
 * Values wider than the field scroll inside the input rather than clipping the
 * control, and `title` carries the full value for the rare four-plus-digit case.
 *
 * ### No box at rest
 *
 * The well appears on hover and focus only. Five filled pills in a row read as
 * five buttons; five bare numbers separated by hairlines read as a readout,
 * which is what this is.
 *
 * ### Keyboard
 *
 * ↑/↓ step by `step` (×10 with Shift), Enter commits and releases focus, Escape
 * restores the value the field had when it was focused. Typing still commits
 * live, so a drag or a nudge elsewhere keeps the number in sync.
 */
export function NumberField({
  fieldKey,
  label,
  value,
  onCommit,
  step = 1,
  width = 60,
  className,
}: {
  /** The one- or two-character key printed inside the field. */
  fieldKey: string
  /** Accessible name — the key alone is not one. */
  label: string
  value: number
  onCommit: (value: number) => void
  step?: number
  /** Total control width in px. Keep every field in a group on one number. */
  width?: number
  className?: string
}) {
  /**
   * `null` means "not being typed in" — the model is shown directly, so a drag
   * or an arrow-key nudge updates the number live. A draft only exists while
   * the field has focus, which is also why no effect is needed to sync them.
   */
  const [draft, setDraft] = React.useState<string | null>(null)
  /** The value at the moment of focus, so Escape has something to go back to. */
  const entry = React.useRef(value)
  /**
   * Escape blurs the field, and `blur()` runs its handler *synchronously* —
   * before React has processed the `setDraft(null)` on the line above it.
   * Without this flag the blur handler still sees the abandoned draft and
   * commits the very value Escape just threw away.
   */
  const cancelling = React.useRef(false)
  const shown = draft ?? formatNumber(value)

  return (
    <label
      title={`${label} · ${shown}`}
      style={{ width }}
      className={cn(
        "flex h-[30px] shrink-0 items-center gap-1 rounded-[9px] px-1.5",
        "transition-colors duration-120 hover:bg-[var(--editor-well)]",
        "focus-within:bg-[var(--editor-well)] focus-within:ring-2 focus-within:ring-ring",
        className
      )}
    >
      <span
        aria-hidden
        className="shrink-0 text-[10px] leading-none font-semibold tracking-[0.04em] text-text-placeholder"
      >
        {fieldKey}
      </span>
      <input
        aria-label={label}
        value={shown}
        inputMode="decimal"
        onFocus={(e) => {
          entry.current = value
          setDraft(formatNumber(value))
          e.currentTarget.select()
        }}
        onBlur={() => {
          if (cancelling.current) {
            cancelling.current = false
            setDraft(null)
            return
          }
          const n = Number(draft)
          if (draft !== null && draft.trim() !== "" && Number.isFinite(n)) onCommit(n)
          setDraft(null)
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          // Commit as you type, but only once the text is a number — "-",
          // "1." and "" are all mid-typing states, not values.
          const raw = e.target.value.trim()
          const n = Number(raw)
          if (raw !== "" && Number.isFinite(n)) onCommit(n)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault()
            const delta = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? step * 10 : step)
            const next = Math.round((Number(shown) || 0) * 100 + delta * 100) / 100
            setDraft(formatNumber(next))
            onCommit(next)
          } else if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === "Escape") {
            e.preventDefault()
            cancelling.current = true
            onCommit(entry.current)
            setDraft(null)
            e.currentTarget.blur()
          }
        }}
        className={cn(
          "w-full min-w-0 flex-1 border-0 bg-transparent p-0",
          "font-mono text-[11.5px] tabular-nums text-text outline-none"
        )}
      />
    </label>
  )
}

/** A full-width text/textarea/select well, used throughout the panels. */
export function Field({
  className,
  locked,
  ...props
}: React.ComponentProps<"div"> & { locked?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-8 w-full items-center rounded-[9px] bg-[var(--editor-well)] px-2.5",
        "transition-shadow duration-120 focus-within:ring-2 focus-within:ring-ring",
        locked && "pointer-events-none opacity-55",
        className
      )}
      {...props}
    />
  )
}

export function FieldLabel({
  children,
  required,
  locked,
}: {
  children: React.ReactNode
  required?: boolean
  locked?: boolean
}) {
  const t = useT()

  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-text-placeholder uppercase">
      {children}
      {required && <span className="text-xs text-danger">*</span>}
      {locked && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="size-3"
          aria-label={t("editor.lockedByType")}
        >
          <rect x="4.6" y="10.5" width="14.8" height="9.9" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      )}
    </div>
  )
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11.5px] leading-normal text-text-muted">{children}</p>
}

export function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "danger"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-[11px] px-3 py-2.5 text-[12.5px] leading-normal text-text-secondary",
        tone === "info"
          ? "bg-info-bg shadow-[inset_0_0_0_1px_var(--color-accent-border)]"
          : "bg-danger-bg shadow-[inset_0_0_0_1px_rgba(220,38,38,0.22)]"
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("mt-px size-4 shrink-0", tone === "info" ? "text-info" : "text-danger")}
      >
        {tone === "info" ? (
          <>
            <circle cx="12" cy="12" r="8.6" />
            <path d="M12 11v5M12 8h.01" />
          </>
        ) : (
          <>
            <path d="M12 8.5v5M12 17h.01" />
            <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3l-7.7-13.5a2 2 0 0 0-3.4 0Z" />
          </>
        )}
      </svg>
      <div>{children}</div>
    </div>
  )
}

/** A small state tag. `tone` encodes a rule, never emphasis. */
export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "data" | "warn" | "ok"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center gap-1 rounded-md px-1.5",
        "font-mono text-[10px] tracking-[0.02em] whitespace-nowrap",
        tone === "neutral" && "bg-[var(--editor-well)] text-text-muted",
        tone === "data" && "bg-info-bg text-info",
        tone === "warn" && "bg-warning-bg text-warning",
        tone === "ok" && "bg-success-bg text-success"
      )}
    >
      {children}
    </span>
  )
}

export function Toggle({
  checked,
  onToggle,
  title,
  description,
  locked,
}: {
  checked: boolean
  onToggle: () => void
  title: string
  description: string
  locked?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={locked}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-2.5 rounded-[10px] bg-[var(--editor-well)] px-2.5 py-2.5 text-start",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        locked && "pointer-events-none opacity-50"
      )}
    >
      <span>
        <span className="block text-[12.5px] font-medium text-text">{title}</span>
        <span className="mt-px block text-[11px] text-text-muted">{description}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-accent-violet" : "bg-[var(--editor-press)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 start-0.5 size-4 rounded-full bg-[var(--editor-float)]",
            "shadow-[var(--editor-shadow-chip)] transition-transform duration-150",
            // The knob travels towards the trailing edge, which is leftwards
            // in an RTL document — so the translate has to reverse with it.
            checked && "translate-x-3.5 rtl:-translate-x-3.5"
          )}
        />
      </span>
    </button>
  )
}

/** Section rule inside a panel — label, hairline, count. */
export function SubHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="mt-3.5 mb-1.5 flex items-center gap-2">
      <span className="text-[10.5px] font-semibold tracking-[0.06em] text-text-placeholder uppercase">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--editor-line)]" />
      <span className="font-mono text-[10px] text-text-placeholder">{count}</span>
    </div>
  )
}
