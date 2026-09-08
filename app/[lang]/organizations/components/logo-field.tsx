"use client"

import * as React from "react"
import { ImagePlus, X } from "lucide-react"

import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The organization logo control — a preview tile, a choose/replace button, and
 * a way to drop a pending selection.
 *
 * ### An unchanged logo is not resent
 *
 * On edit, `value` is `null` until a new file is picked, and the submit maps
 * that to `undefined` — which `objectToFormData` skips entirely
 * (features/organizations/types.ts), so the backend keeps the logo it has. This
 * control never clears an already-stored logo; that is close enough to a
 * re-brand to belong in its own action.
 */

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]

export function LogoField({
  value,
  existingUrl,
  onChange,
  onError,
  disabled = false,
  id,
  describedBy,
  invalid = false,
}: {
  /** A newly picked file, or `null` for "leave the stored one". */
  value: File | null
  /** The URL of the logo already on the record, if any. */
  existingUrl?: string | null
  onChange: (file: File | null) => void
  /** Reports a rejected file up to the `Field`, or `null` to clear it. */
  onError: (message: string | null) => void
  disabled?: boolean
  id?: string
  describedBy?: string
  invalid?: boolean
}) {
  const t = useT()
  const inputRef = React.useRef<HTMLInputElement>(null)
  // The blob URL lives in a ref, not state, so nothing in an effect body sets
  // React state — it is created and revoked in the event handlers, and revoked
  // once more on unmount.
  const previewRef = React.useRef<string | null>(null)
  const [preview, setPreview] = React.useState<string | null>(null)

  React.useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    []
  )

  const shown = preview ?? existingUrl ?? null

  const setFile = (file: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = file ? URL.createObjectURL(file) : null
    setPreview(previewRef.current)
    onChange(file)
  }

  const pick = (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      onError(t("organizations.form.logoWrongType"))
      return
    }
    if (file.size > MAX_BYTES) {
      onError(t("organizations.form.logoTooLarge"))
      return
    }
    onError(null)
    setFile(file)
  }

  const clear = () => {
    setFile(null)
    onError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background-subtle",
          invalid ? "border-danger" : "border-border"
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied logo on an arbitrary host
          <img src={shown} alt="" className="size-full object-contain" />
        ) : (
          <ImagePlus
            className="size-5 text-text-placeholder"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "inline-flex h-8 items-center rounded-md border border-border bg-surface px-2.5",
              "text-[13px] font-medium text-text-secondary shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
              "transition-colors duration-120 hover:border-border-strong hover:text-text",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:bg-[rgba(255,255,255,0.04)] dark:shadow-none"
            )}
          >
            {shown
              ? t("organizations.form.logoReplace")
              : t("organizations.form.logoChoose")}
          </button>
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={clear}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-text-muted transition-colors hover:text-danger outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("organizations.form.logoRemove")}
            </button>
          )}
        </div>
        <p className="truncate text-xs text-text-muted">
          {value
            ? value.name
            : existingUrl
              ? t("organizations.form.logoKept")
              : t("organizations.form.logoHelper")}
        </p>
      </div>

      <input
        ref={inputRef}
        id={id}
        aria-describedby={describedBy}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        disabled={disabled}
        onChange={(event) => pick(event.target.files?.[0])}
      />
    </div>
  )
}
