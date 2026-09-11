"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import {
  AlertCircle,
  Check,
  Eye,
  FlipHorizontal,
  IdCard,
  Loader2,
  UserPlus,
} from "lucide-react"

import { CardFaceRender, type CardValues } from "@/components/id-card/card-render"
import { DynamicField, isWideField } from "@/components/id-card/dynamic-field"
import { Button } from "@/components/ui/button"
import { SoftBadge } from "@/components/ui/data-bits"
import { Field } from "@/components/ui/field"
import { Input, InputGroup, InputGroupAddon } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetBranchesByTemplateId } from "@/features/branches/api"
import { useCreateId } from "@/features/ids/api"
import {
  buildIssueForm,
  buildIssuePayload,
  fieldsOn,
  generatedStandIn,
  isGeneratedVar,
  isMemberVar,
  toArabicDigits,
  valueOf,
  type Face,
  type FormValue,
  type IssueValues,
} from "@/features/ids/issue-form"
import { useGetMembers } from "@/features/members/api"
import { TemplateQueryKeys, useGetTemplate } from "@/features/templates/api"
import { readDesign, type DesignPage } from "@/features/templates/design"
import type { Template } from "@/features/templates/types"
import { useT } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/translate"
import { cn } from "@/lib/utils"
import type { ApiErrorBody } from "@/types/api"
import { formatText, toApiPhone } from "@/utils/format"

/**
 * Issue an ID from a template — `POST /identity`, per docs/ISSUE-ID-FORM.md.
 *
 * ### A sheet, not a page
 *
 * The reference implementation was a route (`/ids-templates/forms/{id}`): the
 * operator left the gallery, filled a page, and was dropped on `/ids`. Issuing
 * is a thing you do *to a row*, usually several times in a sitting, so it is a
 * side sheet over the list the row is still in — cancel puts you back where
 * you were with no navigation at all, and the next card is one more click.
 *
 * ### Two panes when there is room, one column when there is not
 *
 * At 860px of sheet and up it splits: the card sits on a sunken stage down
 * the start side, the form takes the end side with its own header, scrolling
 * body and pinned footer. The card is the reference the operator keeps
 * glancing at while typing, and beside the form it is *always* in view at
 * roughly life size without costing the form a single pixel of height.
 * Narrower, the same four blocks stack — header, card, body, footer — with
 * the card pinned under the title and shrunk so the form still has room.
 *
 * The threshold is the *sheet's* width, not the viewport's — a container
 * query on the popup. The sheet is resizable, and an operator who drags it
 * wide on an iPad gets the split; one who drags it narrow on a desktop gets
 * the stack. The default (`2xl`) is 920px from 1280px viewports, so a desktop
 * splits without anyone touching anything.
 *
 * One DOM order serves both: the blocks are placed with grid areas when
 * split, so the card can come *after* the header in source (where the stacked
 * layout needs it) and still span the full height beside it.
 *
 * ### The card flips
 *
 * A two-sided design shows one face at a time, as a printed card does, and
 * turns over on a button — or on its own, when a field that prints on the
 * other side takes focus, so the value being typed is on the face being
 * shown. The turn is a real 3D rotation rather than a swap: the two faces
 * are the same object, and a swap reads as two pictures.
 *
 * ### The card is the feedback, not a validation message
 *
 * The design is drawn at the top of the sheet from the same JSON the server
 * renders from, and it redraws as the form is typed into. That is deliberate
 * and it replaces a whole class of client-side rules: this form has no way of
 * knowing which variables a template *requires* (the design document does not
 * say), so instead of guessing, it shows what would be printed. An empty slot
 * renders its own `{employee_no}` in grey — visible, and unmistakably wrong.
 *
 * ### What is fixed relative to the reference
 *
 * Four of the gaps in §11 of the doc are behaviour, not documentation, and are
 * not reproduced here:
 *
 *  - **One member lookup per blur**, not two (gap 3).
 *  - **A miss no longer erases a typed name** (gap 4). The operator's own
 *    typing outranks an empty search result.
 *  - **A failure is shown** (gap 2). The reference swallowed every 4xx into
 *    `console.error`, so a rejected card looked like a dead button.
 *  - **Variables with no canvas element get their own group** (gap 5) rather
 *    than being filed under "Front of card", which is a claim about where they
 *    print that is not true of any of them.
 */

/** §18.7 — 44px controls for touch, the §10.1 36px box from 768px up. */
const CONTROL = "h-11 text-base md:h-9 md:text-sm"

/** §18.6 — the footer's actions go full-width before the row goes horizontal. */
const ACTION = "h-11 w-full md:h-9 md:w-auto"

/**
 * The split layout, from 860px of sheet up (`@container/sheet` — sheet.tsx).
 *
 * A 400px stage column and a fluid form column; the form column has three
 * rows — header, scrolling body, footer — and the stage spans all three. The
 * `minmax(0, 1fr)` on the middle row is what lets the body be shorter than its
 * content and scroll, the grid equivalent of `min-h-0` on a flex child.
 *
 * Written out in full rather than built from a prefix: Tailwind finds classes
 * by scanning source for literal strings.
 */
const SPLIT =
  "@min-[860px]/sheet:grid @min-[860px]/sheet:grid-cols-[400px_minmax(0,1fr)] @min-[860px]/sheet:grid-rows-[auto_minmax(0,1fr)_auto]"

const AREA = {
  header: "@min-[860px]/sheet:col-start-2 @min-[860px]/sheet:row-start-1",
  stage:
    "@min-[860px]/sheet:col-start-1 @min-[860px]/sheet:row-span-3 @min-[860px]/sheet:row-start-1",
  body: "@min-[860px]/sheet:col-start-2 @min-[860px]/sheet:row-start-2",
  footer: "@min-[860px]/sheet:col-start-2 @min-[860px]/sheet:row-start-3",
} as const

/** The card's own shadow — a physical object lying on the stage. */
const CARD_SHADOW =
  "shadow-[0_10px_24px_-8px_rgba(0,0,0,0.28),0_2px_6px_-2px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.7)]"

export function IssueIdSheet({
  template,
  open,
  onOpenChange,
}: {
  /** The row the sheet was opened from. `null` between openings. */
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Mounted per opening: a half-filled card must not come back on the
          next row, and the mutation's error state starts clean. */}
      {template && (
        <IssueForm template={template} onDone={() => onOpenChange(false)} />
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ *
 * The form
 * ------------------------------------------------------------------ */

type MemberField = "phone" | "name" | "branch"
type Errors = Partial<Record<MemberField, string>>

/** Server validation errors, keyed by the **wire** name (§8.3). */
const WIRE_NAMES: Record<string, MemberField> = {
  phone: "phone",
  name: "name",
  branchId: "branch",
  branch_id: "branch",
}

function IssueForm({
  template: row,
  onDone,
}: {
  template: Template
  onDone: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()

  /**
   * The full record, because a list row's `template` JSON is not guaranteed to
   * be the whole design (features/templates/types.ts). The row is shown
   * meanwhile so the sheet opens with a title rather than a spinner.
   */
  const detail = useGetTemplate(row.id)
  const template = detail.data ?? row

  const design = React.useMemo(() => readDesign(template.template), [template.template])
  const form = React.useMemo(() => (design ? buildIssueForm(design) : null), [design])

  const [phone, setPhone] = React.useState("")
  const [name, setName] = React.useState("")
  const [branchId, setBranchId] = React.useState("")
  const [values, setValues] = React.useState<IssueValues>({})
  const [errors, setErrors] = React.useState<Errors>({})
  const [face, setFace] = React.useState<Face>("front")

  /** The member the phone resolved to, or `null`. Never sent — display only. */
  const [member, setMember] = React.useState<{ id: number; name: string } | null>(null)
  /** `null` before the first lookup; `false` for "searched, found nobody". */
  const [looked, setLooked] = React.useState<boolean | null>(null)

  const wirePhone = toApiPhone(phone)

  /* ── Branches (§2.2) ─────────────────────────────────────────────── */

  // Chained: it cannot fire before the template read reports `branchRequired`.
  const branchesQuery = useGetBranchesByTemplateId(
    template.branchRequired ? template.id : undefined
  )
  const branches = React.useMemo(
    () => branchesQuery.data?.data.data ?? [],
    [branchesQuery.data]
  )

  /* ── Member lookup (§6.2) ────────────────────────────────────────── */

  const memberQuery = useGetMembers(
    { page: 1, pageSize: 1, filter: [{ field: "phone", value: wirePhone ?? "" }] },
    // Manual only: a lookup per keystroke would be one request per digit.
    { enabled: false, gcTime: 0 }
  )
  const { refetch: lookUpMember } = memberQuery

  const onPhoneBlur = async () => {
    if (!wirePhone) {
      setMember(null)
      setLooked(null)
      return
    }

    // One request, not the reference's two (§11, gap 3).
    const result = await lookUpMember()
    const found = result.data?.data?.data?.[0]

    if (found) {
      setMember({ id: found.id, name: found.name ?? "" })
      setLooked(true)
      // The member record is what this person is called everywhere else in the
      // dashboard, so it wins over a half-typed name — but only when there is
      // one. A miss leaves whatever was typed alone (§11, gap 4).
      if (found.name?.trim()) {
        setName(found.name.trim())
        setErrors((current) => ({ ...current, name: undefined }))
      }
    } else {
      setMember(null)
      setLooked(false)
    }
  }

  /* ── Values ──────────────────────────────────────────────────────── */

  const setValue = (key: string, value: FormValue) =>
    setValues((current) => ({ ...current, [key]: value }))

  /**
   * What each variable prints right now.
   *
   * Three sources, in the order the server resolves them: the member block for
   * `name` / `phone`, a stand-in for the four types the server generates, and
   * the form for everything else.
   */
  const cardValues: CardValues = {}
  for (const variable of design?.vars ?? []) {
    if (isMemberVar(variable)) {
      const isPhone = variable.type === "phone" || variable.name === "phone"
      const text = isPhone ? (wirePhone ?? phone.trim()) : name.trim()
      cardValues[variable.name] = { text, pending: !text }
      continue
    }

    if (isGeneratedVar(variable)) {
      cardValues[variable.name] = {
        text: generatedStandIn(variable, template.identityDuration),
        // Always dimmed: the server mints the real one, and a crisp date here
        // would read as a value somebody chose.
        pending: true,
      }
      continue
    }

    const field = form?.fields.find((f) => f.name === variable.name)
    if (!field) continue
    const value = valueOf(values, field)

    if (value instanceof File) {
      // The file itself: the slot on the card mints its own object URL, so
      // this form never owns a cache of them (components/id-card/use-object-url.ts).
      cardValues[variable.name] = { file: value }
    } else {
      const text = typeof value === "string" ? value : ""
      cardValues[variable.name] = {
        text: variable.arabicNumbers ? toArabicDigits(text) : text,
        pending: !text,
      }
    }
  }

  /* ── Submit ──────────────────────────────────────────────────────── */

  const create = useCreateId()
  const submitting = create.isPending

  const formError = React.useMemo(() => {
    if (!create.isError) return null
    const error = create.error
    if (!axios.isAxiosError(error)) return t("common.somethingWentWrong")

    const body = error.response?.data as ApiErrorBody | undefined
    const claimed = Object.keys(body?.errors ?? {}).some((key) => key in WIRE_NAMES)
    if (claimed) return null

    // A 422 on a *variable* names the variable, which has no field mapping —
    // the server's own wording is the only thing that identifies it, so it is
    // passed through untranslated.
    const first = Object.values(body?.errors ?? {})[0]?.[0]
    return (
      first ??
      body?.message ??
      (error.response ? t("common.serverRejected") : t("common.cannotReachServer"))
    )
  }, [create.isError, create.error, t])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form) return

    const found: Errors = {}
    if (!phone.trim()) found.phone = t("issue.form.phoneRequired")
    else if (!wirePhone) found.phone = t("members.form.phoneInvalid")
    if (!name.trim()) found.name = t("issue.form.nameRequired")
    if (template.branchRequired && !branchId) found.branch = t("issue.form.branchRequired")

    setErrors(found)
    if (Object.keys(found).length > 0) return

    create.mutate(
      buildIssuePayload({
        templateId: Number(template.id),
        organizationId: template.organization?.id,
        name,
        phone: wirePhone ?? "",
        branchId,
        form,
        values,
      }),
      {
        onSuccess: () => {
          // The factory invalidates `["identity"]`; the *templates* list is
          // stale too, because `identitiesCount` just moved and this screen is
          // showing it.
          queryClient.invalidateQueries({ queryKey: TemplateQueryKeys.all() })
          onDone()
        },
        onError: (error) => {
          if (!axios.isAxiosError(error)) return
          const body = error.response?.data as ApiErrorBody | undefined
          const next: Errors = {}
          for (const [key, messages] of Object.entries(body?.errors ?? {})) {
            const field = WIRE_NAMES[key]
            if (field && messages[0]) next[field] = messages[0]
          }
          setErrors(next)
        },
      }
    )
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  const pages = design?.pages ?? []

  /**
   * The template's field groups, in card order.
   *
   * `unprinted` rather than `other` as the dictionary key: `TranslationKey`
   * treats any node carrying an `other` member as a plural form
   * (i18n/translate.ts), so a group list spelled that way stops being
   * addressable at all.
   */
  const groups: { face: Face; labelKey: TranslationKey }[] = [
    { face: "front", labelKey: "issue.groups.front" },
    { face: "back", labelKey: "issue.groups.back" },
    { face: "none", labelKey: "issue.groups.unprinted" },
  ]

  /** What the phone field says under itself, once the number has been looked up. */
  const phoneHelper =
    looked === true ? (
      <span className="inline-flex items-center gap-1 text-success">
        <Check className="size-3 shrink-0" strokeWidth={2.2} aria-hidden />
        {t("issue.form.memberFound")}
      </span>
    ) : looked === false ? (
      <span className="inline-flex items-center gap-1">
        <UserPlus className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
        {t("issue.form.memberNew")}
      </span>
    ) : (
      t("issue.form.phoneHelper")
    )

  return (
    <SheetContent
      size="2xl"
      resizable="issue-id"
      layoutClassName={SPLIT}
      render={<form onSubmit={submit} noValidate />}
    >
      <SheetCloseButton disabled={submitting} />

      {/* One row: an icon tile, the action, and the template it acts on. The
          rule under it is kept, unlike the dialog's — the body scrolls under
          it, and in the split layout it is what separates the title from the
          form on the same column. */}
      <SheetHeader className={cn("py-4", AREA.header)}>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-violet"
          >
            <IdCard className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-[15px]">{t("issue.title")}</SheetTitle>
            <SheetDescription className="mt-0.5 truncate">
              <span className="font-medium text-text-secondary">
                {formatText(template.title)}
              </span>
              {template.organization?.name && (
                <> · {formatText(template.organization.name)}</>
              )}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {/* The card. Outside the scrolling body on purpose: it is the reason the
          form is being filled, and a preview you have to scroll back up to is
          a preview nobody looks at. */}
      <CardStage
        className={AREA.stage}
        pages={pages}
        values={cardValues}
        loading={detail.isPending && !design}
        failed={detail.isError && !design}
        face={face}
        onFaceChange={setFace}
      />

      <SheetBody className={cn("pt-5", AREA.body)}>
        {detail.isPending && !design ? (
          <FormSkeleton />
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              {/* The member block — the only part of this form that is not
                  derived from the template (§6). */}
              <Group title={t("issue.groups.cardholder")}>
                <Field label={t("auth.phoneLabel")} error={errors.phone} helper={phoneHelper}>
                  {(control) => (
                    // The whole group is `dir="ltr"`, not just the addon: a
                    // phone number is written left to right in Arabic too,
                    // so the country code stays on the left and the digits
                    // run away from it, in either language. Left to the row's
                    // own direction, the addon jumped to the right in Arabic
                    // and the number read "…4567 +964".
                    <InputGroup dir="ltr" className="h-11 md:h-9">
                      <InputGroupAddon className="text-base text-text-secondary md:text-sm">
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
                          setErrors((current) => ({ ...current, phone: undefined }))
                          // The looked-up member belongs to the old number.
                          setMember(null)
                          setLooked(null)
                        }}
                        onBlur={onPhoneBlur}
                        placeholder="770 123 4567"
                        autoComplete="off"
                        disabled={submitting}
                      />
                      {memberQuery.isFetching && (
                        <span className="grid w-9 shrink-0 place-items-center">
                          <Loader2
                            className="size-3.5 animate-spin text-text-muted"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </span>
                      )}
                    </InputGroup>
                  )}
                </Field>

                <Field label={t("members.form.name")} error={errors.name}>
                  {(control) => (
                    // Not locked when a member is found, unlike the reference
                    // page: the same person is regularly on file under a
                    // half-entered name, and the operator with the ID in their
                    // hand is the better authority. The badge — *inside* the
                    // box, so the field keeps its full width — says where the
                    // value came from instead.
                    <div className="relative">
                      <Input
                        {...control}
                        className={cn(CONTROL, member && "pe-24")}
                        value={name}
                        onChange={(event) => {
                          setName(event.target.value)
                          setErrors((current) => ({ ...current, name: undefined }))
                        }}
                        placeholder={t("members.form.name")}
                        autoComplete="off"
                        disabled={submitting}
                      />
                      {member && (
                        <SoftBadge
                          tone="success"
                          className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 gap-1"
                        >
                          <Check className="size-3" strokeWidth={2.2} aria-hidden />
                          {t("issue.form.onFile")}
                        </SoftBadge>
                      )}
                    </div>
                  )}
                </Field>

                {template.branchRequired && (
                  <Field
                    label={t("templates.columns.branch")}
                    error={errors.branch}
                    helper={
                      branchesQuery.isError ? t("issue.form.branchesFailed") : undefined
                    }
                  >
                    {(control) => (
                      <Select
                        items={branches.map((branch) => ({
                          value: String(branch.id),
                          label: branch.name,
                        }))}
                        value={branchId || null}
                        onValueChange={(next) => {
                          setBranchId(next ?? "")
                          setErrors((current) => ({ ...current, branch: undefined }))
                        }}
                        disabled={submitting || branchesQuery.isPending}
                      >
                        <SelectTrigger
                          {...control}
                          className="w-full border-input bg-surface text-base data-[size=default]:h-11 focus-visible:border-accent-violet focus-visible:ring-ring/45 aria-invalid:border-danger aria-invalid:ring-danger/15 md:text-sm md:data-[size=default]:h-9 dark:bg-surface-sunken"
                        >
                          <SelectValue
                            className="truncate"
                            placeholder={
                              branchesQuery.isPending
                                ? t("common.loading")
                                : t("issue.form.selectBranch")
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={String(branch.id)}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                )}
              </Group>

              {/* The template's own variables, grouped by the face they print
                  on (§4.2) — so the fields being filled and the card beside
                  them are in the same order. */}
              {form &&
                groups.map(({ face: group, labelKey }) => {
                  const fields = fieldsOn(form, group)
                  if (fields.length === 0) return null

                  return (
                    <Group
                      key={group}
                      title={t(labelKey)}
                      // Focusing a field turns the card to the face it prints
                      // on. The unprinted group has no face to turn to.
                      onFocus={group === "none" ? undefined : () => setFace(group)}
                    >
                      {fields.map((field) => (
                        <DynamicField
                          key={field.name}
                          field={field}
                          value={valueOf(values, field)}
                          onChange={(next) => setValue(field.name, next)}
                          disabled={submitting}
                          className={isWideField(field) ? WIDE : undefined}
                        />
                      ))}
                    </Group>
                  )
                })}
            </div>

            {form && form.fields.length === 0 && (
              <p className="rounded-lg border border-border bg-background-subtle px-3 py-2.5 text-[13px] text-text-muted">
                {t("issue.noVariables")}
              </p>
            )}

            {detail.isError && !design && (
              <div
                role="alert"
                className="flex items-center gap-3 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
              >
                <AlertCircle className="size-4 shrink-0 text-danger" strokeWidth={1.5} />
                <p className="text-[13px] text-danger">{t("issue.designFailed")}</p>
                <button
                  type="button"
                  onClick={() => detail.refetch()}
                  className="ms-auto rounded-sm text-[13px] font-medium text-danger underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("common.retry")}
                </button>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-border bg-danger-bg px-3 py-2.5"
              >
                <AlertCircle
                  className="mt-px size-4 shrink-0 text-danger"
                  strokeWidth={1.5}
                />
                <p className="text-[13px] text-danger">{formError}</p>
              </div>
            )}
          </div>
        )}
      </SheetBody>

      <SheetFooter className={cn("border-t-0", AREA.footer)}>
        <SheetClose
          render={
            <Button
              type="button"
              variant="outline"
              className={ACTION}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
          }
        />
        <Button type="submit" className={ACTION} disabled={submitting || !design}>
          {submitting ? (
            <Loader2 data-icon="inline-start" className="animate-spin" strokeWidth={1.75} />
          ) : (
            <IdCard data-icon="inline-start" strokeWidth={1.75} />
          )}
          {submitting ? t("issue.issuing") : t("issue.issue")}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

/* ------------------------------------------------------------------ *
 * A field group
 * ------------------------------------------------------------------ */

/** A field that takes the whole row of a `Group`'s grid. */
const WIDE = "@md:col-span-2"

/**
 * One titled run of fields — §10.10's section label over a grid of them.
 *
 * ### Two up, when there is room
 *
 * A box you type a name or a number into does not want to be the width of
 * the form; at 480px it is a box far wider than anything typed into it. So
 * the fields sit two to a row from 448px of group (`@md`, on the group's own
 * container) and one to a row below that — a phone, or a sheet dragged
 * narrow. The photo, signature and attachment tiles opt out with `WIDE`:
 * a thumbnail, a name and three actions do not fit in half a row.
 *
 * The groups are separated by 24px of padding either side of the break,
 * rather than by a label with a rule drawn through it: the gap bounds the
 * group, which is what a section break is, instead of underlining its name.
 */
function Group({
  title,
  onFocus,
  children,
}: {
  title: string
  /** Fires for focus anywhere in the group — React's `onFocus` bubbles. */
  onFocus?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="@container py-6 first:pt-0 last:pb-0" onFocus={onFocus}>
      <h3 className="mb-4 text-[13px] font-semibold text-text">{title}</h3>
      <div className="grid grid-cols-1 items-start gap-4 @md:grid-cols-2">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * The card stage
 * ------------------------------------------------------------------ */

/**
 * The pinned preview.
 *
 * A sunken ground with the card lying on it, a flip button under it for a
 * two-sided design, and one line at the foot saying what it is. In the split
 * layout the stage is the full height of the sheet and the card floats at its
 * vertical centre; stacked, it is a short band under the header.
 *
 * ### The flip
 *
 * Both faces are rendered, back to back, inside a box with perspective. The
 * back is pre-turned 180° so that turning the whole stack 180° presents it
 * the right way round, and each face hides its own reverse — which is what
 * stops the front showing through, mirrored, halfway through the turn. The
 * stack is sized to the front; a back drawn at a different size would be a
 * design bug, not something to lay out for.
 *
 * ### Width is measured, and bounded by height
 *
 * The stage is 400px when split, the whole sheet when stacked and the whole
 * viewport on a phone, and the card has to fill whichever it is without ever
 * being wider. `CardFaceRender` takes a pixel width because it scales the
 * whole design from one transform — a percentage would mean the page box
 * could not be laid out at its authored size.
 *
 * The width is the tightest of three: the stage, 360px, and the width at
 * which the card's *height* reaches `--stage-h`. The last one is the one a
 * portrait design needs — at 360px wide it is 570px tall, which stacked is
 * the whole sheet and the form gone beneath it. Stacked, a card gets 32vh;
 * split, the column is its own and it gets 60vh. The 360px cap keeps a
 * landscape card near life size: a CR-80 is 85.6mm, about 324px at 96dpi.
 */
function CardStage({
  className,
  pages,
  values,
  loading,
  failed,
  face,
  onFaceChange,
}: {
  className?: string
  /** Front first; a second entry is the back. */
  pages: DesignPage[]
  values: CardValues
  loading: boolean
  failed: boolean
  face: Face
  onFaceChange: (face: Face) => void
}) {
  const t = useT()
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const front = pages[0]
  const back = pages[1]
  const flipped = face === "back" && Boolean(back)
  const height = front && width > 0 ? (front.height * width) / front.width : 0
  /** Width ÷ height; a CR-80 stands in for the skeleton and the empty box. */
  const ratio = front ? front.width / front.height : 85.6 / 54

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col px-5 py-4",
        // How tall the card may be. Stacked it shares the height with the
        // form; split, the column is its own.
        "[--stage-h:32vh] @min-[860px]/sheet:[--stage-h:60vh]",
        // Split: a full-height column beside the form.
        "@min-[860px]/sheet:min-h-0 @min-[860px]/sheet:overflow-y-auto @min-[860px]/sheet:px-8 @min-[860px]/sheet:py-8",
        className
      )}
    >
      {/* `my-auto` centres the card in whatever height the stage has — the
          whole sheet when split, its own content when stacked. */}
      <div className="my-auto flex flex-col items-center gap-4">
        <div
          ref={ref}
          style={{ width: `min(100%, 360px, calc(var(--stage-h) * ${ratio}))` }}
        >
          {loading ? (
            <Skeleton className="aspect-[85.6/54] w-full rounded-lg" />
          ) : failed || !front ? (
            <div className="grid aspect-[85.6/54] w-full place-items-center rounded-lg border border-dashed border-border-strong">
              <p className="px-4 text-center text-[13px] text-text-muted">
                {t("issue.noPreview")}
              </p>
            </div>
          ) : (
            width > 0 && (
              <div className="perspective-[1400px]" style={{ height }}>
                <div
                  className={cn(
                    "relative size-full transform-3d",
                    "transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    "motion-reduce:transition-none",
                    flipped && "rotate-y-180"
                  )}
                >
                  <div className="absolute inset-0 backface-hidden">
                    <CardFaceRender
                      page={front}
                      values={values}
                      width={width}
                      className={CARD_SHADOW}
                    />
                  </div>
                  {back && (
                    <div className="absolute inset-0 rotate-y-180 backface-hidden">
                      <CardFaceRender
                        page={back}
                        values={values}
                        width={width}
                        className={CARD_SHADOW}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {back && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 md:h-8"
              onClick={() => onFaceChange(flipped ? "front" : "back")}
            >
              <FlipHorizontal
                data-icon="inline-start"
                strokeWidth={1.75}
                // The glyph turns with the card.
                className={cn(
                  "transition-transform duration-500 motion-reduce:transition-none",
                  flipped && "-scale-x-100"
                )}
              />
              {t("issue.flipCard")}
            </Button>
            <span className="text-xs font-medium text-text-muted">
              {flipped ? t("printer.back") : t("printer.front")}
            </span>
          </div>
        )}
      </div>

      {/* Not on a phone: there the stage is pinned above a form that needs
          every row, and the card explains itself. */}
      <p className="mt-4 hidden items-center justify-center gap-1.5 text-xs text-text-muted sm:flex @min-[860px]/sheet:mt-6">
        <Eye className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        {t("issue.previewNote")}
      </p>
    </aside>
  )
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-3.5 w-20" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}
