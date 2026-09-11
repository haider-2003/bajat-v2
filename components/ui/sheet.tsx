"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import {
  DialogClose,
  DialogCloseButton,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * Side sheet — a dialog that opens from the edge instead of the centre.
 *
 * ### Why a second overlay when there is already a dialog
 *
 * `Dialog` (components/ui/dialog.tsx) is §13's centred box: 480px wide, biased
 * above centre, sized for a question and its answer. A *task* — a form long
 * enough to scroll, with something at the top that has to stay in view while
 * the rest of it is filled in — does not fit in that box, and widening it just
 * puts a large white square over the middle of the page. A sheet takes the
 * end edge instead: full height, a fixed width, and the list it opened from
 * still visible beside it, which is what makes "issue a card from this row"
 * feel like an action on the row rather than a trip to another screen.
 *
 * Same primitive underneath, so the title, description, close button and
 * trigger are the dialog's own, re-exported under sheet names — a sheet and a
 * dialog announce themselves identically to a screen reader.
 *
 * ### The edge is logical, not physical
 *
 * `justify-end`, `border-s`, and the `ltr:` / `rtl:` variants on the entry
 * transform: in Arabic the sheet opens from the *left*, because that is where
 * the end of the page is, and it slides in from there rather than crossing the
 * whole viewport.
 *
 * ### It is attached to the edge, not floating over it
 *
 * Full height, flush to the end edge, square corners, and one hairline down
 * its inner edge. No gutter and no radius: a panel inset by 16px with rounded
 * corners is a *card* that happens to be near the edge, and it reads as
 * something lying on the page rather than as a second region of the app. The
 * difference matters here because the list behind stays live — the sheet is
 * the other half of the screen, not a thing on top of it.
 *
 * That is also why elevation is carried by the scrim and one border rather
 * than by a drop shadow on four sides: only one edge is free, so only one edge
 * has anything to cast onto.
 *
 * ### Its width is the user's to change
 *
 * A sheet holds a task, and how much room the task wants is not something
 * the caller can know for every screen it is opened on: a laptop beside a
 * 1024px iPad beside a 27" monitor. So `resizable` puts a grip on the free
 * edge and lets the operator drag it — with a finger too, `touch-action:
 * none` on the grip — and remembers the answer under the given key. The
 * chosen width goes into one custom property that every size's class reads,
 * so it holds across breakpoints without the caller re-deriving anything.
 *
 * The popup is also a named container (`@container/sheet`), which is what a
 * dragged width is *for*: a layout inside it can split or stack on the room
 * the sheet actually has rather than on the viewport. A container cannot be
 * queried by its own rules, so the popup is the *frame* only — surface, edge,
 * width, entry — and the column that holds the header, body and footer is a
 * child of it, which is where `layoutClassName` lands.
 *
 * ### Below `sm` it is the screen
 *
 * §18.6 turns a modal into a bottom sheet on a phone. A side sheet holding a
 * long form does better as the whole viewport — a bottom sheet capped at 88vh
 * would leave a strip of the list showing above a form that needs every pixel.
 * So it stays full-bleed there and the entry becomes a rise from the bottom,
 * which is the direction a full-screen panel is expected from.
 */

const Sheet = DialogPrimitive.Root

const SheetTrigger = DialogTrigger
const SheetClose = DialogClose
const SheetCloseButton = DialogCloseButton
const SheetTitle = DialogTitle
const SheetDescription = DialogDescription

/**
 * §19.13's widths, a step wider than the dialog's: a sheet holds a task.
 *
 * Each is `min(var(--sheet-width, <default>), 100vw)`: the size's own width
 * unless the sheet has been dragged, in which case the dragged width — set
 * inline as the variable — wins at every breakpoint from `sm` up.
 *
 * Capped at the viewport rather than at `100vw - 2rem` — the panel sits *on*
 * the edge, so there is no gutter to leave room for. On a narrow tablet the
 * cap is what stops the sheet covering the list it was opened from.
 */
const SIZES = {
  default: "sm:w-[min(var(--sheet-width,480px),100vw)]",
  lg: "sm:w-[min(var(--sheet-width,560px),100vw)]",
  xl: "sm:w-[min(var(--sheet-width,680px),100vw)]",
  /**
   * Two panes side by side once there is room for them: the `xl` width until
   * the viewport reaches 1280px, then wide enough for a 400px stage beside a
   * 520px form. The caller lays the panes out; this only makes the room.
   */
  "2xl":
    "sm:w-[min(var(--sheet-width,680px),100vw)] xl:w-[min(var(--sheet-width,920px),100vw)]",
} as const

/** The narrowest a dragged sheet goes, and the least of the page it leaves. */
const MIN_WIDTH = 400
const PAGE_MARGIN = 64

function clampWidth(width: number) {
  return Math.round(
    Math.min(Math.max(width, MIN_WIDTH), window.innerWidth - PAGE_MARGIN)
  )
}

/** The remembered width under `key`, or `null` for "never dragged". */
function readWidth(key: string | undefined): number | null {
  if (!key || typeof window === "undefined") return null
  try {
    const value = Number(window.localStorage.getItem(`sheet-width:${key}`))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeWidth(key: string, width: number) {
  try {
    window.localStorage.setItem(`sheet-width:${key}`, String(width))
  } catch {
    // Private mode, or storage disabled: the width still holds for this open.
  }
}

function SheetContent({
  className,
  layoutClassName,
  size = "default",
  resizable,
  style,
  children,
  ...props
}: DialogPrimitive.Popup.Props & {
  size?: keyof typeof SIZES
  /**
   * Classes for the column inside the frame — the element the header, body
   * and footer are children of. Container-query rules (`@…/sheet:`) go here:
   * they cannot match the frame, which is the container they query.
   */
  layoutClassName?: string
  /**
   * Lets the user drag the free edge to change the width. The value is the
   * key the chosen width is remembered under, so the same sheet opens at the
   * same width next time.
   */
  resizable?: string
}) {
  const [width, setWidth] = React.useState<number | null>(() =>
    readWidth(resizable)
  )

  React.useEffect(() => {
    if (resizable && width !== null) writeWidth(resizable, width)
  }, [resizable, width])

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-[var(--overlay)]",
          "transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0.2,1)]",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
          "supports-[-webkit-touch-callout:none]:absolute"
        )}
      />
      <DialogPrimitive.Viewport
        className={cn(
          "fixed inset-0 z-50 flex overflow-hidden",
          // No padding at any width: the panel is flush to the edge, and a
          // gutter is what would turn it back into a floating card.
          "justify-end"
        )}
      >
        <DialogPrimitive.Popup
          data-slot="sheet-content"
          className={cn(
            // `h-full`, not `max-h-full`: the panel is the full height of the
            // viewport, so its footer sits on the bottom edge rather than
            // floating wherever the content happened to end.
            "relative h-full w-full",
            SIZES[size],
            // A container, so what is inside can lay itself out on the width
            // the sheet has rather than the width the viewport has.
            "@container/sheet",
            "bg-surface-elevated text-text outline-none",
            // One hairline down the inner edge, in both themes — with the
            // panel attached to the edge this is the seam, and in dark mode
            // it is the only thing separating it from the page (§16.1).
            "border-s border-border",
            "shadow-[-8px_0_32px_rgba(0,0,0,0.10)] rtl:shadow-[8px_0_32px_rgba(0,0,0,0.10)]",
            "dark:shadow-none",
            // Entry: a 240ms ease-out-expo slide. Longer than the dialog's
            // 180ms because the distance is the panel's whole width, and a
            // panel that arrives in 180ms from off-screen reads as a snap.
            "transition-[transform,opacity] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-starting-style:opacity-0 data-ending-style:opacity-0",
            // Phone: rise from the bottom. `sm`+: slide in from the end edge,
            // whichever side that is.
            "data-starting-style:translate-y-6 data-ending-style:translate-y-6",
            "sm:data-starting-style:translate-y-0 sm:data-ending-style:translate-y-0",
            "sm:ltr:data-starting-style:translate-x-8 sm:ltr:data-ending-style:translate-x-8",
            "sm:rtl:data-starting-style:-translate-x-8 sm:rtl:data-ending-style:-translate-x-8",
            "motion-reduce:transition-none",
            className
          )}
          style={
            width !== null
              ? ({ ...style, "--sheet-width": `${width}px` } as React.CSSProperties)
              : style
          }
          {...props}
        >
          {resizable && <SheetResizeHandle onResize={setWidth} />}
          <div
            data-slot="sheet-layout"
            className={cn("flex h-full min-h-0 w-full flex-col", layoutClassName)}
          >
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  )
}

/**
 * The grip on the sheet's free edge.
 *
 * A 16px strip straddling the seam, with a short pill drawn in the middle of
 * it so the affordance is visible before it is hovered — a finger on an iPad
 * gets no hover. Dragging it moves the free edge; the attached edge is the
 * viewport's, so the width is simply the distance from the pointer to that
 * edge, on whichever side it is.
 *
 * Pointer events with capture, so the drag survives the pointer leaving the
 * strip, and `touch-action: none` so a finger drags the edge rather than
 * scrolling the body under it. The page's cursor and text selection are held
 * still for the duration — a fast drag crosses the whole list behind the
 * sheet, and it must not light up as the pointer passes.
 *
 * It is a `separator` to assistive tech, focusable, and the arrow keys move
 * it in 24px steps — the arrow pointing away from the sheet widens it.
 */
function SheetResizeHandle({ onResize }: { onResize: (width: number) => void }) {
  const t = useT()
  const [dragging, setDragging] = React.useState(false)

  /** The width a pointer at `clientX` is asking for. */
  const widthAt = (popup: HTMLElement, clientX: number) => {
    const rect = popup.getBoundingClientRect()
    const rtl = getComputedStyle(popup).direction === "rtl"
    return clampWidth(rtl ? clientX - rect.left : rect.right - clientX)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const handle = event.currentTarget
    const popup = handle.parentElement
    if (!popup) return

    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    setDragging(true)

    const { cursor, userSelect } = document.body.style
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const move = (e: PointerEvent) => onResize(widthAt(popup, e.clientX))
    const up = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", up)
      handle.removeEventListener("pointercancel", up)
      document.body.style.cursor = cursor
      document.body.style.userSelect = userSelect
      setDragging(false)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", up)
    handle.addEventListener("pointercancel", up)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    const popup = event.currentTarget.parentElement
    if (!popup) return

    event.preventDefault()
    const rtl = getComputedStyle(popup).direction === "rtl"
    // Away from the sheet widens it: left in LTR, where the free edge is the
    // left one, and right in RTL.
    const outward = (event.key === "ArrowLeft") !== rtl
    onResize(
      clampWidth(popup.getBoundingClientRect().width + (outward ? 24 : -24))
    )
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("common.resizePanel")}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "group/handle absolute inset-y-0 start-0 z-10 hidden w-4 cursor-col-resize outline-none select-none",
        "touch-none",
        // Straddles the seam: half over the sheet, half over the page.
        "ltr:-translate-x-1/2 rtl:translate-x-1/2",
        // Not on a phone — there the sheet is the screen (§18.6).
        "sm:block"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute start-1/2 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full",
          "ltr:-translate-x-1/2 rtl:translate-x-1/2",
          "bg-border-strong transition-[background-color,height] duration-120",
          "group-hover/handle:bg-accent-violet group-focus-visible/handle:bg-accent-violet",
          dragging && "h-14 bg-accent-violet"
        )}
      />
    </div>
  )
}

/**
 * The fixed top of the sheet. Takes the title block *and* anything that has to
 * stay in view while the body scrolls — which is the whole reason a task went
 * into a sheet rather than a dialog.
 */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-1.5 p-5 pe-14", className)}
      {...props}
    />
  )
}

/** The scrolling region, same construction as `DialogBody`. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-auto overflow-y-auto px-5 pb-5", className)}
      {...props}
    />
  )
}

/**
 * The action row, pinned under the scrolling body.
 *
 * Unlike `DialogFooter` this one *keeps* §13.5's top rule. A dialog's footer is
 * the last thing in a short column and a line there cuts nothing; a sheet's
 * body scrolls under its footer, and the rule is what tells the eye where the
 * scrolling content stops and the fixed controls start.
 */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 pt-4",
        "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
        "sm:flex-row sm:items-center sm:justify-end sm:pb-5",
        className
      )}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
