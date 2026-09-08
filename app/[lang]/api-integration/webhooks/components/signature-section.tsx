"use client"

import * as React from "react"
import { Check, Copy, Eye, EyeOff, ShieldCheck } from "lucide-react"

import { SettingsBlock, SettingsSection } from "@/components/settings/settings-section"
import { SoftBadge } from "@/components/ui/data-bits"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGetWebhook } from "@/features/webhooks/api"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The signing header every delivery carries — read-only.
 *
 * `secretKey` and `secretValue` are generated server-side and returned by
 * `GET /webhook`; nothing in this app sets or rotates them
 * (docs/CRUD-MIGRATION-REFERENCE.md §1.14). The section exists so the receiving
 * end can be configured to check them, which is the only thing that makes a
 * delivery trustworthy — without it, anyone who learns the endpoint URL can
 * post identity events to it.
 *
 * ### The value is masked, the header name is not
 *
 * The name is a header like `X-Bajat-Signature` — it is in every request and
 * it is not a secret. The value is, and it follows the same rule as an API
 * key's secret: on screen only when asked for, so this page can be
 * screen-shared while an integration is being set up.
 *
 * ### Nothing renders before an endpoint exists
 *
 * The backend generates the pair when the first endpoint is saved, so before
 * that the fields come back empty. Showing two empty boxes would read as a
 * bug; the section says what it is waiting for instead.
 */

/** How long the copied confirmation stays up, in ms. */
const COPIED_MS = 1600

export function SignatureSection() {
  const t = useT()
  const webhookQuery = useGetWebhook()
  const webhook = webhookQuery.data

  const hasSignature = !!webhook?.secretKey && !!webhook?.secretValue

  return (
    <SettingsSection
      id="signature"
      icon={ShieldCheck}
      title={t("webhooks.signatureTitle")}
      description={t("webhooks.signatureDescription")}
    >
      <SettingsBlock>
        {webhookQuery.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : !hasSignature ? (
          <p className="text-[13px] text-text-muted">
            {t("webhooks.signatureUnavailable")}
          </p>
        ) : (
          <dl className="flex flex-col gap-3">
            <Row label={t("webhooks.headerName")} value={webhook.secretKey} />
            <Row
              label={t("webhooks.headerValue")}
              value={webhook.secretValue}
              secret
            />
            {webhook.method && (
              <div className="flex items-center gap-3">
                <dt className="w-24 shrink-0 text-[13px] text-text-secondary">
                  {t("webhooks.methodLabel")}
                </dt>
                <dd>
                  {/* §14.1's flat soft badge — a fixed fact, not a status. */}
                  <SoftBadge tone="info">{webhook.method.toUpperCase()}</SoftBadge>
                </dd>
              </div>
            )}
          </dl>
        )}
      </SettingsBlock>
    </SettingsSection>
  )
}

function Row({
  label,
  value,
  secret = false,
}: {
  label: string
  value: string
  secret?: boolean
}) {
  const t = useT()
  const [revealed, setRevealed] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Clears the confirmation, and cancels itself if the row unmounts first.
  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // `navigator.clipboard` needs a secure context and a permission that can
      // be refused. Revealing is the fallback that always works — the value
      // can then be selected by hand.
      setRevealed(true)
    }
  }

  const shown = !secret || revealed

  return (
    <div className="flex items-center gap-3">
      <dt className="w-24 shrink-0 text-[13px] text-text-secondary">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-border bg-background-subtle px-2.5 py-1.5">
        {/* Mono and LTR: a header value is compared character by character,
            and it stays Latin-ordered even on an Arabic page. */}
        <code
          dir="ltr"
          className="min-w-0 flex-1 truncate font-mono text-[13px] tracking-[0.02em] text-text-secondary rtl:text-end"
        >
          {shown ? value : "•".repeat(16)}
        </code>

        {secret && (
          <IconButton
            label={
              revealed ? t("webhooks.hideLabel") : t("webhooks.revealLabel")
            }
            onClick={() => setRevealed((current) => !current)}
            icon={revealed ? EyeOff : Eye}
          />
        )}

        <IconButton
          label={t("webhooks.copyValue")}
          onClick={copy}
          icon={copied ? Check : Copy}
          // The only tone on the row, and only for the moment after a copy.
          tone={copied ? "text-success" : undefined}
        />
      </dd>
    </div>
  )
}

/**
 * §15.5 allows a glyph alone only with both an accessible name and a tooltip.
 * Both are here.
 */
function IconButton({
  label,
  onClick,
  icon: Icon,
  tone,
}: {
  label: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  tone?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
              "transition-colors duration-120 outline-none",
              "hover:bg-[rgba(0,0,0,0.04)] hover:text-text",
              "focus-visible:ring-2 focus-visible:ring-ring",
              "dark:hover:bg-[rgba(255,255,255,0.06)]",
              tone ?? "text-text-muted"
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
