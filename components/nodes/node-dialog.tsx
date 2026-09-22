"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Loader2, Workflow } from "lucide-react"

import { Permission } from "@/components/permission"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthStore } from "@/features/auth/store"
import { useCreateNode, useUpdateNode } from "@/features/nodes/api"
import type { Node } from "@/features/nodes/types"
import { useGetOrganizations } from "@/features/organizations/api"
import { useT } from "@/i18n/context"
import type { ApiErrorBody } from "@/types/api"

import { ColorField, normalizeHex } from "./color-field"

/**
 * Add or edit a workflow node — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /node` and `PUT /node/{id}`. See docs/CRUD-MIGRATION-REFERENCE.md §1.3.
 *
 * ### One dialog for both verbs
 *
 * The fields are identical and the payloads differ by one key, so two
 * components would be one component and a copy of it drifting. What changes is
 * the title, the button, and whether the organization select renders at all.
 *
 * ### The organization is create-time only
 *
 * A node carries the history of every identity that passed through it, so the
 * backend does not accept a new `organization_id` on update — `UpdateNodeInput`
 * has no such field. Rendering the select while editing would offer a change
 * that is silently dropped, which is worse than not offering it: the form
 * would close having appeared to succeed.
 *
 * ### Non-admins never see it either
 *
 * An org-scoped token is scoped by the backend. Sending an `organization_id`
 * they did not choose is at best redundant and at worst a node filed under the
 * wrong tenant, so the key is omitted entirely (§3.3).
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

/**
 * The colour a new node starts on.
 *
 * Not `#000000`. Black is a legitimate colour, so a black default is
 * indistinguishable from a deliberate choice — and it is the one colour that
 * reads as "unset" on a board where every other chip is saturated. Starting on
 * a real accent means a node created without touching the field still looks
 * like the rest of the app.
 */
const DEFAULT_COLOR = "#2563EB"

type FieldName = "name" | "color" | "organizationId"

type Errors = Partial<Record<FieldName, string>>

/**
 * Server validation errors, keyed by the **wire** name.
 *
 * The request interceptor decamelizes on the way out, so the server never sees
 * `organizationId` and never names it in a rejection. This maps back.
 */
const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  color: "color",
  organization_id: "organizationId",
  organizationId: "organizationId",
}

/**
 * The Add button, and the dialog behind it.
 *
 * ### The trigger is a prop, the form is not
 *
 * Two screens open this: the `/nodes` page header, where it is the screen's
 * primary action and takes §7.1's solid button, and the flow builder's step
 * library, where it is a quiet dashed row at the foot of a rail. Those are
 * genuinely different controls, and forcing one shape on both would put a
 * black 36px button inside a 288px sidebar.
 *
 * What is *not* per-caller is anything below the trigger. A second create form
 * would be a second copy of this endpoint's field rules — the hex
 * normalisation, the admin-only organization select, the wire-name error map —
 * drifting from the day it was written. So the trigger is passed in and
 * everything else is fixed.
 */
export function CreateNodeDialog({
  trigger,
  defaultOrganizationId,
}: {
  /** Overrides the default button. Must accept a click — it is the trigger. */
  trigger?: React.ReactElement
  /**
   * Preselects the organization select, for a caller that already knows the
   * answer — the flow builder, whose rail lists one organization's steps and
   * whose new step belongs in that same organization. Still a preselection
   * and not a lock: an admin who opened the wrong template can change it.
   * Ignored for a non-admin, who has no select and is scoped by their token.
   */
  defaultOrganizationId?: number
} = {}) {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Permission can="create-node">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
                <Workflow data-icon="inline-start" strokeWidth={1.75} />
                {t("nodes.createTitle")}
              </Button>
            )
          }
        />
        {/* Mounted per opening, so a cancelled draft never comes back on the
            next open and the mutation's error state starts clean. */}
        {open && (
          <NodeForm
            node={null}
            defaultOrganizationId={defaultOrganizationId}
            onDone={() => setOpen(false)}
          />
        )}
      </Dialog>
    </Permission>
  )
}

/** The edit dialog, mounted once by the screen rather than once per row. */
export function EditNodeDialog({
  node,
  open,
  onOpenChange,
}: {
  /** `null` between openings — nothing renders. */
  node: Node | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keyed on the row: opening a second node after a first must start from
          that node's values, not from the previous form state. */}
      {open && node && (
        <NodeForm key={node.id} node={node} onDone={() => onOpenChange(false)} />
      )}
    </Dialog>
  )
}

function NodeForm({
  node,
  defaultOrganizationId,
  onDone,
}: {
  node: Node | null
  /** Create only — see `CreateNodeDialog`. */
  defaultOrganizationId?: number
  onDone: () => void
}) {
  const t = useT()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.type === "admin"
  const editing = node !== null

  const [name, setName] = React.useState(node?.name ?? "")
  const [color, setColor] = React.useState(node?.color ?? DEFAULT_COLOR)
  /** `""` is "nothing chosen" — the select is handed `null` for that. */
  const [organizationId, setOrganizationId] = React.useState(
    defaultOrganizationId ? String(defaultOrganizationId) : ""
  )
  const [errors, setErrors] = React.useState<Errors>({})

  // Only admins choose one, and only while creating — so the request is not
  // made at all in the two cases where the answer would go unused.
  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY, {
    enabled: isAdmin && !editing,
  })
  const organizationItems = React.useMemo(
    () =>
      (organizationsQuery.data?.data.data ?? []).map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
    [organizationsQuery.data]
  )

  /**
   * The organization actually being submitted.
   *
   * A single-organization account picking it by hand is a step with no
   * decision in it. Derived rather than written into state by an effect: the
   * list arrives after the first render, and an effect that back-fills state
   * on arrival is a second render doing what one already could.
   */
  const chosenId =
    organizationId ||
    (organizationItems.length === 1 ? organizationItems[0].value : "")

  const createNode = useCreateNode({ onSuccess: onDone })
  const updateNode = useUpdateNode({ onSuccess: onDone })
  const mutation = editing ? updateNode : createNode

  /**
   * The whole-form error, once the field-level ones have been claimed.
   *
   * A 422 whose messages all landed on fields is already shown next to those
   * fields, so repeating it in a banner says the same thing twice. Anything
   * else — a duplicate name the backend refuses, a 500, a dropped connection —
   * has nowhere else to appear.
   */
  const formError = React.useMemo(() => {
    if (!mutation.isError) return null
    const error = mutation.error
    if (!axios.isAxiosError(error)) return t("common.somethingWentWrong")

    const body = error.response?.data as ApiErrorBody | undefined
    const claimed = Object.keys(body?.errors ?? {}).some((key) => key in WIRE_NAMES)
    if (claimed) return null

    return (
      body?.message ??
      (error.response ? t("common.serverRejected") : t("common.cannotReachServer"))
    )
  }, [mutation.isError, mutation.error, t])

  /** Clears a field's error the moment it is edited. */
  const edit =
    (field: FieldName, set: (value: string) => void) => (value: string) => {
      set(value)
      setErrors((current) =>
        current[field] ? { ...current, [field]: undefined } : current
      )
    }

  /** A 422 names the offending fields; put each message beside its field. */
  const onError = (error: unknown) => {
    if (!axios.isAxiosError(error)) return
    const body = error.response?.data as ApiErrorBody | undefined
    const next: Errors = {}
    for (const [key, messages] of Object.entries(body?.errors ?? {})) {
      const field = WIRE_NAMES[key]
      if (field && messages[0]) next[field] = messages[0]
    }
    setErrors(next)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    // Whatever was typed, reduced to the one spelling the API stores. This is
    // the validation too: a colour it cannot read is one the server would
    // reject, and it rejects it with less to go on.
    const wireColor = normalizeHex(color)
    const found: Errors = {}

    if (!name.trim()) found.name = t("nodes.form.nameRequired")
    if (!wireColor) found.color = t("nodes.form.colorInvalid")
    // Only asked for where it is actually rendered — see the header note.
    if (isAdmin && !editing && !chosenId) {
      found.organizationId = t("members.form.organizationRequired")
    }

    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (editing) {
      // No `organizationId`: `UpdateNodeInput` has no such field, and the
      // endpoint would ignore it anyway.
      updateNode.mutate(
        {
          id: node.id,
          data: { name: name.trim(), color: wireColor as string },
        },
        { onError }
      )
      return
    }

    createNode.mutate(
      {
        name: name.trim(),
        color: wireColor as string,
        // Omitted entirely for an org-scoped account — the backend scopes by
        // the token, and a key sent as `undefined` is dropped before the wire.
        organizationId: isAdmin && chosenId ? Number(chosenId) : undefined,
      },
      { onError }
    )
  }

  const submitting = mutation.isPending

  return (
    <DialogContent
      // Rendered as a form, so Enter submits from any field and the footer's
      // button is a real submit button rather than a click handler.
      render={<form onSubmit={submit} noValidate />}
    >
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>
          {editing ? t("nodes.editTitle") : t("nodes.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editing ? t("nodes.editDescription") : t("nodes.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field
            label={t("nodes.columns.name")}
            helper={t("nodes.form.nameHelper")}
            error={errors.name}
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => edit("name", setName)(event.target.value)}
                placeholder={t("nodes.form.namePlaceholder")}
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            )}
          </Field>

          <Field
            label={t("nodes.form.colorLabel")}
            helper={t("nodes.form.colorHelper")}
            error={errors.color}
          >
            {(control) => (
              <ColorField
                {...control}
                value={color}
                onChange={edit("color", setColor)}
                disabled={submitting}
              />
            )}
          </Field>

          {isAdmin && !editing && (
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
          )}

          {/* Said once, where the missing control would otherwise read as a
              bug: the organization is not editable, it is not just absent. */}
          {isAdmin && editing && (
            <p className="text-xs text-text-muted">
              {t("nodes.form.organizationLocked")}
            </p>
          )}
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
          {submitting
            ? editing
              ? t("common.saving")
              : t("common.creating")
            : editing
              ? t("common.saveChanges")
              : t("nodes.createAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
