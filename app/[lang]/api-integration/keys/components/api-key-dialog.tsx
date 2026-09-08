"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, KeyRound, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
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
} from "@/components/ui/dialog"
import { Field, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useCreateApiKey, useUpdateApiKey } from "@/features/api-keys/api"
import type { ApiKey } from "@/features/api-keys/types"
import { useT } from "@/i18n/context"
import type { ApiErrorBody } from "@/types/api"

/**
 * Create or rename an API key — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /access_key` and `PUT /access_key/{id}`, both `{ name }` and nothing
 * else. See docs/CRUD-MIGRATION-REFERENCE.md §1.2.
 *
 * ### One field, because the endpoint takes one field
 *
 * The secret is generated server-side and the organization and user are
 * assigned from the token. There is no organization picker here even for a
 * platform admin — `/access_key` does not read `organization_id`, so a picker
 * would be a control whose only effect is to be ignored.
 *
 * The app this was ported from fetched the organization list on this modal and
 * never used the result (docs/CRUD-MIGRATION-REFERENCE.md §1.2). That call is
 * dropped rather than reproduced.
 *
 * ### Editing is renaming, and the dialog says so
 *
 * A dialog titled "Edit key" beside a visible secret reads as though the
 * secret is what opens. It is not, and it cannot be — the only revocation is
 * deletion. So the edit title, the button and the row's control all say
 * Rename.
 */

/**
 * §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. The 16px
 * text below that stops iOS zooming the page when a field takes focus.
 */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

/** The Create button in the page header, and the dialog behind it. */
export function CreateApiKeyDialog() {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
            <KeyRound data-icon="inline-start" strokeWidth={1.75} />
            {t("apiKeys.createTitle")}
          </Button>
        }
      />
      {/* Mounted per opening, so a cancelled draft never comes back on the
          next open and the mutation's error state starts clean. */}
      {open && <ApiKeyForm apiKey={null} onDone={() => setOpen(false)} />}
    </Dialog>
  )
}

/** The rename dialog, mounted once by the screen rather than once per row. */
export function RenameApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
}: {
  /** `null` between openings — nothing renders. */
  apiKey: ApiKey | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keyed on the row: opening a second key after a first must start from
          that key's name, not from the previous form state. */}
      {open && apiKey && (
        <ApiKeyForm
          key={apiKey.id}
          apiKey={apiKey}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function ApiKeyForm({
  apiKey,
  onDone,
}: {
  apiKey: ApiKey | null
  onDone: () => void
}) {
  const t = useT()
  const editing = apiKey !== null

  const [name, setName] = React.useState(apiKey?.name ?? "")
  const [error, setError] = React.useState<string | undefined>()

  const createKey = useCreateApiKey({ onSuccess: onDone })
  const updateKey = useUpdateApiKey({ onSuccess: onDone })
  const mutation = editing ? updateKey : createKey

  /**
   * The whole-form error, once the field-level one has been claimed.
   *
   * A 422 naming `name` is already shown next to the field, so repeating it in
   * a banner says the same thing twice. Anything else — a duplicate name the
   * backend refuses, a 500, a dropped connection — has nowhere else to appear.
   */
  const formError = React.useMemo(() => {
    if (!mutation.isError) return null
    const err = mutation.error
    if (!axios.isAxiosError(err)) return t("common.somethingWentWrong")

    const body = err.response?.data as ApiErrorBody | undefined
    if (body?.errors?.name) return null

    return (
      body?.message ??
      (err.response ? t("common.serverRejected") : t("common.cannotReachServer"))
    )
  }, [mutation.isError, mutation.error, t])

  /** A 422 names the offending field; put the message beside it. */
  const onError = (err: unknown) => {
    if (!axios.isAxiosError(err)) return
    const body = err.response?.data as ApiErrorBody | undefined
    const message = body?.errors?.name?.[0]
    if (message) setError(message)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setError(t("apiKeys.form.nameRequired"))
      return
    }
    setError(undefined)

    if (editing) {
      updateKey.mutate({ id: apiKey.id, data: { name: trimmed } }, { onError })
      return
    }
    createKey.mutate({ name: trimmed }, { onError })
  }

  const submitting = mutation.isPending

  return (
    <DialogContent
      size="sm"
      // Rendered as a form, so Enter submits and the footer's button is a real
      // submit button rather than a click handler.
      render={<form onSubmit={submit} noValidate />}
    >
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>
          {editing ? t("apiKeys.editTitle") : t("apiKeys.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editing ? t("apiKeys.editDescription") : t("apiKeys.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field
            label={t("apiKeys.columns.name")}
            helper={t("apiKeys.form.nameHelper")}
            error={error}
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  // Clears the error the moment the field is edited.
                  if (error) setError(undefined)
                }}
                placeholder={t("apiKeys.form.namePlaceholder")}
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            )}
          </Field>
        </FieldSet>

        {formError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
          >
            <AlertCircle
              className="mt-px size-4 shrink-0 text-danger"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-danger">{formError}</p>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <DialogClose
          render={
            <Button
              variant="outline"
              type="button"
              className={ACTION}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
          }
        />
        {/* §13.5 allows a solid primary here: this dialog writes a record. */}
        <Button type="submit" className={ACTION} disabled={submitting}>
          {submitting && (
            <Loader2
              data-icon="inline-start"
              className="animate-spin"
              strokeWidth={1.75}
            />
          )}
          {submitting
            ? editing
              ? t("common.saving")
              : t("common.creating")
            : editing
              ? t("common.saveChanges")
              : t("apiKeys.createAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
