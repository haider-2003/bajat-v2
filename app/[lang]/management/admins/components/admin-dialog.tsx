"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Loader2, ShieldPlus } from "lucide-react"

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
import { Input, InputGroup, InputGroupAddon } from "@/components/ui/input"
import { MultiSelect } from "@/components/ui/multi-select"
import { Switch } from "@/components/ui/switch"
import { useGetRoles } from "@/features/roles/api"
import { useCreateUser, useUpdateUser } from "@/features/users/api"
import type { User } from "@/features/users/types"
import { useT } from "@/i18n/context"
import type { ApiErrorBody, BaseQuery } from "@/types/api"
import { toApiPhone } from "@/utils/format"

/**
 * Add or edit a platform admin — DESIGN.md §13 / §10.
 *
 * `POST /user` and `PUT /user/{id}`. See docs/ORG-BRANCH-MANAGEMENT-PAGES.md §8.
 *
 * ### `roleId`, singular, holding an array
 *
 * `/user` alone spells the field `role_id` while still taking a list — sending
 * `role_ids` here is a parameter the endpoint ignores, so the admin is created
 * with no roles and no error (features/users/types.ts). The submit maps the
 * string ids to numbers under `roleId`.
 *
 * ### No organization, no nodes
 *
 * An admin is platform-wide — there is nothing to scope, so this form has no
 * dependent lookups.
 */

const ROLES_QUERY: BaseQuery = {
  page: 1,
  pageSize: 100,
  filter: [{ field: "type", value: "admin" }],
}

const CONTROL = "h-11 text-base md:h-9 md:text-sm"
const ACTION = "h-11 w-full md:h-9 md:w-auto"

type FieldName = "name" | "phone" | "roleIds"

type Errors = Partial<Record<FieldName, string>>

const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  phone: "phone",
  role_id: "roleIds",
  "role_id.0": "roleIds",
  role_ids: "roleIds",
}

export function CreateAdminDialog() {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Permission can="create-user">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
              <ShieldPlus data-icon="inline-start" strokeWidth={1.75} />
              {t("admins.createAction")}
            </Button>
          }
        />
        {open && <AdminForm user={null} onDone={() => setOpen(false)} />}
      </Dialog>
    </Permission>
  )
}

export function EditAdminDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && user && (
        <AdminForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
      )}
    </Dialog>
  )
}

function AdminForm({
  user,
  onDone,
}: {
  user: User | null
  onDone: () => void
}) {
  const t = useT()
  const editing = user !== null

  const [name, setName] = React.useState(user?.name ?? "")
  const [phone, setPhone] = React.useState(user?.phone ?? "")
  const [roleIds, setRoleIds] = React.useState<string[]>(
    user?.roles?.map((role) => String(role.id)) ?? []
  )
  const [isEnabled, setIsEnabled] = React.useState(user?.isEnabled ?? true)
  const [errors, setErrors] = React.useState<Errors>({})

  const rolesQuery = useGetRoles(ROLES_QUERY)
  const roleOptions = React.useMemo(
    () =>
      (rolesQuery.data?.data.data ?? []).map((role) => ({
        value: String(role.id),
        label: role.name,
      })),
    [rolesQuery.data]
  )

  const createUser = useCreateUser({ onSuccess: onDone })
  const updateUser = useUpdateUser({ onSuccess: onDone })
  const mutation = editing ? updateUser : createUser

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
    const wirePhone = editing ? user.phone : toApiPhone(phone)
    const found: Errors = {}

    if (!name.trim()) found.name = t("admins.form.nameRequired")
    if (!editing) {
      if (!phone.trim()) found.phone = t("members.form.phoneRequired")
      else if (!wirePhone) found.phone = t("members.form.phoneInvalid")
    }
    if (roleIds.length === 0) found.roleIds = t("admins.form.rolesRequired")

    setErrors(found)
    if (Object.keys(found).length > 0) return

    const roleId = roleIds.map((id) => parseInt(id, 10))

    if (editing) {
      updateUser.mutate(
        {
          id: user.id,
          data: {
            name: name.trim(),
            roleId,
            isEnabled: (isEnabled ? 1 : 0) as 0 | 1,
          },
        },
        { onError }
      )
      return
    }

    createUser.mutate(
      {
        name: name.trim(),
        phone: wirePhone ?? "",
        // `type` rides along — the entity keys the account kind off it.
        type: "admin",
        roleId,
        isEnabled: (isEnabled ? 1 : 0) as 0 | 1,
      },
      { onError }
    )
  }

  const submitting = mutation.isPending

  return (
    <DialogContent render={<form onSubmit={submit} noValidate />}>
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>
          {editing ? t("admins.editTitle") : t("admins.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editing ? t("admins.editDescription") : t("admins.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        {!editing && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5">
            <AlertCircle
              className="mt-px size-4 shrink-0 text-warning"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-warning">
              {t("admins.scopeWarning")}
            </p>
          </div>
        )}

        <FieldSet>
          <Field label={t("admins.form.name")} error={errors.name}>
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  clearError("name")
                }}
                placeholder={t("admins.form.name")}
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            )}
          </Field>

          {!editing && (
            <Field
              label={t("auth.phoneLabel")}
              helper={t("admins.form.phoneHelper")}
              error={errors.phone}
            >
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
                    onChange={(event) => {
                      setPhone(event.target.value)
                      clearError("phone")
                    }}
                    placeholder="770 123 4567"
                    autoComplete="off"
                    disabled={submitting}
                  />
                </InputGroup>
              )}
            </Field>
          )}

          <Field
            label={t("admins.form.rolesLabel")}
            helper={t("admins.form.rolesHelper")}
            error={errors.roleIds}
          >
            {(control) => (
              <MultiSelect
                id={control.id}
                aria-describedby={control["aria-describedby"]}
                aria-invalid={control["aria-invalid"]}
                options={roleOptions}
                value={roleIds}
                onChange={(next) => {
                  setRoleIds(next)
                  clearError("roleIds")
                }}
                placeholder={t("admins.form.rolesPlaceholder")}
                emptyLabel={t("admins.form.rolesEmpty")}
                loading={rolesQuery.isPending}
                disabled={submitting}
              />
            )}
          </Field>

          <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-text">
                {t("common.accountEnabledLabel")}
              </span>
              <span className="mt-0.5 block text-xs text-text-muted">
                {t("common.accountEnabledHelper")}
              </span>
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              disabled={submitting}
            />
          </label>
        </FieldSet>

        {rolesQuery.isError && (
          <p className="mt-2 text-xs text-danger">
            {t("admins.form.rolesFailed")}{" "}
            <button
              type="button"
              onClick={() => rolesQuery.refetch()}
              className="font-medium underline underline-offset-4"
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
              : t("admins.createAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
