"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"

import { Permission } from "@/components/permission"
import { PermissionTree } from "@/components/roles/permission-tree"
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
import { useGetPermissions } from "@/features/permissions/api"
import { useCreateRole, useGetRole, useUpdateRole } from "@/features/roles/api"
import type { Permission as PermissionEntity, Role, RoleType } from "@/features/roles/types"
import { useT } from "@/i18n/context"
import type { ApiErrorBody, BaseQuery } from "@/types/api"

/**
 * Add or edit a role — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /role` and `PUT /role/{id}`. See docs/CRUD-MIGRATION-REFERENCE.md §1.8.
 *
 * ### One dialog, one endpoint, three screens
 *
 * `/role` holds admin, organization and branch roles alike; `type` is what
 * separates them and it is **forced**, not offered — a role's scope decides
 * which permissions may attach to it, so letting it change under an
 * already-checked tree would save a set the new scope cannot hold. The screen
 * passes its `scope` in; the form hardcodes it into the payload and the
 * permission query.
 *
 * ### Editing re-reads the role
 *
 * The list response has no `permissions[]`, so an edit fires a second
 * `GET /role/{id}` to pre-check the tree. Treating a missing list value as
 * "none" would save an empty role over a full one.
 */

/** One page of 100 is the whole permission vocabulary for a scope. */
const permissionsQuery = (scope: RoleType): BaseQuery => ({
  page: 1,
  pageSize: 100,
  filter: [{ field: "type", value: scope }],
})

/** §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

type FieldName = "name" | "permissions"

type Errors = Partial<Record<FieldName, string>>

/** Server validation errors, keyed by the wire name. */
const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  permissions: "permissions",
  "permissions.0": "permissions",
  type: "permissions",
}

/** The Add button in the page header, and the dialog behind it. */
export function CreateRoleDialog({ scope }: { scope: RoleType }) {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Permission can="create-role">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
              <ShieldCheck data-icon="inline-start" strokeWidth={1.75} />
              {t("roles.createAction")}
            </Button>
          }
        />
        {open && (
          <RoleForm scope={scope} role={null} onDone={() => setOpen(false)} />
        )}
      </Dialog>
    </Permission>
  )
}

/** The edit dialog, mounted once by the screen rather than once per row. */
export function EditRoleDialog({
  scope,
  role,
  open,
  onOpenChange,
}: {
  scope: RoleType
  role: Role | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && role && (
        <RoleForm
          key={role.id}
          scope={scope}
          role={role}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function RoleForm({
  scope,
  role,
  onDone,
}: {
  scope: RoleType
  role: Role | null
  onDone: () => void
}) {
  const t = useT()
  const editing = role !== null

  const [name, setName] = React.useState(role?.name ?? "")
  const [permissions, setPermissions] = React.useState<string[]>([])
  const [errors, setErrors] = React.useState<Errors>({})
  // The edit read seeds the tree exactly once — a later background refetch must
  // not wipe choices the user has made since.
  const seeded = React.useRef(!editing)

  const permissionList = useGetPermissions(
    React.useMemo(() => permissionsQuery(scope), [scope])
  )
  const options = React.useMemo<PermissionEntity[]>(
    () => permissionList.data?.data.data ?? [],
    [permissionList.data]
  )

  // Only fired while editing — `enabled` is `!!id` in the factory.
  const detailQuery = useGetRole(editing ? role.id : undefined)
  const loadedPermissions = React.useMemo(() => {
    const detail = detailQuery.data as
      | (Role & { data?: Role })
      | undefined
    return detail?.permissions ?? detail?.data?.permissions
  }, [detailQuery.data])

  React.useEffect(() => {
    if (seeded.current || !loadedPermissions) return
    setPermissions(loadedPermissions.map((permission) => String(permission.id)))
    seeded.current = true
  }, [loadedPermissions])

  const createRole = useCreateRole({ onSuccess: onDone })
  const updateRole = useUpdateRole({ onSuccess: onDone })
  const mutation = editing ? updateRole : createRole

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
    const found: Errors = {}
    if (!name.trim()) found.name = t("roles.form.nameRequired")
    if (permissions.length === 0) {
      found.permissions = t("roles.form.permissionsRequired")
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const data = {
      name: name.trim(),
      type: scope,
      permissions: permissions.map((id) => parseInt(id, 10)),
    }

    if (editing) {
      updateRole.mutate({ id: role.id, data }, { onError })
      return
    }
    createRole.mutate(data, { onError })
  }

  const submitting = mutation.isPending
  // Editing waits for the detail read before the tree is trustworthy to submit.
  const treeLoading = editing && detailQuery.isPending
  const treeFailed = editing && detailQuery.isError

  return (
    <DialogContent
      size="lg"
      render={<form onSubmit={submit} noValidate />}
    >
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>
          {editing ? t("roles.editTitle") : t("roles.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editing ? t("roles.editDescription") : t("roles.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field
            label={t("roles.columns.name")}
            helper={t("roles.form.nameHelper")}
            error={errors.name}
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setErrors((current) =>
                    current.name ? { ...current, name: undefined } : current
                  )
                }}
                placeholder={t("roles.form.namePlaceholder")}
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            )}
          </Field>

          <Field
            label={t("roles.form.permissionsLabel")}
            helper={t("roles.form.permissionsHelper")}
            error={errors.permissions}
          >
            {(control) =>
              treeLoading ? (
                <div className="flex h-24 items-center justify-center rounded-lg border border-border text-[13px] text-text-muted">
                  <Loader2 className="me-2 size-4 animate-spin" strokeWidth={1.75} />
                  {t("roles.loadingRole")}
                </div>
              ) : treeFailed ? (
                <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
                  {t("roles.roleLoadFailed")}{" "}
                  <button
                    type="button"
                    onClick={() => detailQuery.refetch()}
                    className="font-medium underline underline-offset-4"
                  >
                    {t("common.retry")}
                  </button>
                </div>
              ) : permissionList.isError ? (
                <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
                  {t("roles.form.permissionsFailed")}{" "}
                  <button
                    type="button"
                    onClick={() => permissionList.refetch()}
                    className="font-medium underline underline-offset-4"
                  >
                    {t("common.retry")}
                  </button>
                </div>
              ) : (
                <PermissionTree
                  permissions={options}
                  value={permissions}
                  onChange={(next) => {
                    setPermissions(next)
                    setErrors((current) =>
                      current.permissions
                        ? { ...current, permissions: undefined }
                        : current
                    )
                  }}
                  disabled={submitting || permissionList.isPending}
                  invalid={!!errors.permissions}
                  describedBy={control["aria-describedby"]}
                />
              )
            }
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
        <Button
          type="submit"
          className={ACTION}
          disabled={submitting || treeLoading || treeFailed}
        >
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
              : t("roles.createAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
