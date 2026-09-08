"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * Switch — DESIGN.md §10.8.
 *
 * A 36×20 track with a 16px thumb inset 2px, translating 16px over 140ms. Off
 * is `--color-border-strong`; on is the accent.
 *
 * ### It is not a checkbox, and the difference is when it takes effect
 *
 * §10.6's checkbox collects an answer that is submitted with the rest of the
 * form. A switch reads as a thing being turned on *now*. Every switch in this
 * app is inside a dialog that has a Save button, so it is doing the checkbox's
 * job — used here because the fields it stands for (`is_enabled`,
 * `is_join_requests_enabled`) are states rather than selections, and a row of
 * ticked boxes reads as a list where a row of switches reads as settings.
 *
 * The track carries `aria-invalid` styling like every other control so `Field`
 * can mark it, even though a boolean is hard to get wrong.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5",
        "bg-border-strong transition-colors duration-140 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // `border-strong` and `accent-violet` are both themed tokens, so the
        // dark values §10.8 lists arrive without a `dark:` override here —
        // hardcoding them would break the alternate palettes too.
        "data-checked:bg-accent-violet",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
          // RTL flips the axis: the thumb must travel toward the end of the
          // track, which is the left in Arabic. `ltr:`/`rtl:` rather than a
          // logical property because `translate` has no logical form.
          "transition-transform duration-140 ease-out",
          "ltr:data-checked:translate-x-4 rtl:data-checked:-translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
