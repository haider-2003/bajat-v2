"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { useControlSurface } from "@/components/ui/control-style"
import { cn } from "@/lib/utils"

/**
 * The app's button.
 *
 * Structurally still shadcn's, with one change: the three variants that have a
 * **surface** — `default`, `outline`, `secondary` — no longer paint themselves.
 * They contribute geometry and states only, and their face comes from the
 * control style (Settings → Appearance), so a `Button` is made of the same
 * material as a filter button, the date picker trigger and the active nav item
 * rather than being the one control that ignores the setting.
 *
 * `ghost`, `link` and `destructive` keep their own classes. A ghost button with
 * a rim and a lift is not a ghost button (§7.2), and `destructive` carries a
 * status colour that a brand tone must not overwrite.
 *
 * Empty variant strings are deliberate — see the comment on each. Leaving
 * `bg-primary` in place would sit a flat fill *under* the tone gradient, which
 * survives only as long as the gradient stays fully opaque.
 *
 * `"use client"` is required for the hook. The Base UI primitive underneath is
 * client-only anyway, so this costs nothing.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Surface comes from the control style — see the note above.
        default: "",
        outline: "",
        secondary: "",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** Which variants take a face, and which face they take. */
const SURFACED = {
  default: "solid",
  outline: "face",
  secondary: "face",
} as const

/**
 * Kills the base row's `border border-transparent`.
 *
 * That border plus `bg-clip-padding` clips the face to the *padding* box, so a
 * surfaced button drew a 1px transparent gutter outside its own rim and the
 * panel behind showed through it — a white hairline ring around every toned
 * button. The filter buttons never had it because they carry no border at all.
 *
 * Zeroing the width rather than colouring the border: the rim is already an
 * inset box-shadow (so switching styles never shifts a label by a pixel), and
 * a real border would put a second edge outside it. At width 0 the padding box
 * and border box coincide, which also makes `bg-clip-padding` a no-op.
 *
 * Focus survives — `focus-visible:border-ring` stops doing anything, but the
 * `ring-3` beside it is the visible indicator.
 */
const NO_BORDER_GUTTER = "border-0"

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const surface = useControlSurface()
  const slot = variant ? SURFACED[variant as keyof typeof SURFACED] : undefined

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size }),
        slot && `${NO_BORDER_GUTTER} ${surface[slot]}`,
        // Last, so a caller can still override the face on a one-off.
        className
      )}
      {...props}
    />
  )
}

export { Button, buttonVariants }
