"use client"

import { ArrowRight, Inbox } from "lucide-react"

import { EmptyCell, InitialAvatar, SoftBadge } from "@/components/ui/data-bits"
import type { MemberRequest, MemberStatus } from "@/features/members-requests/types"
import { useT } from "@/i18n/context"
import { useFormatDate } from "@/i18n/format"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { formatText } from "@/utils/format"

import { VizCard, VizCardHead } from "./chart-kit"

/**
 * The newest applications — the page's "right now".
 *
 * Everything above this is aggregate: a year of volume, a lifetime pipeline, a
 * typical week. The screen ends on six actual people who applied, because a
 * dashboard that only ever shows sums leaves the reader with nothing to *do*.
 * Each row is a link into the request it names, so the page's last section is
 * also its only exit into real work.
 *
 * Status is a badge with a word in it, never a colour on its own — the same
 * `SoftBadge` the requests table uses, so a status looks identical wherever it
 * appears in the app.
 *
 * The applicant's disc carries their initials on the neutral step rather than a
 * seeded gradient: this screen keeps every fill flat, and on a list of six
 * people a letter identifies a row in a way a colour never quite does.
 */

/** The same mapping the requests table uses, so a status never changes colour
 *  between screens. */
const STATUS_TONE: Record<MemberStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
}

export function RequestQueue({ requests }: { requests: MemberRequest[] }) {
  const t = useT()
  const formatDate = useFormatDate()

  return (
    <VizCard>
      <VizCardHead
        title={t("overview.queue.title")}
        caption={t("overview.queue.caption")}
        action={
          <Link
            href="/members-requests"
            className={cn(
              "inline-flex items-center gap-1 rounded-sm text-[13px] font-medium",
              "text-text-secondary transition-colors duration-120 hover:text-text",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {t("overview.queue.viewAll")}
            <ArrowRight className="size-3.5 shrink-0" strokeWidth={2} data-flip-rtl />
          </Link>
        }
      />

      {requests.length === 0 ? (
        <div className="px-5 pb-6">
          <EmptyCell icon={Inbox} label={t("overview.queue.empty")} />
        </div>
      ) : (
        <ul className="flex flex-col px-2 pb-2">
          {requests.map((request, i) => (
            <li
              key={request.id}
              data-await-intro
              className="animate-[viz-fade-up_400ms_cubic-bezier(0.16,1,0.3,1)_both]"
              style={{ animationDelay: `${120 + i * 55}ms` }}
            >
              <Link
                href={`/members-requests?request=${request.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5",
                  "transition-colors duration-120 hover:bg-muted",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                )}
              >
                <InitialAvatar name={request.name} size={26} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text">
                    {formatText(request.name)}
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {formatText(request.organization?.name)}
                  </span>
                </span>

                <SoftBadge tone={STATUS_TONE[request.status] ?? "neutral"}>
                  {t(`status.requests.${request.status}`)}
                </SoftBadge>

                <span className="hidden w-20 shrink-0 text-end text-xs tabular-nums text-text-placeholder sm:block">
                  {formatDate(request.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </VizCard>
  )
}
