"use client"

import * as React from "react"
import { AlertCircle, Check, Loader2, Webhook } from "lucide-react"

import { SettingsBlock, SettingsSection } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { readApiError } from "@/components/ui/confirm-dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetWebhook, useUpdateWebhook } from "@/features/webhooks/api"
import { useT } from "@/i18n/context"

/**
 * The webhook endpoint — `GET /webhook` and `PUT /webhook`.
 *
 * See docs/CRUD-MIGRATION-REFERENCE.md §1.14.
 *
 * ### One field, and the asymmetry behind it
 *
 * The read returns the URL as `url`; the write takes it as `webhook_url`.
 * Sending the read's spelling back is accepted and ignored — the save appears
 * to work and the endpoint keeps whatever it had. `UpdateWebhookInput` names
 * the write spelling, so the mismatch is a compile error rather than a silent
 * no-op.
 *
 * ### Why the form does not reset itself from the server
 *
 * The draft is seeded from the loaded value once and then owned by the field.
 * Re-deriving it on every render would discard what is being typed the moment
 * a background refetch landed; an effect keyed on the response would do the
 * same thing one render later. So it is seeded by key, not by effect — the
 * loaded URL is the field's `defaultValue` in spirit, and the only thing that
 * re-seeds it is a successful save.
 *
 * ### The URL is validated here rather than left to the server
 *
 * A webhook that is never delivered fails **silently**: there is no retry and
 * nothing on this screen would show it. So `http://` and unparseable URLs are
 * refused before they can be saved into a configuration that looks correct and
 * quietly drops every event.
 */

/**
 * §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. The 16px
 * text below that stops iOS zooming the page when a field takes focus.
 */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** How long the saved confirmation stays up, in ms. */
const SAVED_MS = 2600

export function EndpointSection() {
  const t = useT()
  const webhookQuery = useGetWebhook()
  const save = useUpdateWebhook()

  const loaded = webhookQuery.data
  const storedUrl = loaded?.url ?? ""

  return (
    <SettingsSection
      id="endpoint"
      icon={Webhook}
      title={t("webhooks.endpointTitle")}
      description={t("webhooks.endpointDescription")}
    >
      <SettingsBlock>
        {webhookQuery.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : webhookQuery.isError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
          >
            <AlertCircle
              className="mt-px size-4 shrink-0 text-danger"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-danger">
              {t("webhooks.loadFailed")}{" "}
              <button
                type="button"
                onClick={() => webhookQuery.refetch()}
                className="rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("common.retry")}
              </button>
            </p>
          </div>
        ) : (
          // Keyed on what the server holds: a successful save re-seeds the
          // field from the stored value, and nothing else does.
          <EndpointForm key={storedUrl} storedUrl={storedUrl} save={save} />
        )}
      </SettingsBlock>
    </SettingsSection>
  )
}

function EndpointForm({
  storedUrl,
  save,
}: {
  storedUrl: string
  save: ReturnType<typeof useUpdateWebhook>
}) {
  const t = useT()
  const [url, setUrl] = React.useState(storedUrl)
  const [error, setError] = React.useState<string | undefined>()
  const [saved, setSaved] = React.useState(false)

  // Clears the confirmation, and cancels itself if the section unmounts first.
  React.useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), SAVED_MS)
    return () => window.clearTimeout(timer)
  }, [saved])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const trimmed = url.trim()
    const problem = validate(trimmed, t)
    if (problem) {
      setError(problem)
      return
    }
    setError(undefined)

    save.mutate({ webhookUrl: trimmed }, { onSuccess: () => setSaved(true) })
  }

  const submitting = save.isPending
  /** Nothing to save until the field differs from what the server holds. */
  const dirty = url.trim() !== storedUrl.trim()

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label={t("webhooks.urlLabel")}
        helper={t("webhooks.urlHelper")}
        error={error}
      >
        {(control) => (
          <Input
            {...control}
            // A URL is Latin-ordered even on an Arabic page.
            dir="ltr"
            type="url"
            inputMode="url"
            className={CONTROL}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              if (error) setError(undefined)
            }}
            placeholder={t("webhooks.urlPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
          />
        )}
      </Field>

      {save.isError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
        >
          <AlertCircle
            className="mt-px size-4 shrink-0 text-danger"
            strokeWidth={1.5}
          />
          <p className="text-[13px] text-danger">
            {readApiError(
              save.error,
              t("webhooks.saveFailed"),
              t("common.cannotReachServer")
            )}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* §18.6 — the action goes full-width before the row goes horizontal. */}
        <Button
          type="submit"
          className="h-11 w-full md:h-9 md:w-auto"
          disabled={submitting || !dirty}
        >
          {submitting && (
            <Loader2
              data-icon="inline-start"
              className="animate-spin"
              strokeWidth={1.75}
            />
          )}
          {submitting ? t("common.saving") : t("common.save")}
        </Button>

        {/* The confirmation sits beside the button rather than in a toast: it
            is the only feedback a save gives, and a toast over a form that
            still shows the typed value reads as ambiguous about which one was
            stored. */}
        {saved && !dirty && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-[13px] text-success"
          >
            <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {t("webhooks.saved")}
          </p>
        )}
      </div>
    </form>
  )
}

/**
 * The URL, checked before it can be saved into a configuration that looks
 * correct and silently drops every event.
 *
 * `URL` rather than a regular expression: parsing is what the delivering
 * server will do, so it is the check that agrees with reality.
 */
function validate(
  value: string,
  t: ReturnType<typeof useT>
): string | undefined {
  if (!value) return t("webhooks.urlRequired")

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return t("webhooks.urlInvalid")
  }

  if (parsed.protocol === "http:") return t("webhooks.urlInsecure")
  if (parsed.protocol !== "https:") return t("webhooks.urlInvalid")

  return undefined
}
