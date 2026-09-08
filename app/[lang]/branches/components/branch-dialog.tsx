"use client"

import * as React from "react"
import axios from "axios"
import { AlertCircle, GitBranch, Loader2 } from "lucide-react"

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
import {
  useCreateBranch,
  useGetBranches,
  useUpdateBranch,
} from "@/features/branches/api"
import {
  branchNodeIds,
  branchOrganizationId,
  branchParentId,
  type Branch,
} from "@/features/branches/types"
import { useGetNodes } from "@/features/nodes/api"
import { useGetOrganizations } from "@/features/organizations/api"
import { useT } from "@/i18n/context"
import type { ApiErrorBody, BaseQuery } from "@/types/api"

/**
 * Add or edit a branch — DESIGN.md §13 for the dialog, §10 for the form.
 *
 * `POST /branch` and `PUT /branch/{id}`. See docs/ORG-BRANCH-MANAGEMENT-PAGES.md §5.
 *
 * ### `parentId: null` is the whole point of the update shape
 *
 * Omitting the key keeps the existing parent; sending an explicit `null`
 * detaches the branch to the top of the tree. That is the only way to detach
 * one (features/branches/types.ts), so the update payload always carries a
 * `parentId`, never leaves it off.
 *
 * ### The organization is create-time only
 *
 * A branch does not change tenant, so the org select renders only while an admin
 * is creating. Non-admins never see it — the backend scopes by token.
 */

const HUNDRED = { page: 1, pageSize: 100 } as const

/** §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"
const SELECT_TRIGGER =
  "w-full border-input bg-surface text-base data-[size=default]:h-11 focus-visible:border-accent-violet focus-visible:ring-ring/45 aria-invalid:border-danger aria-invalid:ring-danger/15 md:text-sm md:data-[size=default]:h-9 dark:bg-surface-sunken"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

/** The parent select's "no parent" sentinel — an empty value confuses the primitive. */
const NONE = "__none__"

type FieldName = "name" | "organizationId" | "parentId" | "nodeIds"

type Errors = Partial<Record<FieldName, string>>

const WIRE_NAMES: Record<string, FieldName> = {
  name: "name",
  organization_id: "organizationId",
  parent_id: "parentId",
  node_ids: "nodeIds",
  "node_ids.0": "nodeIds",
}

export function CreateBranchDialog() {
  const t = useT()
  const [open, setOpen] = React.useState(false)

  return (
    <Permission can="create-branch">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="lg" className="h-11 w-full sm:h-9 sm:w-auto">
              <GitBranch data-icon="inline-start" strokeWidth={1.75} />
              {t("branches.createAction")}
            </Button>
          }
        />
        {open && <BranchForm branch={null} onDone={() => setOpen(false)} />}
      </Dialog>
    </Permission>
  )
}

export function EditBranchDialog({
  branch,
  open,
  onOpenChange,
}: {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && branch && (
        <BranchForm
          key={branch.id}
          branch={branch}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function BranchForm({
  branch,
  onDone,
}: {
  branch: Branch | null
  onDone: () => void
}) {
  const t = useT()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.type === "admin"
  const editing = branch !== null

  const [name, setName] = React.useState(branch?.name ?? "")
  const [organizationId, setOrganizationId] = React.useState(
    editing ? (branchOrganizationId(branch)?.toString() ?? "") : ""
  )
  const [parentId, setParentId] = React.useState(
    editing ? (branchParentId(branch)?.toString() ?? "") : ""
  )
  const [nodeIds, setNodeIds] = React.useState<string[]>(
    editing ? branchNodeIds(branch).map(String) : []
  )
  const [isEnabled, setIsEnabled] = React.useState(branch?.isEnabled ?? true)
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

  /** The org whose branches and nodes the pickers are scoped to. */
  const selectedOrgId =
    organizationId || (editing ? branchOrganizationId(branch)?.toString() : "") || ""
  const selectedOrgName = React.useMemo(() => {
    if (editing && branch.organization?.name) return branch.organization.name
    return organizationItems.find((item) => item.value === selectedOrgId)?.label ?? ""
  }, [editing, branch, organizationItems, selectedOrgId])

  const scopedQuery = React.useMemo<BaseQuery>(
    () => ({
      page: 1,
      pageSize: 100,
      filter: selectedOrgName
        ? [{ field: "organization", value: selectedOrgName }]
        : [],
    }),
    [selectedOrgName]
  )
  const nodesScopedQuery = React.useMemo<BaseQuery>(
    () => ({ ...scopedQuery, pageSize: 1000 }),
    [scopedQuery]
  )

  const dependenciesEnabled = !isAdmin || !!selectedOrgName

  const branchesQuery = useGetBranches(scopedQuery, {
    enabled: dependenciesEnabled,
  })
  const nodesQuery = useGetNodes(nodesScopedQuery, {
    enabled: dependenciesEnabled,
  })

  const parentItems = React.useMemo(
    () =>
      (branchesQuery.data?.data.data ?? [])
        // A branch cannot be its own parent.
        .filter((option) => option.id !== branch?.id)
        .map((option) => ({ value: String(option.id), label: option.name })),
    [branchesQuery.data, branch]
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

  const createBranch = useCreateBranch({ onSuccess: onDone })
  const updateBranch = useUpdateBranch({ onSuccess: onDone })
  const mutation = editing ? updateBranch : createBranch

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
    const found: Errors = {}

    if (!name.trim()) found.name = t("branches.form.nameRequired")
    if (isAdmin && !editing && !organizationId) {
      found.organizationId = t("members.form.organizationRequired")
    }
    if (nodeIds.length === 0) found.nodeIds = t("branches.form.nodesRequired")

    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (editing) {
      updateBranch.mutate(
        {
          id: branch.id,
          data: {
            name: name.trim(),
            // Explicit `null` detaches; a value re-parents; the key is always sent.
            parentId: parentId ? parseInt(parentId, 10) : null,
            nodeIds: nodeIds.map((id) => parseInt(id, 10)),
            isEnabled: (isEnabled ? 1 : 0) as 0 | 1,
          },
        },
        { onError }
      )
      return
    }

    createBranch.mutate(
      {
        name: name.trim(),
        parentId: parentId ? parseInt(parentId, 10) : undefined,
        // Omitted for an org-scoped account — the backend scopes by the token.
        organizationId:
          isAdmin && organizationId ? parseInt(organizationId, 10) : undefined,
        nodeIds: nodeIds.map((id) => parseInt(id, 10)),
        isEnabled: (isEnabled ? 1 : 0) as 0 | 1,
      },
      { onError }
    )
  }

  const submitting = mutation.isPending
  const showOrgSelect = isAdmin && !editing

  return (
    <DialogContent render={<form onSubmit={submit} noValidate />}>
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>
          {editing ? t("branches.editTitle") : t("branches.createTitle")}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? t("branches.editDescription")
            : t("branches.createDescription")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field label={t("branches.columns.name")} error={errors.name}>
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  clearError("name")
                }}
                placeholder={t("branches.form.namePlaceholder")}
                autoComplete="off"
                autoFocus
                disabled={submitting}
              />
            )}
          </Field>

          {showOrgSelect && (
            <Field
              label={t("branches.form.organizationLabel")}
              error={errors.organizationId}
            >
              {(control) => (
                <Select
                  items={organizationItems}
                  value={organizationId || null}
                  onValueChange={(value) => {
                    setOrganizationId(value ?? "")
                    // Changing the tenant invalidates the parent and node choices.
                    setParentId("")
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
              {t("branches.form.organizationLocked")}
            </p>
          )}

          <Field
            label={t("branches.form.parentLabel")}
            helper={t("branches.form.parentHelper")}
            error={errors.parentId}
            optional
          >
            {(control) => (
              <Select
                items={[
                  { value: NONE, label: t("branches.form.parentNone") },
                  ...parentItems,
                ]}
                value={parentId || NONE}
                onValueChange={(value) => {
                  setParentId(value === NONE ? "" : (value ?? ""))
                  clearError("parentId")
                }}
                disabled={
                  submitting ||
                  !dependenciesEnabled ||
                  branchesQuery.isPending
                }
              >
                <SelectTrigger {...control} className={SELECT_TRIGGER}>
                  <SelectValue
                    className="truncate"
                    placeholder={
                      !dependenciesEnabled
                        ? t("branches.form.organizationFirst")
                        : branchesQuery.isPending
                          ? t("common.loading")
                          : t("branches.form.parentNone")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {t("branches.form.parentNone")}
                  </SelectItem>
                  {parentItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label={t("branches.form.nodesLabel")}
            helper={t("branches.form.nodesHelper")}
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
                  dependenciesEnabled
                    ? t("branches.form.nodesEmpty")
                    : t("branches.form.organizationFirst")
                }
                loading={dependenciesEnabled && nodesQuery.isPending}
                disabled={submitting || !dependenciesEnabled}
              />
            )}
          </Field>

          <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-text">
                {t("branches.form.enabledLabel")}
              </span>
              <span className="mt-0.5 block text-xs text-text-muted">
                {t("branches.form.enabledHelper")}
              </span>
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              disabled={submitting}
            />
          </label>
        </FieldSet>

        {(branchesQuery.isError || nodesQuery.isError) && (
          <p className="mt-2 text-xs text-danger">
            {t("common.loadFailed")}{" "}
            <button
              type="button"
              onClick={() => {
                branchesQuery.refetch()
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
              : t("branches.createAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
