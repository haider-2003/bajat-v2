"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"

import {
  groupPermissions,
  humanize,
  type PermissionGroup,
} from "@/features/permissions/utils"
import type { Permission } from "@/features/roles/types"
import { useI18n, useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The role editor's permission picker — DESIGN.md §10.6 for the checkbox, §10.10
 * for the field it sits in.
 *
 * ### Why a grid of chips rather than a flat checkbox list
 *
 * `GET /permission` returns ~120 rows whose only structure is the name. A flat
 * column of 120 checkboxes is a list nobody can audit — the question a role
 * editor is asked is "what can this role do to members?", and answering it
 * means the names have to be grouped by the thing they act on.
 * `groupPermissions` (features/permissions/utils.ts) does that split; this
 * renders one row per entity with one toggle per action.
 *
 * ### The id is the value, the name only decides where it is drawn
 *
 * The parse is lossy on purpose — a mis-grouped permission is a cosmetic bug,
 * never a wrong grant, because the chip carries `permission.id` and nothing
 * about the parse is ever sent back.
 *
 * ### Labels come from the dictionary, with a slug fallback
 *
 * New permissions ship with the backend, not this app, so an action or entity
 * the dictionary has no entry for still has to render as something a reader can
 * act on — `humanize` turns the raw slug into a sentence rather than leaving a
 * blank checkbox.
 */

/** `change-status` → `changeStatus`, to match the dictionary's key casing. */
function camel(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

type GroupState = "none" | "some" | "all"

export function PermissionTree({
  permissions,
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
}: {
  permissions: Permission[]
  /** Selected permission ids, as strings. */
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const t = useT()
  const { dict } = useI18n()

  const actionLabels = dict.permissions.actions as Record<string, string>
  const entityLabels = dict.permissions.entities as Record<string, string>

  const groups = React.useMemo<PermissionGroup[]>(
    () => groupPermissions(permissions),
    [permissions]
  )
  const selected = React.useMemo(() => new Set(value), [value])

  const allIds = React.useMemo(
    () =>
      groups.flatMap((group) =>
        group.permissions.map((entry) => String(entry.permission.id))
      ),
    [groups]
  )

  const setMany = (ids: string[], on: boolean) => {
    const next = new Set(value)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    onChange([...next])
  }

  const groupStateOf = (ids: string[]): GroupState => {
    const on = ids.filter((id) => selected.has(id)).length
    if (on === 0) return "none"
    return on === ids.length ? "all" : "some"
  }

  const allOn = allIds.length > 0 && allIds.every((id) => selected.has(id))

  return (
    <div
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(
        "overflow-hidden rounded-lg border",
        invalid ? "border-danger" : "border-border"
      )}
    >
      {/* Toolbar — the running count, and the two bulk actions §10.6 asks for. */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background-subtle px-3 py-2">
        <span className="text-xs text-text-muted">
          {t("roles.permissionCount", { count: value.length })}
        </span>
        <div className="flex items-center gap-1">
          <BulkButton
            disabled={disabled || allOn || allIds.length === 0}
            onClick={() => setMany(allIds, true)}
          >
            {t("roles.form.selectAll")}
          </BulkButton>
          <BulkButton
            disabled={disabled || value.length === 0}
            onClick={() => onChange([])}
          >
            {t("roles.form.clearAll")}
          </BulkButton>
        </div>
      </div>

      <div className="max-h-[min(48vh,420px)] overflow-y-auto scrollbar-quiet">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-text-muted">
            {t("roles.form.permissionsEmpty")}
          </p>
        ) : (
          groups.map((group) => {
            const ids = group.permissions.map((entry) =>
              String(entry.permission.id)
            )
            const state = groupStateOf(ids)
            const entityLabel =
              entityLabels[camel(group.entity)] ?? humanize(group.entity)
            const onCount = ids.filter((id) => selected.has(id)).length

            return (
              <div
                key={group.entity}
                className="border-b border-border-subtle px-3 py-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <TriToggle
                    state={state}
                    disabled={disabled}
                    label={t("roles.form.selectGroup", { entity: entityLabel })}
                    onClick={() => setMany(ids, state !== "all")}
                  />
                  <span className="text-[13px] font-medium text-text">
                    {entityLabel}
                  </span>
                  <span className="text-[11px] tabular-nums text-text-muted">
                    {onCount}/{ids.length}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 ps-[26px]">
                  {group.permissions.map((entry) => {
                    const id = String(entry.permission.id)
                    const checked = selected.has(id)
                    const actionLabel =
                      actionLabels[camel(entry.action)] ??
                      humanize(entry.action)
                    return (
                      <button
                        key={id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        disabled={disabled}
                        onClick={() => setMany([id], !checked)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[13px]",
                          "transition-colors duration-120 outline-none",
                          "focus-visible:ring-2 focus-visible:ring-ring",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          checked
                            ? "border-accent-violet bg-accent-soft text-text"
                            : "border-border text-text-secondary hover:border-border-strong hover:text-text"
                        )}
                      >
                        {checked && (
                          <Check
                            className="size-3 shrink-0 text-accent-violet"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                        )}
                        {actionLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function BulkButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xs px-1.5 py-0.5 text-[11px] font-medium text-text-secondary",
        "transition-colors hover:text-text outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:text-text-placeholder disabled:hover:text-text-placeholder"
      )}
    >
      {children}
    </button>
  )
}

/** A three-state box: empty / dash (partial) / check (all). */
function TriToggle({
  state,
  disabled,
  label,
  onClick,
}: {
  state: GroupState
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border",
        "transition-colors duration-120 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        state === "none"
          ? "border-input"
          : "border-accent-violet bg-accent-violet text-white"
      )}
    >
      {state === "all" && <Check className="size-3" strokeWidth={3} aria-hidden />}
      {state === "some" && <Minus className="size-3" strokeWidth={3} aria-hidden />}
    </button>
  )
}
