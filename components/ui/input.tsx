import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Text input — DESIGN.md §10.1.
 *
 * Aligned to the spec rather than to stock shadcn, which ships a 32px box with
 * 10px padding and an `opacity-50` disabled state. Three corrections matter:
 *
 *  - **36px is the default** (§10.1); 32px is the *compact* size, not the base.
 *  - **Focus is a solid accent border plus a 3px 15%-violet ring.** Stock uses
 *    the translucent `--ring` token for the border too, which reads as a muddy
 *    grey-violet instead of a crisp edge.
 *  - **Disabled uses explicit tokens, never `opacity`** (§10.10) — opacity
 *    fades the border and placeholder unevenly and lightens the box against
 *    the page, so a disabled field stops looking like a field.
 *
 * The fill is owned here rather than passed per usage: `--surface` on light,
 * and `--surface-sunken` on dark so the field recesses below the card it sits
 * on (§16.2).
 */

const inputVariants = cva(
  [
    "w-full min-w-0 rounded-lg border bg-clip-padding",
    "text-sm font-normal text-text",
    "transition-[border-color,box-shadow,background-color] duration-120 outline-none",
    "placeholder:text-text-placeholder",
    // Fill: white on light, recessed below the card on dark (§16.2).
    "bg-surface dark:bg-surface-sunken",
    "border-input hover:border-border-strong",
    // Focus: solid accent edge + soft ring. Both, not either.
    "focus-visible:border-accent-violet focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:hover:border-accent-violet",
    // Disabled: explicit tokens per §10.10, never opacity.
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "disabled:border-border-subtle disabled:bg-background-subtle disabled:text-text-placeholder",
    "dark:disabled:border-border-subtle dark:disabled:bg-[#0f0f0f] dark:disabled:text-text-placeholder",
    // Error takes over the edge and the ring together.
    "aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15",
    "aria-invalid:hover:border-danger aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger/20",
    "dark:aria-invalid:ring-danger/20",
    // File inputs keep the stock affordance.
    "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  ],
  {
    variants: {
      inputSize: {
        // §10.1: 36px default, 32px compact, 40px large. 12px padding.
        sm: "h-8 px-2.5 text-[13px]",
        default: "h-9 px-3",
        lg: "h-10 px-3",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  }
)

function Input({
  className,
  type,
  inputSize,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  )
}

/**
 * Attached input group — §10.11's "one control, two parts" pattern.
 *
 * A static prefix (country code, protocol, currency) welded to the field with
 * no gap, so the pair reads as one control rather than a chip sitting beside
 * a box.
 *
 * The *group* owns the border, radius and focus ring; the inner `Input` gives
 * all three up. Letting the input keep its own ring draws it around the input's
 * rectangle only, so the ring cuts down the seam between the two halves — the
 * one detail that gives an attached group away as two elements.
 */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-9 w-full items-stretch overflow-hidden rounded-lg border border-input bg-surface",
        "transition-[border-color,box-shadow] duration-120",
        "hover:border-border-strong",
        "has-[input:focus-visible]:border-accent-violet has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/45",
        "has-[input[aria-invalid=true]]:border-danger has-[input[aria-invalid=true]]:ring-3 has-[input[aria-invalid=true]]:ring-danger/15",
        "has-[input:disabled]:border-border-subtle has-[input:disabled]:bg-background-subtle",
        "dark:bg-surface-sunken dark:has-[input:disabled]:bg-[#0f0f0f]",
        // The inner field is now just a text surface.
        "[&_[data-slot=input]]:h-full [&_[data-slot=input]]:rounded-none [&_[data-slot=input]]:border-0",
        "[&_[data-slot=input]]:bg-transparent [&_[data-slot=input]]:ring-0",
        "[&_[data-slot=input]]:focus-visible:border-0 [&_[data-slot=input]]:focus-visible:ring-0",
        className
      )}
      {...props}
    />
  )
}

/** Static leading segment of an `InputGroup`, divided by a hairline. */
function InputGroupAddon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-addon"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border-r border-input px-3",
        "bg-background-subtle text-sm text-text-secondary",
        "dark:bg-[#141414]",
        className
      )}
      {...props}
    />
  )
}

export { Input, InputGroup, InputGroupAddon, inputVariants }
