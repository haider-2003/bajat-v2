"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * Modal dialog — DESIGN.md §13.
 *
 * Base UI's Dialog with this system's skin on it. Composition follows the
 * primitive's anatomy: `Dialog` (root) → `DialogTrigger` → `DialogContent`,
 * with `DialogHeader` / `DialogBody` / `DialogFooter` inside.
 *
 * `DialogContent` bundles the portal, the backdrop and the viewport because
 * those three are never chosen per-usage — a caller who forgets the backdrop
 * has a bug, not a variant. What *is* per-usage is the width, which is why
 * `size` is the one knob it takes.
 *
 * ### Why a viewport rather than a self-centering popup
 *
 * §13.1 wants a dialog that never exceeds `100vh - 96px` and scrolls its own
 * content. Centering the popup with `top-1/2 -translate-y-1/2` — the shape the
 * Base UI demo ships — spends the transform on positioning, so the §13.2 entry
 * (a 12px rise plus a `0.98 → 1` scale) has nothing left to animate with. A
 * fixed flex viewport centers the popup as a flex child instead, leaving its
 * transform free and its `max-h-full` measured against a box that is already
 * inset by the gutter.
 *
 * The viewport's bottom padding is heavier than its top: §13.1 biases the
 * dialog ~8% above true center, which is where the eye expects it.
 */

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

/** Closes the dialog. Render a `Button` through it with `render`. */
const DialogClose = DialogPrimitive.Close

/**
 * §19.13's three widths — but only once there is room for them. Below 480px
 * the dialog is a full-width sheet (§18.6), so the width is a `min-[480px]:`
 * override on a `w-full` base rather than the base itself.
 */
const SIZES = {
  sm: "min-[480px]:w-[min(400px,calc(100vw-2rem))]",
  default: "min-[480px]:w-[min(480px,calc(100vw-2rem))]",
  lg: "min-[480px]:w-[min(640px,calc(100vw-2rem))]",
} as const

function DialogContent({
  className,
  size = "default",
  children,
  ...props
}: DialogPrimitive.Popup.Props & { size?: keyof typeof SIZES }) {
  return (
    <DialogPrimitive.Portal>
      {/* §13.2 — deliberately light in light mode: the table behind stays
          readable, because the dialog is contextual to it. No blur. */}
      <DialogPrimitive.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-[var(--overlay)]",
          "transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0.2,1)]",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
          // iOS 26+: keeps the backdrop over the whole visible viewport.
          "supports-[-webkit-touch-callout:none]:absolute"
        )}
      />
      <DialogPrimitive.Viewport
        className={cn(
          "fixed inset-0 z-50 flex justify-center overflow-hidden",
          // Mobile-first: pinned to the bottom edge, no gutter — a sheet.
          "items-end",
          // From 480px up it is a centred dialog again, biased ~8% above true
          // centre (§13.1), which is where the eye expects it.
          "min-[480px]:items-center min-[480px]:p-4 min-[480px]:pt-12 min-[480px]:pb-[max(3rem,14vh)]"
        )}
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "relative flex min-h-0 w-full max-w-full flex-col",
            // §18.6 — a bottom sheet below 480px: full width, top corners only,
            // 88vh tall so the page behind stays visible above it.
            "max-h-[88vh] rounded-t-[14px]",
            "min-[480px]:max-h-full min-[480px]:rounded-[14px]",
            SIZES[size],
            // §13.1 — elevated surface, and a border that only exists in dark
            // mode, where the shadow does no separating work.
            "bg-surface-elevated text-text outline-none",
            "shadow-[0_24px_64px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06)]",
            "dark:border dark:border-border dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
            // §13.2 entry: 180ms, ease-out-expo, 12px rise + 0.98 scale.
            "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-starting-style:translate-y-3 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            "data-ending-style:translate-y-3 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
            // §18.0.10 — the rise and the scale collapse to an instant change.
            "motion-reduce:transition-none",
            className
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  )
}

/**
 * Title block. §13.3's conventional (non-tabbed) form: 16/600 title, optional
 * 13px muted line under it, 20px padding, and the close button inset 16px from
 * the top-right — which is why the block reserves padding for it.
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 p-5 pe-14", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base font-semibold tracking-[-0.01em] text-text",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[13px] leading-relaxed text-text-muted", className)}
      {...props}
    />
  )
}

/**
 * The scrolling region. §13.1 puts the overflow *inside* the dialog so the
 * header and footer stay put — `min-h-0` is what lets a flex child shrink
 * below its content and actually scroll.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-auto overflow-y-auto px-5 pb-5", className)}
      {...props}
    />
  )
}

/**
 * The action row.
 *
 * ### No rule above it
 *
 * §13.5 draws a 1px top border here. It is dropped deliberately: at 480px the
 * footer is already the last thing in a 20px-padded column, and the line only
 * cuts the dialog in two without separating anything the whitespace doesn't.
 * The scrolling body reads as its own region on its own.
 *
 * ### It stacks before it wraps
 *
 * §18.6: below 480px the confirming action goes full-width first and the
 * secondary sits under it. `flex-col-reverse` gets that from the natural DOM
 * order — cancel first, confirm last — so the tab order stays correct while
 * the confirm button renders on top.
 *
 * A left-aligned secondary (§13.5's split footer) is still available: give it
 * `me-auto`, which does nothing until the row goes horizontal.
 */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 px-5 pt-2",
        // §18.0.7 — the sheet sits on the screen edge, so it clears the home
        // indicator itself.
        "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
        "min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end min-[480px]:pb-5",
        className
      )}
      {...props}
    />
  )
}

/**
 * §13.3's close affordance — a 28px ghost square holding a 16px glyph, 16px
 * from the top and right edges.
 *
 * Absolutely positioned rather than sitting in the header row so it stays put
 * whether the header has one line or three, and so a dialog with no header at
 * all still gets one.
 */
function DialogCloseButton({
  className,
  ...props
}: DialogPrimitive.Close.Props) {
  const t = useT()

  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      aria-label={t("common.close")}
      className={cn(
        "absolute inline-flex items-center justify-center rounded-md",
        // §18.0.3 — a 44px touch target below lg, the §13.3 28px square above
        // it. Both land in the same optical corner.
        "end-2 top-2 size-11 lg:end-4 lg:top-4 lg:size-7",
        "text-text-muted transition-colors duration-120 outline-none",
        "hover:bg-[rgba(0,0,0,0.04)] hover:text-text",
        "dark:hover:bg-[rgba(255,255,255,0.045)]",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <X className="size-4" strokeWidth={1.5} />
    </DialogPrimitive.Close>
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
