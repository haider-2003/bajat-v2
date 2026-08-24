import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Settings page primitives — DESIGN.md §9 (cards) + §10.10/§10.11 (forms).
 *
 * A settings section is a **list card** (§9.5): the header sits inside the
 * card's 20px padding, then the rows run full-bleed to the card's inner edges
 * with 1px `--border-subtle` separators between them (§9.3).
 *
 * Rows are label-left / control-right. Below `sm` they stack, because a 36px
 * control and a two-line description cannot share a 320px row without one of
 * them being crushed (§18.6).
 *
 * Both pieces are presentational and server-renderable — a row's control is
 * whatever client component gets passed in, so only the interactive leaf needs
 * `"use client"`.
 */

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  /** Anchor target, so a section can be linked to directly. */
  id?: string
  icon?: LucideIcon
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        // §9.1 — 12px radius, hairline border, no shadow.
        "overflow-hidden rounded-lg border border-border bg-surface",
        "scroll-mt-20",
        className
      )}
    >
      <header className="flex items-start gap-3 p-5">
        {Icon && (
          // §9.2 icon tile — 28px rounded square, quiet neutral fill.
          <span
            aria-hidden
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-secondary"
          >
            <Icon className="size-4" strokeWidth={1.5} />
          </span>
        )}
        <div className="min-w-0">
          <h2
            id={id ? `${id}-title` : undefined}
            className="text-base font-semibold tracking-[-0.01em] text-text"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              {description}
            </p>
          )}
        </div>
      </header>

      {/* Rows are full-bleed; the separator is the row's own top border. */}
      <div className="border-t border-border-subtle">{children}</div>
    </section>
  )
}

export function SettingsRow({
  label,
  description,
  control,
  htmlFor,
  className,
}: {
  label: string
  description?: string
  /** The interactive half of the row, right-aligned on `sm` and up. */
  control: React.ReactNode
  /** Set when the control is a single labelable element. */
  htmlFor?: string
  className?: string
}) {
  const Label = htmlFor ? "label" : "span"

  return (
    <div
      className={cn(
        // §9.3 list rows: separators between, never above the first row.
        "flex flex-col gap-3 border-t border-border-subtle px-5 py-4 first:border-t-0",
        "sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0">
        <Label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium text-text"
        >
          {label}
        </Label>
        {description && (
          // §10.10 helper text — 12px muted, 6px below the label.
          <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 sm:flex sm:justify-end">{control}</div>
    </div>
  )
}

/**
 * A full-width row for content that has no right-hand control — a preview, a
 * note, an embedded panel. Keeps the same gutters as `SettingsRow`.
 */
export function SettingsBlock({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-t border-border-subtle px-5 py-4 first:border-t-0",
        className
      )}
    >
      {children}
    </div>
  )
}
