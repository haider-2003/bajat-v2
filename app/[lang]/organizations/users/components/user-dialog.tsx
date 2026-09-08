"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Loader2, UserPlus } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAuthStore } from "@/features/auth/store"
import { useGetNodes } from "@/features/nodes/api"
import {
  useCreateOrganizationUser,
  useUpdateOrganizationUser,
} from "@/features/organization-users/api"
import type { OrganizationUser } from "@/features/organization-users/types"
import { useGetOrganizations } from "@/features/organizations/api"
import { useGetRoles } from "@/features/roles/api"
import { useT } from "@/i18n/context"
import type { ApiErrorBody, BaseQuery } from "@/types/api"
import { toApiPhone } from "@/utils/format"

/**
 * Add or edit an organization user — DESIGN.md §13 / §10.
 *
 * `POST /organization_user` and `PUT /organization_user/{id}`. See
 * docs/ORG-BRANCH-MANAGEMENT-PAGES.md §3.
 *
 * ### The phone and the organization are create-time only
 *
 * The number is the login; the organization is the tenant. Neither moves, and
 * `UpdateOrganizationUserInput` has no field for either — so both controls
 * render only while creating (features/organization-users/types.ts).
 */

const ROLES_QUERY: BaseQuery = {
  page: 1,
  pageSize: 100,
  filter: [{ field: "type", value: "organization" }],
}
const HUNDRED = { page: 1, pageSize: 100 } as const

const CONTROL = "h-11 text-base md:h-9 md:text-sm"
const SELECT_TRIGGER =
  "w-full border-input bg-surface text-base data-[size=default]:h-11 focus-visible:border-accent-violet focus-visible:ring-ring/45 aria-invalid:border-danger aria-invalid:ring-danger/15 md:text-sm md:data-[size=default]:h-9 dark:bg-surface-sunken"
const ACTION = "h-11 w-full md:h-9 md:w-auto"

type FieldName = "name" | "phone" | "organizationId" | "roleIds" | "nodeIds"

type Errors = Partial<Record<FieldName, string>>

const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  phone: "phone",
  organization_id: "organizationId",
  role_ids: "roleIds",
  "role_ids.0": "roleIds",
  node_ids: "nodeIds",
  "node_ids.0": "nodeIds",
}

export function CreateOrganizationUserDialog() {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Permission can="create-organization-user">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
              <UserPlus data-icon="inline-start" strokeWidth={1.75} />
              {t("organizationUsers.createAction")}
            </Button>
          }
        />
        {open && <UserForm user={null} onDone={() => setOpen(false)} />}
      </Dialog>
    </Permission>
  )
}

export function EditOrganizationUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: OrganizationUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && user && (
        <UserForm
          key={user.id}
          user={user}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function UserForm({
  user,
  onDone,
}: {
  user: OrganizationUser | null
  onDone: () => void
}) {
  const t = useT()
  const authUser = useAuthStore((state) => state.user)
  const isAdmin = authUser?.type === "admin"
  const editing = user !== null

  const [name, setName] = React.useState(user?.name ?? "")
  const [phone, setPhone] = React.useState(user?.phone ?? "")
  const [organizationId, setOrganizationId] = React.useState(
    user?.organization?.id?.toString() ?? ""
  )
  const [roleIds, setRoleIds] = React.useState<string[]>(
    user?.roles?.map((role) => String(role.id)) ?? []
  )
  const [nodeIds, setNodeIds] = React.useState<string[]>(
    user?.nodes?.map((node) => String(node.id)) ?? []
  )
  const [isEnabled, setIsEnabled] = React.useState(user?.isEnabled ?? true)
  const [errors, setErrors] = React.useState<Errors>({})

  const organizationsQuery = useGetOrganizations(HUNDRED, {
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

  const rolesQuery = useGetRoles(ROLES_QUERY)
  const roleOptions = React.useMemo(
    () =>
      (rolesQuery.data?.data.data ?? []).map((role) => ({
        value: String(role.id),
        label: role.name,
      })),
    [rolesQuery.data]
  )

  /** Nodes are scoped by organization *name* — that is what `/node` reads. */
  const selectedOrgName = React.useMemo(() => {
    if (editing) return user.organization?.name ?? ""
    return organizationItems.find((item) => item.value === organizationId)?.label ?? ""
  }, [editing, user, organizationItems, organizationId])

  const nodesEnabled = isAdmin ? !!selectedOrgName : true
  const nodesQuery = useGetNodes(
    React.useMemo<BaseQuery>(
      () => ({
        page: 1,
        pageSize: 200,
        filter: selectedOrgName
          ? [{ field: "organization", value: selectedOrgName }]
          : [],
      }),
      [selectedOrgName]
    ),
    { enabled: nodesEnabled }
  )
  const nodeOptions = React.useMemo(
    () =>
      (nodesQuery.data?.data.data ?? []).map((node) => ({
        value: String(node.id),
        label: node.name,
        color: node.color,
      })),
    [nodesQuery.data]
  )

  const createUser = useCreateOrganizationUser({ onSuccess: onDone })
  const updateUser = useUpdateOrganizationUser({ onSuccess: onDone })
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

    if (!name.trim()) found.name = t("organizationUsers.form.nameRequired")
    if (!editing) {
      if (!phone.trim()) found.phone = t("members.form.phoneRequired")
      else if (!wirePhone) found.phone = t("members.form.phoneInvalid")
    }
    if (isAdmin && !editing && !organizationId) {
      found.organizationId = t("members.form.organizationRequired")
    }
    if (roleIds.length === 0) {
      found.roleIds = t("organizationUsers.form.rolesRequired")
    }
    if (nodeIds.length === 0) {
      found.nodeIds = t("organizationUsers.form.nodesRequired")
    }

    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (editing) {
      updateUser.mutate(
        {
          id: user.id,
          data: {
            name: name.trim(),
            roleIds: roleIds.map((id) => parseInt(id, 10)),
            nodeIds: nodeIds.map((id) => parseInt(id, 10)),
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
        type: "organization_user",
        organizationId:
          isAdmin && organizationId ? Number(organizationId) : undefined,
        roleIds: roleIds.map((id) => parseInt(id, 10)),
        nodeIds: nodeIds.map((id) => parseInt(id, 10)),
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
          {editing
            ? t("organizationUsers.editTitle")
            : t("organizationUsers.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? t("organizationUsers.editDescription")
            : t("organizationUsers.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field
            label={t("organizationUsers.form.name")}
            error={errors.name}
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  clearError("name")
                }}
                placeholder={t("organizationUsers.form.name")}
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            )}
          </Field>

          {!editing && (
            <Field
              label={t("auth.phoneLabel")}
              helper={t("organizationUsers.form.phoneHelper")}
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

          {isAdmin && !editing && (
            <Field
              label={t("filters.attributes.organization")}
              helper={t("organizationUsers.form.organizationHelper")}
              error={errors.organizationId}
            >
              {(control) => (
                <Select
                  items={organizationItems}
                  value={organizationId || null}
                  onValueChange={(value) => {
                    setOrganizationId(value ?? "")
                    // The role and node choices are scoped to the tenant.
                    setRoleIds([])
                    setNodeIds([])
                    clearError("organizationId")
                  }}
                  disabled={submitting || organizationsQuery.isPending}
                >
                  <SelectTrigger {...control} className={SELECT_TRIGGER}>
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

          {isAdmin && editing && (
            <p className="text-xs text-text-muted">
              {t("organizationUsers.form.organizationLocked")}
            </p>
          )}

          <Field
            label={t("organizationUsers.form.rolesLabel")}
            helper={t("organizationUsers.form.rolesHelper")}
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
                placeholder={t("organizationUsers.form.rolesPlaceholder")}
                emptyLabel={t("organizationUsers.form.rolesEmpty")}
                loading={rolesQuery.isPending}
                disabled={submitting}
              />
            )}
          </Field>

          <Field
            label={t("organizationUsers.form.nodesLabel")}
            helper={t("organizationUsers.form.nodesHelper")}
            error={errors.nodeIds}
          >
            {(control) => (
              <MultiSelect
                id={control.id}
                aria-describedby={control["aria-describedby"]}
                aria-invalid={control["aria-invalid"]}
                options={nodeOptions}
                value={nodeIds}
                onChange={(next) => {
                  setNodeIds(next)
                  clearError("nodeIds")
                }}
                placeholder={t("organizationUsers.form.nodesPlaceholder")}
                emptyLabel={
                  nodesEnabled
                    ? t("organizationUsers.form.nodesEmpty")
                    : t("organizationUsers.form.organizationFirst")
                }
                loading={nodesEnabled && nodesQuery.isPending}
                disabled={submitting || !nodesEnabled}
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

        {(rolesQuery.isError || nodesQuery.isError) && (
          <p className="mt-2 text-xs text-danger">
            {rolesQuery.isError
              ? t("organizationUsers.form.rolesFailed")
              : t("organizationUsers.form.nodesFailed")}{" "}
            <button
              type="button"
              onClick={() => {
                rolesQuery.refetch()
                nodesQuery.refetch()
              }}
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
              : t("organizationUsers.createAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
