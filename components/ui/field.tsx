import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Form field scaffolding — DESIGN.md §10.10, spaced per §4.5.
 *
 * A label, a control, and one line under it. The gaps are the spec's (6px
 * label → control, 6px control → helper) rather than each form re-deciding
 * them, and `FieldSet` owns the 16px between stacked fields.
 *
 * ### The control is a render prop
 *
 * `children` is called with the props that wire the control to its label and
 * its message — `id`, `aria-describedby`, `aria-invalid`. Passing them back
 * rather than having each form invent an id is what keeps the accessible
 * wiring from being the part that gets forgotten, and `aria-invalid` is
 * already what `Input`'s error styling keys off (§10.1).
 *
 * ### Error replaces helper, it does not stack under it
 *
 * §10.10 is explicit about this: two lines of small text under a field is
 * noise, and the one that matters is the error.
 *
 * ### `Optional`, not `*`
 *
 * §10.10 offers a red asterisk or an `Optional` suffix and prefers the second
 * as the quieter of the two. Most fields in this app are required, so marking
 * the exceptions is also the smaller mark on the page.
 */

export type FieldControlProps = {
  id: string
  "aria-describedby": string | undefined
  "aria-invalid": boolean | undefined
}

function Field({
  label,
  optional = false,
  helper,
  error,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode
  optional?: boolean
  helper?: React.ReactNode
  /** Shown instead of `helper` when set, and marks the control invalid. */
  error?: React.ReactNode
  children: (control: FieldControlProps) => React.ReactNode
}) {
  const id = React.useId()
  const messageId = `${id}-message`
  const message = error ?? helper

  return (
    <div data-slot="field" className={cn("flex flex-col", className)} {...props}>
      <label
        htmlFor={id}
        className="mb-1.5 text-[13px] font-medium text-text-secondary"
      >
        {label}
        {optional && (
          <span className="ms-1.5 font-normal text-text-placeholder">
            Optional
          </span>
        )}
      </label>

      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
      })}

      {message && (
        <p
          id={messageId}
          className={cn(
            "mt-1.5 text-xs",
            error ? "text-danger" : "text-text-muted"
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
}

/** A stack of fields at §4.5's 16px field-to-field gap. */
function FieldSet({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-set"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

export { Field, FieldSet }
