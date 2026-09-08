"use client"

import * as React from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useT } from "@/i18n/context"

/**
 * "Reset two-factor" for a staff account — `POST /{resource}/{id}/reset`.
 *
 * Shared by the three user screens (`/organizations/users`, `/branches/users`,
 * `/management/admins`): the interaction and the shape of the warning are
 * identical, only the endpoint and the noun differ. The screen owns the
 * mutation and passes `onConfirm` plus its own copy.
 *
 * ### Not a red button
 *
 * `destructive={false}` — this is a deliberate, reversible administrative
 * action (they simply enrol again), not a delete. It still warns, because the
 * risk here is social: whoever completes the next enrolment holds the factor.
 */
export function ResetMfaDialog({
  open,
  onOpenChange,
  subjectName,
  onConfirm,
  pending,
  error,
  reset,
  copy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectName: string
  onConfirm: () => void
  pending: boolean
  error?: unknown
  /** The mutation's `reset`, so a stale failure never greets the next account. */
  reset: () => void
  copy: {
    title: string
    description: string
    note: string
    action: string
    pending: string
    failed: string
  }
}) {
  const t = useT()

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      terms={[{ label: t("members.form.name"), value: subjectName }]}
      note={copy.note}
      confirmLabel={copy.action}
      pendingLabel={copy.pending}
      destructive={false}
      onConfirm={onConfirm}
      pending={pending}
      error={error}
      errorFallback={copy.failed}
    />
  )
}
