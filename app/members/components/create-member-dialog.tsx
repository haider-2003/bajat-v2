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
import { useCreateMember } from "@/features/members/api"
import { useGetOrganizations } from "@/features/organizations/api"
import { toApiPhone } from "@/utils/format"
import type { ApiErrorBody } from "@/types/api"

/**
 * Create a member — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /member` via `useCreateMember`. The payload is `CreateMembersInput`:
 * `{ name, phone, organizationIds }`. See docs/api-types.md § members.
 *
 * ### Adding a member here bypasses the request flow
 *
 * The normal way a member comes into being is an approved `MemberRequest`.
 * This dialog is the other way — an administrator entering someone directly —
 * so it deliberately says so rather than looking like the same action as
 * filing a request.
 *
 * ### `organizationIds` is plural, and an array
 *
 * Membership is many-to-many, and the endpoint validates the plural
 * `organization_ids` — a singular `organization_id` is not a differently-named
 * version of the same thing, it is a *missing* field, and the server says so:
 * *"The organization ids field is required."* The members-requests dialog
 * beside this one really does send a singular `organizationId` (docs/api-types.md
 * § members-requests, gotcha 1), which is what makes the mistake easy to make.
 *
 * The values stay strings — the select's values already are, and the endpoint
 * takes `["22", "23"]`. The picker here chooses one; it is wrapped in an array
 * of one rather than sent bare.
 *
 * ### Phone numbers are normalised, not just stripped
 *
 * The API stores a `964` country code followed by ten local digits. What
 * people type is the local form with a trunk zero — `07877242069` — which the
 * backend rejects outright. `toApiPhone` collapses every spelling onto the
 * stored one.
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

type FieldName = "name" | "phone" | "organizationIds"

type Errors = Partial<Record<FieldName, string>>

/**
 * Server validation errors, keyed by the **wire** name.
 *
 * The request interceptor decamelizes on the way out, so the server never sees
 * `organizationIds` and never names it in a rejection. This maps back.
 *
 * `organization_ids.0` is in here because Laravel names the *element* when the
 * array itself is fine but a member of it is not.
 */
const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  phone: "phone",
  organization_ids: "organizationIds",
  "organization_ids.0": "organizationIds",
  organizationIds: "organizationIds",
}

export function CreateMemberDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
            <Plus data-icon="inline-start" strokeWidth={1.75} />
            New member
          </Button>
        }
      />
      {/* Mounted per opening, so a cancelled draft never comes back on the
          next open and the mutation's error state starts clean. */}
      {open && <CreateMemberForm onCreated={() => setOpen(false)} />}
    </Dialog>
  )
}

function CreateMemberForm({ onCreated }: { onCreated: () => void }) {
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

  const createMember = useCreateMember({ onSuccess: onCreated })

  /**
   * The whole-form error, once the field-level ones have been claimed.
   *
   * A 422 whose messages all landed on fields is already shown next to those
   * fields, so repeating it in a banner says the same thing twice. Anything
   * else — a 500, a dropped connection — has nowhere else to appear.
   */
  const formError = React.useMemo(() => {
    if (!createMember.isError) return null
    const error = createMember.error
    if (!axios.isAxiosError(error)) return "Something went wrong."

    const body = error.response?.data as ApiErrorBody | undefined
    const claimed = Object.keys(body?.errors ?? {}).some(
      (key) => key in WIRE_NAMES
    )
    if (claimed) return null

    return (
      body?.message ??
      (error.response
        ? "The server rejected the request."
        : "Couldn't reach the server. Check your connection and try again.")
    )
  }, [createMember.isError, createMember.error])

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

    if (!name.trim()) found.name = "Enter the member's name."
    if (!phone.trim()) found.phone = "Enter a phone number."
    else if (!wirePhone) found.phone = "That needs to be 10 digits after the code."
    if (!chosenId) found.organizationIds = "Choose an organization."

    setErrors(found)
    if (Object.keys(found).length > 0) return

    createMember.mutate(
      {
        name: name.trim(),
        // `wirePhone` is a string by here — an unreadable one failed above.
        phone: wirePhone ?? "",
        // Plural and an array — `organization_ids` on the wire. A singular
        // `organization_id` is rejected as a missing field.
        organizationIds: [chosenId],
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

  const submitting = createMember.isPending

  return (
    <DialogContent
      // Rendered as a form, so Enter submits from any field and the footer's
      // button is a real submit button rather than a click handler.
      render={<form onSubmit={submit} noValidate />}
    >
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>New member</DialogTitle>
        <DialogDescription>
          Adds someone directly, without a join request to approve.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field label="Full name" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => edit("name", setName)(event.target.value)}
                placeholder="Full name"
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
          <Field label="Phone number" error={errors.phone}>
            {(control) => (
              <InputGroup className="h-11 md:h-9">
                <InputGroupAddon className="text-base text-text-secondary md:text-sm">
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

          {/* One organization, though the input takes many and a member can
              belong to many: the rest of the membership is managed after the
              fact. The single choice still goes out as an array of one. */}
          <Field label="Organization" error={errors.organizationIds}>
            {(control) => (
              <Select
                items={organizationItems}
                value={chosenId || null}
                onValueChange={(value) =>
                  edit("organizationIds", setOrganizationId)(value ?? "")
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
                        ? "Loading organizations…"
                        : "Select an organization"
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
            Couldn&apos;t load organizations.{" "}
            <button
              type="button"
              onClick={() => organizationsQuery.refetch()}
              className="rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry
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
              Cancel
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
          {submitting ? "Creating…" : "Create member"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
