"use client"

import * as React from "react"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { Link } from "@/i18n/navigation"
import axios from "axios"
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { SoftBadge } from "@/components/ui/data-bits"
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
import { Input, InputGroup, InputGroupAddon } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthStore } from "@/features/auth/store"
import { useGetOrganizations } from "@/features/organizations/api"
import {
  useCloneTemplate,
  useDeleteTemplate,
  useResetTemplateSequences,
} from "@/features/templates/api"
import {
  templateIssued,
  templatePrice,
  templateStatus,
  templateValidity,
} from "@/features/templates/display"
import type { Template, TemplateScope } from "@/features/templates/types"
import { cn } from "@/lib/utils"
import type { ApiErrorBody } from "@/types/api"
import { formatText } from "@/utils/format"

import { TemplateFace } from "./template-face"

/**
 * The four dialogs the templates list opens — DESIGN.md §13.
 *
 * They live together because they are the same conversation held four ways
 * about one row, and each is small; splitting them would spread one row's
 * vocabulary across four files.
 *
 * ### What is deliberately *not* here
 *
 * There is no enable/disable toggle and no rename. `PUT /template/{id}` takes
 * the whole `CreateTemplateInput` — there is no partial update — so flipping
 * one field means re-sending `template`, the design document. A list row's copy
 * of that is not guaranteed to be the full one, and a PUT built from a thin row
 * would overwrite a finished design with nothing. The editor owns that write.
 */

/** §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

/** The same box as `CONTROL`, spelled for the select primitive's size slots. */
const SELECT_TRIGGER =
  "w-full border-input bg-surface text-base data-[size=default]:h-11 focus-visible:border-accent-violet focus-visible:ring-ring/45 aria-invalid:border-danger aria-invalid:ring-danger/15 md:text-sm md:data-[size=default]:h-9 dark:bg-surface-sunken"

/** The admin's organization picker source. One stable key, shared with the list screens. */
const ORGANIZATIONS_QUERY = { page: 1, pageSize: 100 } as const

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

/** The banner a failed write gets when no field has claimed the message. */
function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
    >
      <AlertCircle
        className="mt-px size-4 shrink-0 text-danger"
        strokeWidth={1.5}
      />
      <p className="text-[13px] text-danger">{children}</p>
    </div>
  )
}

/** An Axios rejection, reduced to one line somebody can act on. */
function readError(
  error: unknown,
  fallback: string,
  offline: string
): string {
  if (!axios.isAxiosError(error)) return fallback
  const body = error.response?.data as ApiErrorBody | undefined
  const first = Object.values(body?.errors ?? {})[0]?.[0]
  // `first` and `body.message` are the server's own wording and pass through
  // untranslated — only the two strings this app writes itself are localised.
  return first ?? body?.message ?? (error.response ? fallback : offline)
}

/** One `label / value` pair, used by the preview and the delete confirmation. */
function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-[0.04em] text-text-placeholder uppercase">
        {label}
      </dt>
      <dd title={value} className="mt-1 truncate text-[13px] text-text">
        {value}
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Preview — the design itself, both faces
 * ------------------------------------------------------------------ */

type Face = "front" | "back"

/**
 * What comes out of the printer, at the size it can actually be judged at.
 *
 * A row says a template *exists*; this says what it looks like, which is the
 * only way to catch the wrong artwork before a batch is cut from it. Front and
 * back share one frame through a segmented switch rather than sitting side by
 * side — a card is looked at one face at a time, and two 280px thumbnails are
 * worse than one 590px face.
 *
 * The footer's "Open in editor" follows the row control's Edit gate
 * (`TemplateActions`): on the organization tab `update-template` and
 * `show-template`, on the public tab admin plus `update-template`. Hidden
 * rather than disabled here — the row already shows the disabled state, and a
 * dialog footer with one dead button in it reads as broken. The issued count
 * is likewise left off a public card, which nothing is issued from.
 */
export function TemplatePreviewDialog({
  template,
  scope,
  open,
  onOpenChange,
  onRefresh,
  refreshing,
}: {
  /** `null` between openings — nothing renders. */
  template: Template | null
  scope: TemplateScope
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Refetches the list, which is what mints fresh image URLs. */
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {template && (
        <PreviewBody
          template={template}
          scope={scope}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      )}
    </Dialog>
  )
}

function PreviewBody({
  template,
  scope,
  onRefresh,
  refreshing,
}: {
  template: Template
  scope: TemplateScope
  onRefresh: () => void
  refreshing: boolean
}) {
  const t = useT()
  const can = useAuthStore((s) => s.can)
  const isAdmin = useAuthStore((s) => s.user?.type === "admin")
  const [face, setFace] = React.useState<Face>("front")
  const status = templateStatus(t, template)
  const hasBack = !!template.backImage
  const isPublic = scope === "global"
  const canEdit = isPublic
    ? isAdmin && can("update-template")
    : can("update-template") && can("show-template")

  // A template with no back artwork has nothing to switch to, so the control is
  // absent rather than present-and-half-disabled. `face` is only ever read
  // against the artwork that exists, so it cannot go stale on a refetch.
  const shown = hasBack ? face : "front"

  return (
    <DialogContent size="lg">
      <DialogCloseButton />

      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="min-w-0 truncate">
            {formatText(template.title)}
          </DialogTitle>
          <SoftBadge tone={status.tone}>{status.label}</SoftBadge>
        </div>
        <DialogDescription>
          {template.description?.trim() || t("templates.noDescriptionLong")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        {hasBack && (
          <div className="mb-3 flex justify-center">
            <Segmented
              label={t("templates.cardFace")}
              value={shown}
              onValueChange={setFace}
              items={[
                { value: "front", label: t("printer.front") },
                { value: "back", label: t("printer.back") },
              ]}
            />
          </div>
        )}

        {/* The frame carries the rim; `TemplateFace` stays borderless so it can
            also be a 48px thumbnail in a table cell without a doubled edge. */}
        <TemplateFace
          key={shown}
          src={shown === "front" ? template.frontImage : template.backImage}
          alt={t("templates.faceAlt", {
            title: template.title,
            face: shown === "front" ? t("printer.front") : t("printer.back"),
          })}
          className="border border-border"
        />

        {/* The terms an identity is actually cut on (§9.3). */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {isPublic ? (
            <Term
              label={t("filters.attributes.organization")}
              value={t("templates.publicBadge")}
            />
          ) : (
            <Term
              label={t("templates.columns.issued")}
              value={templateIssued(template.identitiesCount)}
            />
          )}
          <Term
            label={t("templates.columns.price")}
            value={templatePrice(t, template.price)}
          />
          <Term
            label={t("templates.columns.validity")}
            value={templateValidity(t, template.identityDuration)}
          />
          <Term
            label={t("templates.columns.branch")}
            value={
              template.branchRequired
                ? t("templates.required")
                : t("templates.notRequired")
            }
          />
        </dl>

        {template.shareKey && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <ShareKey value={template.shareKey} />
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-text-placeholder">
          {t("templates.artworkExpiryNote")}{" "}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-sm font-medium text-text-muted underline underline-offset-4 outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-ring disabled:no-underline"
          >
            {refreshing
              ? t("templates.refreshingLink")
              : t("templates.refreshLink")}
          </button>
          .
        </p>
      </DialogBody>

      <DialogFooter>
        {/* §13.5's split footer: a tertiary action holds the left edge once the
            row is horizontal, and is dropped entirely on the sheet. */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={cn(
            "me-auto hidden items-center gap-1.5 rounded-md text-[13px] font-medium",
            "text-text-muted transition-colors outline-none hover:text-text",
            "focus-visible:ring-2 focus-visible:ring-ring disabled:text-text-placeholder",
            "md:inline-flex"
          )}
        >
          <RefreshCw
            className={cn("size-3.5", refreshing && "animate-spin")}
            strokeWidth={1.5}
          />
          {t("templates.refreshArtwork")}
        </button>

        <DialogClose
          render={
            <Button variant="outline" type="button" className={ACTION}>
              {t("common.close")}
            </Button>
          }
        />
        {canEdit && (
          <Button
            className={ACTION}
            nativeButton={false}
            render={<Link href={`/id-issuance/templates/${template.id}/edit`} />}
          >
            <Pencil data-icon="inline-start" strokeWidth={1.75} />
            {t("templates.openInEditor")}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}

/**
 * The public self-service key, and one button to copy it.
 *
 * Shown as the key rather than as a full URL: the public endpoint lives on a
 * different host from this dashboard (docs/api-types.md § templates), and
 * printing a link this app cannot verify is worse than printing the value the
 * link is built from.
 */
function ShareKey({ value }: { value: string }) {
  const t = useT()
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard denied (an insecure origin, or a refused prompt). The key is
      // on screen and selectable, so there is nothing to recover.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link2 className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.5} />
      <span className="shrink-0 text-xs text-text-muted">
        {t("templates.shareKey")}
      </span>
      <code className="min-w-0 flex-1 truncate rounded-sm bg-surface-sunken px-2 py-1 font-mono text-xs text-text-secondary">
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={copy}
        aria-label={t("templates.copyShareKey")}
      >
        {copied ? (
          <Check className="size-3.5 text-success" strokeWidth={1.75} />
        ) : (
          <Copy className="size-3.5" strokeWidth={1.5} />
        )}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Duplicate
 * ------------------------------------------------------------------ */

type CloneField = "title" | "description" | "price" | "organizationId"

/** Server validation errors, keyed by the **wire** name the interceptor sends. */
const CLONE_WIRE_NAMES: Record<string, CloneField> = {
  title: "title",
  description: "description",
  price: "price",
  organization_id: "organizationId",
}

/**
 * Clone — `POST /template/clone`. One request, three conversations.
 *
 * The design comes across untouched; the terms are re-asked, because a copy
 * that shares its original's title is indistinguishable from it in every list
 * on this screen. Prefilled with the original's price and, on the organization
 * tab, "<title> (copy)", so the common case is one keystroke.
 *
 * ### Which conversation depends on the tab and the user
 *
 * docs/CARD-CREATE-ASSIGN-GALLERY.md §4. The endpoint is the same; what it
 * *means* is not:
 *
 * - **Organization tab** — *Duplicate*: a second copy of one of your own cards
 *   on new terms. The title gets the "(copy)" suffix so the two are told apart.
 * - **Public tab, organization user** — *Use for my organization*: adopt a
 *   shared blueprint. The server stamps the copy with the token's organization;
 *   nothing is sent about it. The title is kept as-is — there is no original
 *   in their list to collide with.
 * - **Public tab, admin** — *Assign to organization*: the one client action
 *   that names an owner. An admin has no organization of their own, so the
 *   picker is **required**, and `organization_id` goes on the wire. On the
 *   organization tab an admin gets the same picker prefilled with the source
 *   card's owner, so a duplicate stays where it came from unless they say
 *   otherwise.
 *
 * The public tab is deliberately the one place a card changes hands. Every
 * other control on the screen reads within a scope; this one moves a design
 * across one, and the dialog says so in words rather than leaving it to the
 * picker.
 */
export function CloneTemplateDialog({
  template,
  scope,
  open,
  onOpenChange,
}: {
  template: Template | null
  /** The tab the row came from — picks the wording and the target. */
  scope: TemplateScope
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted per opening, so a cancelled draft never comes back on the next
          open and the mutation's error state starts clean. */}
      {template && (
        <CloneForm
          template={template}
          scope={scope}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function CloneForm({
  template,
  scope,
  onDone,
}: {
  template: Template
  scope: TemplateScope
  onDone: () => void
}) {
  const t = useT()
  const isAdmin = useAuthStore((s) => s.user?.type === "admin")
  const adopting = scope === "global"

  // The "(copy)" suffix is part of the default title an operator sees in the
  // field, so it is translated like any other visible string. Adopting a
  // public card keeps its name: the copy is the first of its kind in that
  // organization's list.
  const [title, setTitle] = React.useState(
    adopting
      ? template.title
      : t("templates.copySuffix", { title: template.title })
  )
  const [description, setDescription] = React.useState(
    template.description?.trim() ?? ""
  )
  const [price, setPrice] = React.useState(() => {
    const amount = Number(template.price)
    return Number.isFinite(amount) ? String(amount) : "0"
  })
  /** Admin only. `""` until chosen; prefilled with the owner on the org tab. */
  const [organizationId, setOrganizationId] = React.useState(() =>
    isAdmin && template.organization?.id ? String(template.organization.id) : ""
  )
  const [errors, setErrors] = React.useState<
    Partial<Record<CloneField, string>>
  >({})

  // Organization users never see the picker, so they never pay for the list.
  const organizationsQuery = useGetOrganizations(ORGANIZATIONS_QUERY, {
    enabled: isAdmin,
  })
  const organizationItems = React.useMemo(
    () =>
      (organizationsQuery.data?.data.data ?? []).map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
    [organizationsQuery.data]
  )

  const clone = useCloneTemplate()
  const submitting = clone.isPending

  const copy = adopting
    ? isAdmin
      ? {
          title: t("templates.assignTitle"),
          before: t("templates.adoptBefore"),
          after: t("templates.assignAfter"),
          action: t("templates.assignToOrganization"),
        }
      : {
          title: t("templates.adoptTitle"),
          before: t("templates.adoptBefore"),
          after: t("templates.adoptAfter"),
          action: t("templates.useForOrganization"),
        }
    : {
        title: t("templates.duplicateTitle"),
        before: t("templates.duplicateBefore"),
        after: t("templates.duplicateAfter"),
        action: t("templates.duplicate"),
      }

  /**
   * The whole-form error, once the field-level ones have been claimed. A 422
   * whose messages all landed on fields is already shown beside those fields.
   */
  const formError = React.useMemo(() => {
    if (!clone.isError) return null
    const body = axios.isAxiosError(clone.error)
      ? (clone.error.response?.data as ApiErrorBody | undefined)
      : undefined
    const claimed = Object.keys(body?.errors ?? {}).some(
      (key) => key in CLONE_WIRE_NAMES
    )
    if (claimed) return null
    return readError(
      clone.error,
      t("templates.duplicateRejected"),
      t("common.cannotReachServer")
    )
  }, [clone.isError, clone.error, t])

  /** Clears a field's error the moment it is edited. */
  const edit =
    (field: CloneField, set: (value: string) => void) => (value: string) => {
      set(value)
      setErrors((current) =>
        current[field] ? { ...current, [field]: undefined } : current
      )
    }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    // The editor's own rules (docs/photo-editor-spec.md §15), applied here so a
    // copy cannot be created in a state the editor would refuse to save.
    const found: Partial<Record<CloneField, string>> = {}
    if (title.trim().length < 3) found.title = t("templates.form.minChars", { n: 3 })
    if (description.trim().length < 10) {
      found.description = t("templates.form.minChars", { n: 10 })
    }
    const amount = Number(price)
    if (price.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      found.price = t("templates.form.priceInvalid")
    }
    // An admin has no organization of their own for the server to fall back
    // on, so the target is required for them and only them (spec §4.4).
    if (isAdmin && !organizationId) {
      found.organizationId = t("templates.form.organizationRequired")
    }

    setErrors(found)
    if (Object.keys(found).length > 0) return

    clone.mutate(
      {
        templateId: template.id,
        title: title.trim(),
        description: description.trim(),
        // A **string**, and the API means it (docs/api-types.md § gotcha 6).
        price: String(amount),
        // Only an admin names the owner; an organization user's copy lands in
        // the token's organization without a word from the client.
        ...(isAdmin && organizationId
          ? { organizationId: Number(organizationId) }
          : {}),
      },
      {
        onSuccess: onDone,
        // A 422 names the offending fields; put each message beside its field
        // rather than in a banner the reader has to translate back to a box.
        onError: (error) => {
          if (!axios.isAxiosError(error)) return
          const body = error.response?.data as ApiErrorBody | undefined
          const next: Partial<Record<CloneField, string>> = {}
          for (const [key, messages] of Object.entries(body?.errors ?? {})) {
            const field = CLONE_WIRE_NAMES[key]
            if (field && messages[0]) next[field] = messages[0]
          }
          setErrors(next)
        },
      }
    )
  }

  return (
    <DialogContent render={<form onSubmit={submit} noValidate />}>
      <DialogCloseButton disabled={submitting} />

      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        {/* The template name is a value, not a phrase, so the sentence is
            split around it rather than interpolated — `t()` returns a string
            and cannot hold the emphasised span. */}
        <DialogDescription>
          {copy.before}{" "}
          <span className="font-medium text-text-secondary">
            {formatText(template.title)}
          </span>{" "}
          {copy.after}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldSet>
          {/* First, because it is the one decision the rest of the form does
              not change: *where* the copy goes. Admin only — see the note on
              the dialog. */}
          {isAdmin && (
            <Field
              label={t("templates.form.organization")}
              error={errors.organizationId}
            >
              {(control) => (
                <Select
                  items={organizationItems}
                  value={organizationId || null}
                  onValueChange={(value) =>
                    edit("organizationId", setOrganizationId)(value ?? "")
                  }
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

          <Field label={t("templates.form.title")} error={errors.title}>
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={title}
                onChange={(event) => edit("title", setTitle)(event.target.value)}
                placeholder={t("templates.form.titlePlaceholder")}
                autoComplete="off"
                disabled={submitting}
              />
            )}
          </Field>

          <Field
            label={t("templates.form.description")}
            error={errors.description}
          >
            {(control) => (
              <Input
                {...control}
                className={CONTROL}
                value={description}
                onChange={(event) =>
                  edit("description", setDescription)(event.target.value)
                }
                placeholder={t("templates.form.descriptionPlaceholder")}
                autoComplete="off"
                disabled={submitting}
              />
            )}
          </Field>

          {/* §10.11's attached group — the currency states the field's format
              where the value is typed, rather than in a helper line under it. */}
          <Field label={t("templates.columns.price")} error={errors.price}>
            {(control) => (
              <InputGroup className="h-11 md:h-9">
                <Input
                  {...control}
                  className="text-base md:text-sm"
                  inputMode="numeric"
                  value={price}
                  onChange={(event) =>
                    edit("price", setPrice)(event.target.value)
                  }
                  placeholder="0"
                  autoComplete="off"
                  disabled={submitting}
                />
                {/* `dir="ltr"`: a currency code sits after the amount in
                    both languages here, and the group's order is layout, not
                    text. */}
                <InputGroupAddon
                  dir="ltr"
                  className="text-base text-text-muted md:text-sm"
                >
                  {t("templates.currency")}
                </InputGroupAddon>
              </InputGroup>
            )}
          </Field>
        </FieldSet>

        <FormError>{formError}</FormError>
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
            ? adopting
              ? t("templates.adopting")
              : t("templates.duplicating")
            : copy.action}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/* ------------------------------------------------------------------ *
 * Delete
 * ------------------------------------------------------------------ */

/**
 * Delete — `DELETE /template/{id}`.
 *
 * The one irreversible action on this screen, so it says what is at stake
 * before it asks: how many identities were cut from this design, and when it
 * was last touched. A template with issued cards behind it gets an explicit
 * warning rather than the same sentence as an empty one — that is the case
 * where "are you sure" is a real question.
 */
export function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const remove = useDeleteTemplate()
  const submitting = remove.isPending
  const { reset } = remove

  // A failure from the last row must not greet the next one.
  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  if (!template) return null

  const issued = template.identitiesCount ?? 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
    >
      <DialogContent size="sm">
        <DialogCloseButton disabled={submitting} />

        <DialogHeader>
          <DialogTitle>{t("templates.deleteTitle")}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-text-secondary">
              {formatText(template.title)}
            </span>{" "}
            {t("templates.deleteDescription")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="rounded-lg border border-border bg-background-subtle p-3">
            <dl className="grid grid-cols-2 gap-3">
              <Term
                label={t("templates.identitiesIssued")}
                value={templateIssued(issued)}
              />
              <Term
                label={t("templates.lastUpdated")}
                value={formatDate(template.updatedAt)}
              />
            </dl>
          </div>

          {issued > 0 && (
            <p className="mt-3 flex items-start gap-2.5 text-[13px] leading-relaxed text-danger">
              <AlertCircle
                className="mt-px size-4 shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              {/* Plural forms, not an `=== 1` branch: English has two and
                  Arabic six, and `Intl.PluralRules` picks the right one. */}
              <span>{t("templates.deleteWarning", { count: issued })}</span>
            </p>
          )}

          <FormError>
            {remove.isError
              ? readError(
                  remove.error,
                  t("templates.deleteRejected"),
                  t("common.cannotReachServer")
                )
              : null}
          </FormError>
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
          {/* §7.2's destructive variant — the only red button in the flow, and
              it is the one that does the irreversible thing. */}
          <Button
            variant="destructive"
            type="button"
            className={ACTION}
            disabled={submitting}
            onClick={() =>
              remove.mutate(template.id, {
                onSuccess: () => onOpenChange(false),
              })
            }
          >
            {submitting && (
              <Loader2
                data-icon="inline-start"
                className="animate-spin"
                strokeWidth={1.75}
              />
            )}
            {submitting ? t("templates.deleting") : t("templates.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Reset sequences
 * ------------------------------------------------------------------ */

/**
 * Reset sequences — `PUT /template/{id}/reset`.
 *
 * Sequences are the counters behind the `incremental` variable type
 * (docs/photo-editor-spec.md §14): the running number printed on each card cut
 * from this design. Resetting sends the next one back to its starting value,
 * which is what you want at the top of a new issuing year and is a collision
 * waiting to happen at any other time — so it is confirmed, and it says which
 * cards it does *not* touch.
 */
export function ResetSequencesDialog({
  template,
  open,
  onOpenChange,
}: {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const reset = useResetTemplateSequences()
  const submitting = reset.isPending
  const { reset: clearError } = reset

  React.useEffect(() => {
    if (open) clearError()
  }, [open, clearError])

  if (!template) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
    >
      <DialogContent size="sm">
        <DialogCloseButton disabled={submitting} />

        <DialogHeader>
          <DialogTitle>{t("templates.resetTitle")}</DialogTitle>
          <DialogDescription>
            {t("templates.resetBefore")}{" "}
            <span className="font-medium text-text-secondary">
              {formatText(template.title)}
            </span>{" "}
            {t("templates.resetAfter")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <p className="text-[13px] leading-relaxed text-text-muted">
            {t("templates.resetNote")}
          </p>

          <FormError>
            {reset.isError
              ? readError(
                  reset.error,
                  t("templates.resetRejected"),
                  t("common.cannotReachServer")
                )
              : null}
          </FormError>
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
            type="button"
            className={ACTION}
            disabled={submitting}
            onClick={() =>
              reset.mutate(template.id, {
                onSuccess: () => onOpenChange(false),
              })
            }
          >
            {submitting ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin"
                strokeWidth={1.75}
              />
            ) : (
              <RotateCcw data-icon="inline-start" strokeWidth={1.75} />
            )}
            {submitting ? t("templates.resetting") : t("templates.resetSequences")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
