"use client"

import * as React from "react"
import { AlertCircle, Loader2, Paperclip, Plus, X } from "lucide-react"

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
import { Input, inputVariants } from "@/components/ui/input"
import { useApproveId, useRejectId } from "@/features/ids/api"
import { identityName } from "@/features/ids/fields"
import type { IDCard } from "@/features/ids/types"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The decision at a node — docs/IDS-FLOW-EXPORTS-ROUTES.md §3.5.
 *
 * ### Two verbs, two wire shapes, one dialog
 *
 * **Approve** is `POST /identity/approve` + `_method=PUT`, multipart: a
 * note, any number of `fields[i][key/value]` pairs, and `attachments[i]`
 * files. It is a *record* — everything typed here comes back on the card as
 * a `nodeHistory` entry the next reviewer reads. The server then moves the
 * card to the next node of its template's flow; the client never names it.
 *
 * **Reject** is `PUT /identity/reject`, JSON: the id and a note. That is the
 * whole contract, which is why the dialog in reject mode shows the note and
 * nothing else. The reference client showed the same fields-and-files form
 * for both and then sent the files through `JSON.stringify` (spec §9.2) —
 * silently uploading their *metadata*. Not offering a control the request
 * cannot carry is the honest version.
 *
 * ### The form is fresh on every opening
 *
 * Mounted per opening (the body is rendered only while `mode` is set), so a
 * cancelled draft never comes back on the next card, and the mutation's error
 * state starts clean. The reference client's dead `IdNodeModal` prefilled
 * from the last history record and would have re-uploaded its attachments;
 * this starts every decision empty, as the live reference page did.
 *
 * ### Failure keeps the dialog open
 *
 * With the server's reason in it and the draft intact. Success is reported by
 * the caller navigating away — the card has left this reviewer's inbox, and
 * there is nothing left on its page for them to do.
 */

export type ReviewMode = "approve" | "reject"

/** §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

/** §10.5 — the text input's box, three lines tall, resizable downwards. */
const TEXTAREA = cn(
  inputVariants({ inputSize: "default" }),
  "h-auto min-h-[88px] resize-y py-2.5 leading-normal md:text-sm"
)

type Pair = { id: number; key: string; value: string }

export function ReviewDialog({
  card,
  mode,
  onOpenChange,
  onDone,
}: {
  card: IDCard
  /** Which decision is being made. `null` closes the dialog. */
  mode: ReviewMode | null
  onOpenChange: (open: boolean) => void
  /** After the server accepted the decision. */
  onDone: () => void
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      {mode && <ReviewForm card={card} mode={mode} onDone={onDone} />}
    </Dialog>
  )
}

function ReviewForm({
  card,
  mode,
  onDone,
}: {
  card: IDCard
  mode: ReviewMode
  onDone: () => void
}) {
  const t = useT()
  const approve = useApproveId()
  const reject = useRejectId()
  const approving = mode === "approve"
  const mutation = approving ? approve : reject
  const submitting = mutation.isPending

  const [notes, setNotes] = React.useState("")
  const [pairs, setPairs] = React.useState<Pair[]>([])
  const [files, setFiles] = React.useState<File[]>([])
  const nextId = React.useRef(1)
  const fileInput = React.useRef<HTMLInputElement>(null)

  const addPair = () =>
    setPairs((current) => [...current, { id: nextId.current++, key: "", value: "" }])

  const editPair = (id: number, patch: Partial<Pair>) =>
    setPairs((current) =>
      current.map((pair) => (pair.id === id ? { ...pair, ...patch } : pair))
    )

  const removePair = (id: number) =>
    setPairs((current) => current.filter((pair) => pair.id !== id))

  /** Files accumulate across picks; the same pick twice is the same file once. */
  const addFiles = (picked: FileList | null) => {
    if (!picked) return
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}:${f.lastModified}`))
      const fresh = Array.from(picked).filter(
        (f) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`)
      )
      return [...current, ...fresh]
    })
  }

  const removeFile = (index: number) =>
    setFiles((current) => current.filter((_, i) => i !== index))

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const identity_id = String(card.id)
    const trimmed = notes.trim()

    if (approving) {
      // A pair with either half blank is not a field, it is an unfinished
      // row; dropped rather than sent as `key=""`.
      const fields = pairs
        .map((pair) => ({ key: pair.key.trim(), value: pair.value.trim() }))
        .filter((pair) => pair.key !== "" && pair.value !== "")

      approve.mutate(
        {
          identity_id,
          notes: trimmed,
          ...(files.length > 0 && { attachments: files }),
          ...(fields.length > 0 && { fields }),
        },
        { onSuccess: onDone }
      )
    } else {
      reject.mutate({ identity_id, notes: trimmed }, { onSuccess: onDone })
    }
  }

  const error = mutation.isError
    ? readApiError(
        mutation.error,
        t(approving ? "idsFlow.approveFailed" : "idsFlow.rejectFailed"),
        t("common.cannotReachServer")
      )
    : null

  return (
    <DialogContent render={<form onSubmit={submit} noValidate />}>
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>
          {t(approving ? "idsFlow.approveTitle" : "idsFlow.rejectTitle")}
        </DialogTitle>
        <DialogDescription>
          {t(approving ? "idsFlow.approveBefore" : "idsFlow.rejectBefore")}{" "}
          <span className="font-medium text-text-secondary">
            {identityName(card) ?? t("ids.cardNumber", { id: card.id })}
          </span>
          {card.node?.name ? (
            <>
              {" "}
              {t("idsFlow.atStage")}{" "}
              <span className="font-medium text-text-secondary">{card.node.name}</span>
            </>
          ) : null}
          . {t(approving ? "idsFlow.approveAfter" : "idsFlow.rejectAfter")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          <Field
            label={t("idsFlow.notes")}
            optional
            helper={t(approving ? "idsFlow.notesHelperApprove" : "idsFlow.notesHelperReject")}
          >
            {(control) => (
              <textarea
                {...control}
                className={TEXTAREA}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("idsFlow.notesPlaceholder")}
                rows={3}
                disabled={submitting}
                autoFocus
              />
            )}
          </Field>

          {approving && (
            <>
              {/* Ad-hoc key/values captured at this stage — a reference
                  number, a desk, whatever the next reviewer needs to know.
                  Free-form because the design does not say what a stage
                  records; only the reviewer does. */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-text-secondary">
                    {t("idsFlow.fields")}
                    <span className="ms-1.5 font-normal text-text-placeholder">
                      {t("common.optional")}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addPair}
                    disabled={submitting}
                  >
                    <Plus data-icon="inline-start" strokeWidth={1.75} />
                    {t("idsFlow.addField")}
                  </Button>
                </div>

                {pairs.length === 0 ? (
                  <p className="text-xs text-text-muted">{t("idsFlow.fieldsHelper")}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pairs.map((pair, index) => (
                      <div key={pair.id} className="flex items-center gap-2">
                        <Input
                          className={CONTROL}
                          value={pair.key}
                          onChange={(event) => editPair(pair.id, { key: event.target.value })}
                          placeholder={t("idsFlow.fieldKey")}
                          aria-label={t("idsFlow.fieldKeyLabel", { n: index + 1 })}
                          autoComplete="off"
                          disabled={submitting}
                        />
                        <Input
                          className={CONTROL}
                          value={pair.value}
                          onChange={(event) =>
                            editPair(pair.id, { value: event.target.value })
                          }
                          placeholder={t("idsFlow.fieldValue")}
                          aria-label={t("idsFlow.fieldValueLabel", { n: index + 1 })}
                          autoComplete="off"
                          disabled={submitting}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-lg"
                          aria-label={t("idsFlow.removeField")}
                          onClick={() => removePair(pair.id)}
                          disabled={submitting}
                        >
                          <X strokeWidth={1.75} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachments — the scanned contract, the signed form. One
                  multipart part per file; the list is what will be sent. */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-text-secondary">
                    {t("idsFlow.attachments")}
                    <span className="ms-1.5 font-normal text-text-placeholder">
                      {t("common.optional")}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInput.current?.click()}
                    disabled={submitting}
                  >
                    <Paperclip data-icon="inline-start" strokeWidth={1.75} />
                    {t("idsFlow.addFiles")}
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(event) => {
                      addFiles(event.target.files)
                      // So the same file can be picked again after removal.
                      event.target.value = ""
                    }}
                  />
                </div>

                {files.length === 0 ? (
                  <p className="text-xs text-text-muted">{t("idsFlow.attachmentsHelper")}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}:${file.size}:${file.lastModified}`}
                        className="flex items-center gap-2 rounded-lg border border-border bg-background-subtle px-3 py-2"
                      >
                        <Paperclip
                          className="size-3.5 shrink-0 text-text-muted"
                          strokeWidth={1.5}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                          {file.name}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-text-placeholder">
                          {formatBytes(file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          disabled={submitting}
                          aria-label={t("idsFlow.removeFile", { name: file.name })}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="size-3.5" strokeWidth={1.75} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </FieldSet>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
          >
            <AlertCircle
              className="mt-px size-4 shrink-0 text-danger"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-danger">{error}</p>
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
          variant={approving ? "default" : "destructive"}
          className={ACTION}
          disabled={submitting}
        >
          {submitting && (
            <Loader2
              data-icon="inline-start"
              className="animate-spin"
              strokeWidth={1.75}
            />
          )}
          {submitting
            ? t(approving ? "idsFlow.approving" : "idsFlow.rejecting")
            : t(approving ? "idsFlow.approve" : "idsFlow.reject")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/** `1234567` → `1.2 MB`. Latin digits in both languages, like every count. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
