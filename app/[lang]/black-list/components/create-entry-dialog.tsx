"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Loader2, ShieldBan } from "lucide-react"

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
import { Input, InputGroup, InputGroupAddon } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateBlackList } from "@/features/black-list/api"
import { useGetOrganizations } from "@/features/organizations/api"
import { useT } from "@/i18n/context"
import { toApiPhone } from "@/utils/format"
import type { ApiErrorBody } from "@/types/api"

/**
 * Block a number — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /blacklist` via `useCreateBlackList`. The payload is
 * `CreateBlackListInput`: `{ name, phone, organizationId }`. See
 * docs/api-types.md § black-list.
 *
 * ### It is not styled as a destructive dialog
 *
 * Blocking a number is consequential, but it is a *create*, and it is
 * reversible from the row it produces — §7.2 keeps the red button for the
 * irreversible action, which on this screen is Remove (see
 * remove-entry-dialog.tsx). Painting both ends of a two-way switch red is what
 * makes red stop meaning anything. What this dialog does instead is say
 * plainly what the block will and will not do before it asks.
 *
 * ### `organizationId` is singular
 *
 * A block belongs to one organization's list, so the endpoint reads
 * `organization_id`. Members' plural `organization_ids` is the wrong spelling
 * here, and the wrong spelling does not fail — it is a parameter this endpoint
 * ignores, so the entry lands on whatever organization the token defaults to.
 *
 * ### Phone numbers are normalised, not just stripped
 *
 * The API stores a `964` country code followed by ten local digits. What
 * people type is the local form with a trunk zero — `07877242069`. That
 * matters more here than anywhere else in the app: a block is enforced by
 * *matching* the stored number, so an entry saved in a second spelling is not
 * a stricter block, it is a block that never fires. `toApiPhone` collapses
 * every spelling onto the stored one.
 */

/** One page of 100 is the whole list in practice, and it is cached app-wide. */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

/**
 * §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. The 16px
 * text below that stops iOS zooming the page when a field takes focus.
 */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

type FieldName = "name" | "phone" | "organizationId"

type Errors = Partial<Record<FieldName, string>>

/**
 * Server validation errors, keyed by the **wire** name.
 *
 * The request interceptor decamelizes on the way out, so the server never sees
 * `organizationId` and never names it in a rejection. This maps back.
 */
const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  phone: "phone",
  organization_id: "organizationId",
  organizationId: "organizationId",
}

export function CreateEntryDialog() {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
            <ShieldBan data-icon="inline-start" strokeWidth={1.75} />
            {t("blackList.blockTitle")}
          </Button>
        }
      />
      {/* Mounted per opening, so a cancelled draft never comes back on the
          next open and the mutation's error state starts clean. */}
      {open && <CreateEntryForm onCreated={() => setOpen(false)} />}
    </Dialog>
  )
}

function CreateEntryForm({ onCreated }: { onCreated: () => void }) {
  const t = useT()
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  /** `""` is "nothing chosen" — the select is handed `null` for that. */
  const [organizationId, setOrganizationId] = React.useState("")
  const [errors, setErrors] = React.useState<Errors>({})

  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY)
  const organizations = React.useMemo(
    () => organizationsQuery.data?.data.data ?? [],
    [organizationsQuery.data]
  )

  /** `{ value, label }` is the shape `Select` reads a label out of by itself. */
  const organizationItems = React.useMemo(
    () => organizations.map((o) => ({ value: String(o.id), label: o.name })),
    [organizations]
  )

  /**
   * The organization actually being submitted.
   *
   * An org-scoped account sees exactly one organization, and picking it by
   * hand is a step with no decision in it. Derived rather than written into
   * state by an effect: the list arrives after the first render, and an effect
   * that back-fills state on arrival is a second render doing what one already
   * could.
   */
  const chosenId =
    organizationId ||
    (organizationItems.length === 1 ? organizationItems[0].value : "")

  const createEntry = useCreateBlackList({ onSuccess: onCreated })

  /**
   * The whole-form error, once the field-level ones have been claimed.
   *
   * A 422 whose messages all landed on fields is already shown next to those
   * fields, so repeating it in a banner says the same thing twice. Anything
   * else — a duplicate the backend refuses, a 500, a dropped connection — has
   * nowhere else to appear.
   */
  const formError = React.useMemo(() => {
    if (!createEntry.isError) return null
    const error = createEntry.error
    if (!axios.isAxiosError(error)) return t("common.somethingWentWrong")

    const body = error.response?.data as ApiErrorBody | undefined
    const claimed = Object.keys(body?.errors ?? {}).some(
      (key) => key in WIRE_NAMES
    )
    if (claimed) return null

    return (
      body?.message ??
      (error.response
        ? t("common.serverRejected")
        : t("common.cannotReachServer"))
    )
  }, [createEntry.isError, createEntry.error, t])

  /** Clears a field's error the moment it is edited. */
  const edit =
    (field: FieldName, set: (value: string) => void) => (value: string) => {
      set(value)
      setErrors((current) =>
        current[field] ? { ...current, [field]: undefined } : current
      )
    }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    // Whatever was typed, reduced to the one spelling the API stores. This is
    // the validation too: a number it cannot read is one the server would
    // reject, and it rejects it with less to go on.
    const wirePhone = toApiPhone(phone)
    const found: Errors = {}

    if (!name.trim()) found.name = t("blackList.form.nameRequired")
    if (!phone.trim()) found.phone = t("blackList.form.phoneRequired")
    else if (!wirePhone) found.phone = t("members.form.phoneInvalid")
    if (!chosenId) found.organizationId = t("members.form.organizationRequired")

    setErrors(found)
    if (Object.keys(found).length > 0) return

    createEntry.mutate(
      {
        name: name.trim(),
        // `wirePhone` is a string by here — an unreadable one failed above.
        phone: wirePhone ?? "",
        // Singular, and a number: the select's value is a string, and
        // `organization_id` is an id the backend compares numerically.
        organizationId: Number(chosenId),
      },
      {
        // A 422 names the offending fields; put each message beside its field
        // rather than in a banner the reader has to translate back to a box.
        onError: (error) => {
          if (!axios.isAxiosError(error)) return
          const body = error.response?.data as ApiErrorBody | undefined
          const next: Errors = {}
          for (const [key, messages] of Object.entries(body?.errors ?? {})) {
            const field = WIRE_NAMES[key]
            if (field && messages[0]) next[field] = messages[0]
          }
          setErrors(next)
        },
      }
    )
  }

  const submitting = createEntry.isPending

  return (
    <DialogContent
      // Rendered as a form, so Enter submits from any field and the footer's
      // button is a real submit button rather than a click handler.
      render={<form onSubmit={submit} noValidate />}
    >
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>{t("blackList.blockTitle")}</DialogTitle>
        <DialogDescription>
          The number stops being able to request or be issued an identity in
          this organization. Cards already issued are not revoked.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          {/* The list blocks a *number*; the name is what makes the row
              readable a year later. Asked for first all the same, because it
              is the field someone has an answer for without looking it up. */}
          <Field
            label={t("members.columns.name")}
            helper={t("blackList.form.nameHelper")}
            error={errors.name}
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => edit("name", setName)(event.target.value)}
                placeholder={t("blackList.form.namePlaceholder")}
                autoComplete="off"
                disabled={submitting}
              />
            )}
          </Field>

          {/* §10.11's attached group. The country code states the field's own
              format, where the value is being typed rather than in a helper
              line under it. A pasted `+964…` or a local `0770…` still
              normalises, so the addon narrows the ask without narrowing what
              is taken. */}
          <Field label={t("auth.phoneLabel")} error={errors.phone}>
            {(control) => (
              <InputGroup className="h-11 md:h-9">
                <InputGroupAddon
                  dir="ltr"
                  className="text-base text-text-secondary md:text-sm"
                >
                  +964
                </InputGroupAddon>
                <Input
                  {...control}
                  className="text-base md:text-sm"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) =>
                    edit("phone", setPhone)(event.target.value)
                  }
                  placeholder="770 123 4567"
                  autoComplete="off"
                  disabled={submitting}
                />
              </InputGroup>
            )}
          </Field>

          {/* A block is one organization's, not the platform's — the same
              number can be barred by one tenant and fine at another. */}
          <Field
            label={t("filters.attributes.organization")}
            error={errors.organizationId}
          >
            {(control) => (
              <Select
                items={organizationItems}
                value={chosenId || null}
                onValueChange={(value) =>
                  edit("organizationId", setOrganizationId)(value ?? "")
                }
                disabled={submitting || organizationsQuery.isPending}
              >
                {/* §10.3: a select trigger takes the text input's box — full
                    width, 36px, the same border, fill and focus treatment. */}
                <SelectTrigger
                  {...control}
                  className="w-full border-input bg-surface text-base data-[size=default]:h-11 focus-visible:border-accent-violet focus-visible:ring-ring/45 aria-invalid:border-danger aria-invalid:ring-danger/15 md:text-sm md:data-[size=default]:h-9 dark:bg-surface-sunken"
                >
                  <SelectValue
                    className="truncate"
                    placeholder={
                      organizationsQuery.isPending
                        ? t("members.form.loadingOrganizations")
                        : t("members.form.selectOrganization")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {organizationItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </FieldSet>

        {organizationsQuery.isError && (
          <p className="mt-2 text-xs text-danger">
            {t("members.form.organizationsFailed")}{" "}
            <button
              type="button"
              onClick={() => organizationsQuery.refetch()}
              className="rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("common.retry")}
            </button>
          </p>
        )}

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
          {submitting ? t("blackList.blocking") : t("blackList.blockAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
