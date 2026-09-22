"use client"

import * as React from "react"
import { Plus, Search, X } from "lucide-react"

import { TextFilter } from "@/components/filters"
import { CreateNodeDialog } from "@/components/nodes/node-dialog"
import { NodePill } from "@/components/nodes/node-swatch"
import { LoadFailed } from "@/components/table/load-states"
import { Skeleton } from "@/components/ui/skeleton"
import type { Node } from "@/features/nodes/types"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

import type { FlowDragSource } from "./use-flow-drag"

/**
 * The step library — everything this organization can put in a flow, and the
 * place new steps are made.
 *
 * ### It is the node CRUD screen's list, not a copy of it
 *
 * The rows come from the same `GET /node` the `/nodes` screen pages through,
 * and "Add step" mounts that screen's own `CreateNodeDialog` behind a
 * different trigger. A second create form here would be a second set of
 * validation rules for one endpoint, drifting from the day it was written.
 * What is different is the *shape* of a row: there, a node is a record with a
 * colour and an owner; here it is a thing you pick up.
 *
 * ### Two groups, and the split is the useful part
 *
 * "In this flow" and "Available" is not decoration. The question this rail is
 * opened to answer is almost always "what have I not added yet", and a flat
 * alphabetical list makes that a manual diff against the canvas. A step
 * already in the chain stays pickable — a flow may legitimately return to the
 * same desk twice — but it is filed where you can see that it is a repeat.
 *
 * ### Two ways to place a step, deliberately
 *
 * Dragging a row onto a gap is the fast path and the one this kind of canvas
 * is known for. It is also unavailable on touch and to a keyboard, so
 * *pressing* a row is the real control: it appends to the end of the chain,
 * or — if a gap on the canvas has been armed with its `+` — drops into that
 * gap instead. Neither path is a fallback; see `flow-canvas.tsx`.
 */

export type NodePaletteProps = {
  nodes: Node[]
  /**
   * The organization the list is scoped to, so a step created from the rail
   * is created *into* that scope. Without it an admin's new step lands in
   * whichever organization they happened to pick and then does not come back
   * in the scoped list — created, saved, and invisible on the screen that
   * made it. `undefined` on a global template, where the token decides.
   */
  organizationId?: number
  loading: boolean
  /** The library request's error, or `null` when it succeeded. */
  error: unknown
  retrying: boolean
  onRetry: () => void
  query: string
  onQueryChange: (value: string) => void
  /** How many times each node id appears in the current chain. */
  usedCounts: Map<number, number>
  /** The armed gap, so the rail can say where a pick will land. */
  armedIndex: number | null
  onCancelArm: () => void
  onPick: (node: Node) => void
  /** Picks a step up out of the rail. See `use-flow-drag.ts`. */
  onDragStart: (event: React.PointerEvent, source: FlowDragSource) => void
  /** True when the press now ending was a drag, so the click is ignored. */
  consumeClick: () => boolean
  /** `sheet` adds a close button and drops the rail's own border. */
  variant?: "rail" | "sheet"
  onClose?: () => void
}

export function NodePalette({
  nodes,
  organizationId,
  loading,
  error,
  retrying,
  onRetry,
  query,
  onQueryChange,
  usedCounts,
  armedIndex,
  onCancelArm,
  onPick,
  onDragStart,
  consumeClick,
  variant = "rail",
  onClose,
}: NodePaletteProps) {
  const t = useT()

  const [used, available] = React.useMemo(() => {
    const inFlow: Node[] = []
    const rest: Node[] = []
    for (const node of nodes) {
      ;(usedCounts.get(node.id) ? inFlow : rest).push(node)
    }
    return [inFlow, rest]
  }, [nodes, usedCounts])

  const failed = error != null
  const empty = !loading && !failed && nodes.length === 0
  const searching = query.trim().length > 0

  return (
    <aside
      aria-label={t("flow.paletteLabel")}
      className={cn(
        "flex w-80 shrink-0 flex-col bg-surface",
        variant === "rail" && "border-e border-border",
        variant === "sheet" && "h-full w-[min(340px,88vw)] shadow-2xl"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-text">
            {t("flow.paletteTitle")}
          </h2>
          <p className="mt-0.5 truncate text-[12px] text-text-muted">
            {t("flow.paletteHint")}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
              "text-text-muted transition-colors duration-120 outline-none",
              "hover:bg-muted hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>

      <div className="border-b border-border px-3 py-2.5">
        <TextFilter
          icon={Search}
          value={query}
          onChange={onQueryChange}
          placeholder={t("flow.searchPlaceholder")}
          label={t("flow.searchLabel")}
          className="w-full"
        />
      </div>

      {/* The armed-gap banner. Only rendered while a `+` on the canvas is
          waiting, because otherwise it is a permanent strip explaining a mode
          nobody is in. */}
      {armedIndex !== null && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 border-b border-accent-border bg-accent-soft",
            "px-3 py-2 text-[12px] text-text-secondary"
          )}
        >
          <span className="min-w-0 flex-1">
            {t("flow.armedBanner", { position: armedIndex + 1 })}
          </span>
          <button
            type="button"
            onClick={onCancelArm}
            className={cn(
              "shrink-0 rounded-sm font-medium text-accent-violet underline-offset-4",
              "outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {t("common.cancel")}
          </button>
        </div>
      )}

      <div className="scrollbar-quiet min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {/* Chip-shaped, and of uneven widths, because that is what arrives.
            A column of identical full-width bars followed by a wrap of short
            chips is a layout shift dressed up as a loading state. */}
        {loading && (
          <div className="flex flex-wrap gap-1.5">
            {[72, 104, 88, 120, 64, 96, 80].map((w, i) => (
              <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
            ))}
          </div>
        )}

        {/* Compact on purpose: when the network is down the canvas beside
            this is already showing the full illustrated block, and two
            cards tapping at once would be a lot of motion for one outage. */}
        {failed && (
          <LoadFailed
            size="compact"
            title={t("nodes.loadFailed")}
            error={error}
            onRetry={onRetry}
            retrying={retrying}
          />
        )}

        {/* Two readings of "nothing here", and only one of them is a problem:
            an organization with no nodes yet is a new tenant, not a failure. */}
        {empty && (
          <div className="rounded-lg border border-dashed border-border-strong px-3 py-6 text-center">
            <p className="text-[13px] font-medium text-text-secondary">
              {searching ? t("flow.noMatches") : t("nodes.emptyTitle")}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
              {searching ? t("flow.noMatchesHint") : t("nodes.emptyHint")}
            </p>
          </div>
        )}

        {!loading && !failed && nodes.length > 0 && (
          <div className="flex flex-col gap-4">
            {used.length > 0 && (
              <PaletteGroup label={t("flow.groupInFlow")} count={used.length}>
                {used.map((node) => (
                  <PaletteChip
                    key={node.id}
                    node={node}
                    count={usedCounts.get(node.id) ?? 0}
                    onPick={onPick}
                    onDragStart={onDragStart}
                    consumeClick={consumeClick}
                  />
                ))}
              </PaletteGroup>
            )}

            {available.length > 0 && (
              <PaletteGroup
                label={t("flow.groupAvailable")}
                count={available.length}
              >
                {available.map((node) => (
                  <PaletteChip
                    key={node.id}
                    node={node}
                    count={0}
                    onPick={onPick}
                    onDragStart={onDragStart}
                    consumeClick={consumeClick}
                  />
                ))}
              </PaletteGroup>
            )}
          </div>
        )}
      </div>

      {/* Creating a step is the bottom of the rail rather than the top: the
          rail is opened to place an existing step far more often than to
          invent a new one, and a create button above the list is a create
          button in front of the answer. */}
      <div className="border-t border-border p-3">
        <CreateNodeDialog
          defaultOrganizationId={organizationId}
          trigger={
            <button
              type="button"
              className={cn(
                "flex h-9 w-full items-center justify-center gap-1.5 rounded-lg",
                "border border-dashed border-border-strong bg-transparent",
                "text-[13px] font-medium text-text-secondary",
                "transition-colors duration-120 outline-none",
                "hover:border-accent-violet hover:bg-accent-soft hover:text-accent-violet",
                "focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Plus className="size-4" strokeWidth={1.75} aria-hidden />
              {t("flow.createStep")}
            </button>
          }
        />
      </div>
    </aside>
  )
}


function PaletteGroup({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span className="text-[10px] font-semibold tracking-[0.07em] text-text-placeholder uppercase">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-text-placeholder">
          {count}
        </span>
      </div>
      {/* Wrapped rather than stacked. A step is a short name in a coloured
          chip, so a full-width row per step spends most of the rail on empty
          space and pushes the fifth step below the fold. Flowing them lets a
          library of a dozen be seen at once, which is what a picker is for. */}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/**
 * One pickable step, as a chip.
 *
 * A `button` wrapping a `NodePill` rather than a styled pill: the press is the
 * accessible control — reachable by tab, activated by Enter — and the drag is
 * layered over it. Doing it the other way round means a `role`/`tabIndex`/
 * `onKeyDown` trio reimplementing what a button already is.
 *
 * The button itself is unstyled except for the focus ring and the hover lift,
 * so the chip inside is the entire visual. Two rings around one control — the
 * pill's own border plus a wrapper's — is what made the first version of this
 * rail look like a form.
 *
 * ### Press and drag are the same gesture until they are not
 *
 * `onPointerDown` arms a drag; it only becomes one once the pointer has moved
 * far enough. A press that never moves falls through to `onClick`, which
 * appends the step. That is why the click has to ask `consumeClick()` first —
 * a pointer release at the end of a real drag is still followed by a `click`,
 * and without the guard every drag would also append a second copy.
 *
 * `touch-none` so a drag from the rail on a touch screen drags the chip
 * instead of scrolling the list out from under it.
 */
function PaletteChip({
  node,
  count,
  onPick,
  onDragStart,
  consumeClick,
}: {
  node: Node
  /** Times it already appears in the chain. `0` hides the badge. */
  count: number
  onPick: (node: Node) => void
  onDragStart: (event: React.PointerEvent, source: FlowDragSource) => void
  consumeClick: () => boolean
}) {
  const t = useT()

  return (
    <button
      type="button"
      onPointerDown={(event) => onDragStart(event, { kind: "library", node })}
      onClick={() => {
        if (consumeClick()) return
        onPick(node)
      }}
      title={node.name}
      aria-label={t("flow.addStepNamed", { name: node.name })}
      className={cn(
        "group/chip relative inline-flex max-w-full touch-none rounded-full",
        "transition-transform duration-120 outline-none",
        "hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
        "cursor-grab active:translate-y-0 active:cursor-grabbing",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      )}
    >
      <NodePill
        color={node.color}
        name={node.name}
        size="sm"
        className="group-hover/chip:border-(--node-fill)"
      />

      {/* How many times it is already in the chain. A superscript count
          rather than a second chip beside it: the answer is almost always
          "once", and a badge that is usually absent should not reserve
          width in a wrap layout that is trying to fit twelve of these. */}
      {count > 1 && (
        <span
          aria-hidden
          className={cn(
            "absolute -end-1 -top-1 inline-flex size-4 items-center justify-center",
            "rounded-full bg-text text-[9px] font-semibold tabular-nums text-surface",
            "ring-2 ring-surface"
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
