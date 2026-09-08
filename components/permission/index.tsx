"use client"

import * as React from "react"

import { useAuthStore } from "@/features/auth/store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useT } from "@/i18n/context"

/**
 * Declarative permission gate. See docs/authentication.md §6.
 *
 *   <Permission can="members-create">
 *     <Button onClick={open}>Add member</Button>
 *   </Permission>
 *
 * Unauthorized renders nothing by default. With `showWithTooltip` the child is
 * rendered disabled and dimmed inside a tooltip explaining why — use that only
 * where the absence of a control would be confusing.
 */

type PermissionProps = {
  /** One permission name, or several. Unprefixed by convention. */
  can: string | string[]
  /** AND across the list (default). `false` makes it OR. */
  requireAll?: boolean
  /** Pass names through to `can()` verbatim, prefix and all. */
  prefixed?: boolean
  showWithTooltip?: boolean
  tooltipLabel?: string
  children: React.ReactElement
}

export function Permission({
  can,
  requireAll = true,
  prefixed = false,
  showWithTooltip = false,
  tooltipLabel,
  children,
}: PermissionProps) {
  const t = useT()
  const check = useAuthStore((s) => s.can)

  const names = Array.isArray(can) ? can : [can]
  const allowed = requireAll
    ? names.every((name) => check(name, prefixed))
    : names.some((name) => check(name, prefixed))

  if (allowed) return children

  if (!showWithTooltip) return null

  // The child must accept `disabled` and `style` — every control in
  // components/ui does, since they all forward props to the DOM node.
  const disabledChild = React.cloneElement(
    children as React.ReactElement<{ disabled?: boolean; style?: React.CSSProperties }>,
    { disabled: true, style: { opacity: 0.6 } }
  )

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex" />}
      >
        {disabledChild}
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel ?? t("common.noPermission")}</TooltipContent>
    </Tooltip>
  )
}
