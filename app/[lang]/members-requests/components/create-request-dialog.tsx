"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Loader2, Plus } from "lucide-react"

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
import { useCreateMemberRequests } from "@/features/members-requests/api"
import { useGetOrganizations } from "@/features/organizations/api"
import { useT } from "@/i18n/context"
import { toApiPhone } from "@/utils/format"
import type { ApiErrorBody } from "@/types/api"

/**
 * Create a member request — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /member_request` via `useCreateMemberRequests`. The payload is
 * `CreateMembersInput` and nothing more: `{ name, phone, organizationId }`.
 * See docs/api-types.md § members-requests.
 *
 * ### What is deliberately not here
 *
 * `CreateMembersInput` also accepts `joinData` — the applicant's answers to
 * the organization's join form. Those field definitions come from
 * `GET /organization/{id}/form`, and no application-form feature module exists
 * yet, so there is nothing to render them from. The field is optional on the
 * input type and an admin-filed request legitimately has no submitted form
 * behind it, so this creates a valid record without them. When that feature
 * lands, the dynamic fields hang off the chosen organization, here.
 *
 * ### Phone numbers are normalised, not just stripped
 *
 * The API stores a `964` country code followed by ten local digits. What
 * people type is the local form with a trunk zero — `07877242069` — which is
 * eleven digits and not a shape the backend accepts; sending it through is
 * what earns "The phone field format is invalid." `toApiPhone` collapses every
 * spelling of the same number onto the stored one, so the field can accept
 * what is natural to type and still send what is valid to store.
 *
 * ### `organizationId` is a string
 *
 * Not a slip — `members-requests` types it as a string where `members` types
 * the same field as a number (docs/api-types.md § members-requests, gotcha 1).
 * The select's value is a string throughout, so nothing has to convert.
 */

/** One page of 100 is the whole list in practice, and it is cached app-wide. */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

/**
 * §18.7 — 44px controls for touch, the §10.1 36px box from 768px up.
 *
 * The 16px text below that breakpoint is not decoration either: iOS zooms the
 * page when a field with smaller text takes focus, which shoves the sheet
 * half off-screen the moment anyone starts typing.
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
 * `organizationId` and never names it in a rejection. This maps back. Both
 * spellings are listed because only one of them costs anything to be wrong
 * about.
 */
const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  phone: "phone",
  organization_id: "organizationId",
  organizationId: "organizationId",
}

export function CreateRequestDialog() {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
            <Plus data-icon="inline-start" strokeWidth={1.75} />
            {t("requests.newShort")}
          </Button>
        }
      />
      {/* Mounted per opening, so a cancelled draft never comes back on the
          next open and the mutation's error state starts clean. */}
      {open && <CreateRequestForm onCreated={() => setOpen(false)} />}
    </Dialog>
  )
}

function CreateRequestForm({ onCreated }: { onCreated: () => void }) {
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
   * hand is a step with no decision in it — so a sole option is the choice
   * until the user makes a different one. Derived rather than written into
   * state by an effect: the list arrives after the first render, and an effect
   * that back-fills state on arrival is a second render doing what one already
   * could.
   */
  const chosenId =
    organizationId ||
    (organizationItems.length === 1 ? organizationItems[0].value : "")

  const createRequest = useCreateMemberRequests({ onSuccess: onCreated })

  /**
   * The whole-form error, once the field-level ones have been claimed.
   *
   * A 422 whose messages all landed on fields is already shown next to those
   * fields, so repeating it in a banner says the same thing twice. Anything
   * else — a 500, a dropped connection — has nowhere else to appear.
   */
  const formError = React.useMemo(() => {
    if (!createRequest.isError) return null
    const error = createRequest.error
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
  }, [createRequest.isError, createRequest.error, t])

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
    // the validation too: a number it cannot read is a number the server would
    // reject, and it rejects it with less to go on.
    const wirePhone = toApiPhone(phone)
    const found: Errors = {}

    if (!name.trim()) found.name = t("requests.form.nameRequired")
    if (!phone.trim()) found.phone = t("members.form.phoneRequired")
    else if (!wirePhone) found.phone = t("members.form.phoneInvalid")
    if (!chosenId) found.organizationId = t("members.form.organizationRequired")

    setErrors(found)
    if (Object.keys(found).length > 0) return

    createRequest.mutate(
      // `wirePhone` is a string by here — an unreadable one failed above.
      { name: name.trim(), phone: wirePhone ?? "", organizationId: chosenId },
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

  const submitting = createRequest.isPending

  return (
    <DialogContent
      // Rendered as a form, so Enter submits from any field and the footer's
      // button is a real submit button rather than a click handler.
      render={<form onSubmit={submit} noValidate />}
    >
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>{t("requests.new")}</DialogTitle>
        <DialogDescription>
          Files an application on the applicant&apos;s behalf. It lands as
          Pending and still has to be approved.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field label={t("requests.form.applicantName")} error={errors.name}>
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => edit("name", setName)(event.target.value)}
                placeholder={t("members.form.name")}
                autoComplete="off"
                disabled={submitting}
              />
            )}
          </Field>

          {/* §10.11's attached group. The country code states the field's own
              format, which is what a helper line under it would have said —
              and it says it where the value is being typed rather than after
              the fact. A pasted `+964…` or a local `0770…` still normalises,
              so the addon narrows the ask without narrowing what is taken. */}
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
          {submitting ? t("common.creating") : t("requests.create")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
