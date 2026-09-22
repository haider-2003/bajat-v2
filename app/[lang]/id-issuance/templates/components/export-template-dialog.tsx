"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { readApiError } from "@/components/ui/confirm-dialog"
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
} from "@/components/ui/dialog"
import { Field, FieldSet } from "@/components/ui/field"
import { MultiSelect } from "@/components/ui/multi-select"
import { STATUS_OPTION_KEYS } from "@/features/ids/status"
import { useExportTemplate } from "@/features/templates/api"
import type { Template } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import { Link } from "@/i18n/navigation"
import { formatText } from "@/utils/format"

/**
 * Export — `GET /template/export/{id}` (docs/IDS-FLOW-EXPORTS-ROUTES.md §5).
 *
 * ### It queues a job; it does not hand back a file
 *
 * The request returns at once and the spreadsheet is cut server-side. What
 * this dialog produces is a *row on Export History*, whose `file` fills in
 * when the job finishes — so the success state says exactly that, and links
 * there, rather than pretending a download happened. The mutation
 * invalidates that list, so the new row is already on it when the link is
 * followed.
 *
 * ### Empty means all
 *
 * The status picker narrows which cards go into the sheet. Nothing ticked is
 * "every status" — the parameter is omitted entirely — never "no status".
 * All ten statuses are offered; the ledger's facet offers the same ten.
 *
 * ### Fresh per opening
 *
 * Mounted per opening, so the selection and the outcome of the last export
 * do not carry over to the next card.
 */
export function ExportTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {template && <ExportForm template={template} />}
    </Dialog>
  )
}

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

function ExportForm({ template }: { template: Template }) {
  const t = useT()
  const exportJob = useExportTemplate()
  const [statuses, setStatuses] = React.useState<string[]>([])
  const submitting = exportJob.isPending

  const options = React.useMemo(
    () =>
      STATUS_OPTION_KEYS.map((option) => ({
        value: option.key,
        label: t(option.labelKey),
      })),
    [t]
  )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    exportJob.mutate({ templateId: template.id, statuses })
  }

  if (exportJob.isSuccess) {
    return (
      <DialogContent size="sm">
        <DialogCloseButton />
        <DialogHeader>
          <DialogTitle>{t("templates.export.queuedTitle")}</DialogTitle>
          <DialogDescription>{t("templates.export.queuedDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background-subtle px-3 py-2.5">
            <CheckCircle2
              className="mt-px size-4 shrink-0 text-success"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {t("templates.export.queuedNote")}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" type="button" className={ACTION}>
                {t("common.close")}
              </Button>
            }
          />
          <Button
            className={ACTION}
            nativeButton={false}
            render={<Link href="/id-issuance/exports" />}
          >
            {t("templates.export.openHistory")}
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  return (
    <DialogContent render={<form onSubmit={submit} noValidate />}>
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>{t("templates.export.title")}</DialogTitle>
        <DialogDescription>
          {t("templates.export.before")}{" "}
          <span className="font-medium text-text-secondary">
            {formatText(template.title)}
          </span>{" "}
          {t("templates.export.after")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field
            label={t("templates.export.statuses")}
            optional
            helper={
              statuses.length === 0
                ? t("templates.export.statusesAll")
                : t("templates.export.statusesSome", { count: statuses.length })
            }
          >
            {(control) => (
              <MultiSelect
                id={control.id}
                aria-describedby={control["aria-describedby"]}
                options={options}
                value={statuses}
                onChange={setStatuses}
                placeholder={t("templates.export.statusesPlaceholder")}
                disabled={submitting}
              />
            )}
          </Field>
        </FieldSet>

        <div className="mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-text-muted">
          <FileSpreadsheet
            className="mt-px size-4 shrink-0 text-text-placeholder"
            strokeWidth={1.5}
            aria-hidden
          />
          <p>{t("templates.export.zipDescription")}</p>
        </div>

        {exportJob.isError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
          >
            <AlertCircle
              className="mt-px size-4 shrink-0 text-danger"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-danger">
              {readApiError(
                exportJob.error,
                t("templates.export.failed"),
                t("common.cannotReachServer"),
                t
              )}
            </p>
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
          {submitting ? t("templates.export.starting") : t("templates.export.action")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
