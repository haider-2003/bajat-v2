"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Building2, Loader2 } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import {
  useCreateOrganization,
  useUpdateOrganization,
} from "@/features/organizations/api"
import type { Organization } from "@/features/organizations/types"
import { useT } from "@/i18n/context"
import type { ApiErrorBody } from "@/types/api"

import { LogoField } from "./logo-field"

/**
 * Add or edit an organization — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /organization` and `POST /organization/{id}` (a spoofed PUT). The whole
 * resource is `multipart/form-data` because of the `logo` file
 * (features/organizations/api.ts).
 *
 * ### One dialog for both verbs
 *
 * The fields are identical and the payloads differ only in defaults, so two
 * components would be one component and a copy of it drifting.
 */

/** §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

type FieldName = "name" | "description" | "website" | "logo"

type Errors = Partial<Record<FieldName, string>>

/** Server validation errors, keyed by the wire name. */
const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  description: "description",
  website: "website",
  logo: "logo",
}

export function CreateOrganizationDialog() {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Permission can="create-organization">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
              <Building2 data-icon="inline-start" strokeWidth={1.75} />
              {t("organizations.createAction")}
            </Button>
          }
        />
        {open && (
          <OrganizationForm organization={null} onDone={() => setOpen(false)} />
        )}
      </Dialog>
    </Permission>
  )
}

export function EditOrganizationDialog({
  organization,
  open,
  onOpenChange,
}: {
  organization: Organization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && organization && (
        <OrganizationForm
          key={organization.id}
          organization={organization}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function OrganizationForm({
  organization,
  onDone,
}: {
  organization: Organization | null
  onDone: () => void
}) {
  const t = useT()
  const editing = organization !== null

  const [name, setName] = React.useState(organization?.name ?? "")
  const [description, setDescription] = React.useState(
    organization?.description ?? ""
  )
  const [website, setWebsite] = React.useState(organization?.website ?? "")
  const [logo, setLogo] = React.useState<File | null>(null)
  const [isEnabled, setIsEnabled] = React.useState(
    organization?.isEnabled ?? true
  )
  const [isJoinRequestsEnabled, setIsJoinRequestsEnabled] = React.useState(
    organization?.isJoinRequestsEnabled ?? true
  )
  const [errors, setErrors] = React.useState<Errors>({})

  const createOrganization = useCreateOrganization({ onSuccess: onDone })
  const updateOrganization = useUpdateOrganization({ onSuccess: onDone })
  const mutation = editing ? updateOrganization : createOrganization

  const formError = React.useMemo(() => {
    if (!mutation.isError) return null
    const error = mutation.error
    if (!axios.isAxiosError(error)) return t("common.somethingWentWrong")
    const body = error.response?.data as ApiErrorBody | undefined
    const claimed = Object.keys(body?.errors ?? {}).some((key) => key in WIRE_NAMES)
    if (claimed) return null
    return (
      body?.message ??
      (error.response
        ? t("common.serverRejected")
        : t("common.cannotReachServer"))
    )
  }, [mutation.isError, mutation.error, t])

  const clearError = (field: FieldName) =>
    setErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current
    )

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
    const trimmedWebsite = website.trim()
    const found: Errors = {}

    if (!name.trim()) found.name = t("organizations.form.nameRequired")
    if (trimmedWebsite && !/^https?:\/\//i.test(trimmedWebsite)) {
      found.website = t("organizations.form.websiteInvalid")
    }

    setErrors(found)
    if (Object.keys(found).length > 0) return

    const data = {
      name: name.trim(),
      // `""` clears a field server-side; `undefined` leaves it — so an empty
      // optional is dropped, not sent blank (features/organizations/types.ts).
      description: description.trim() || undefined,
      website: trimmedWebsite || undefined,
      // No new file on edit → `undefined` → the stored logo is kept.
      logo: logo ?? undefined,
      isEnabled: (isEnabled ? 1 : 0) as 0 | 1,
      isJoinRequestsEnabled: (isJoinRequestsEnabled ? 1 : 0) as 0 | 1,
    }

    if (editing) {
      updateOrganization.mutate({ id: organization.id, data }, { onError })
      return
    }
    createOrganization.mutate(data, { onError })
  }

  const submitting = mutation.isPending

  return (
    <DialogContent render={<form onSubmit={submit} noValidate />}>
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>
          {editing
            ? t("organizations.editTitle")
            : t("organizations.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? t("organizations.editDescription")
            : t("organizations.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field label={t("organizations.columns.name")} error={errors.name}>
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  clearError("name")
                }}
                placeholder={t("organizations.form.namePlaceholder")}
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            )}
          </Field>

          <Field
            label={t("organizations.form.descriptionLabel")}
            error={errors.description}
            optional
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  clearError("description")
                }}
                placeholder={t("organizations.form.descriptionPlaceholder")}
                autoComplete="off"
                disabled={submitting}
              />
            )}
          </Field>

          <Field
            label={t("organizations.form.websiteLabel")}
            error={errors.website}
            optional
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                type="url"
                inputMode="url"
                dir="ltr"
                value={website}
                onChange={(event) => {
                  setWebsite(event.target.value)
                  clearError("website")
                }}
                placeholder={t("organizations.form.websitePlaceholder")}
                autoComplete="off"
                disabled={submitting}
              />
            )}
          </Field>

          <Field
            label={t("organizations.form.logoLabel")}
            error={errors.logo}
            optional
          >
            {(control) => (
              <LogoField
                id={control.id}
                describedBy={control["aria-describedby"]}
                invalid={!!errors.logo}
                value={logo}
                existingUrl={organization?.logo}
                onChange={setLogo}
                onError={(message) =>
                  setErrors((current) => ({ ...current, logo: message ?? undefined }))
                }
                disabled={submitting}
              />
            )}
          </Field>

          <SwitchRow
            label={t("organizations.form.enabledLabel")}
            helper={t("organizations.form.enabledHelper")}
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            disabled={submitting}
          />
          <SwitchRow
            label={t("organizations.form.joinRequestsLabel")}
            helper={t("organizations.form.joinRequestsHelper")}
            checked={isJoinRequestsEnabled}
            onCheckedChange={setIsJoinRequestsEnabled}
            disabled={submitting}
          />
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
              : t("organizations.createAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** §10.8 — a labelled switch row for the two tenant toggles. */
function SwitchRow({
  label,
  helper,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  helper: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-text">{label}</span>
        <span className="mt-0.5 block text-xs text-text-muted">{helper}</span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </label>
  )
}
