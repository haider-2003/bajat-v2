"use client"

import { IdCardStack } from "@/components/brand/id-card-stack"
import { use2FASetup } from "@/features/auth/api"
import { qrCodeSrc } from "@/features/auth/qr"
import { useT } from "@/i18n/context"
import { cn } from "@/lib/utils"

/**
 * The brand panel's card stack, plus the one thing it reacts to.
 *
 * When an administrator resets someone's 2FA, that user's next sign-in has to
 * show them a **new** QR to enrol against — otherwise the authenticator step
 * asks for a code from an app that no longer holds a matching secret, which is
 * a dead end. Rather than bolt a QR panel onto the form, the card the splash
 * just set down turns over and the code is on its back: the object the whole
 * sign-in screen is built around becomes the thing that carries it.
 *
 * ## Why this reads the query cache instead of taking a prop
 *
 * `BrandPanel` is a server component and a *sibling* of `LoginForm` — there is
 * no shared React state between them, and threading one in would mean a client
 * provider around both halves of the page plus an effect to copy the fetched
 * QR into it.
 *
 * `["2fa-setup"]` is already that shared state. The form owns the fetch (it is
 * the only side that knows the step and the `tfaEnabled` flag); this observer
 * passes `enabled: false`, which stops it triggering a request of its own but
 * still subscribes it to the cache entry. So the code lands here on the same
 * render the form gets it.
 *
 * The form only ever enables that query for a user whose `tfaEnabled` is
 * `false`, and clears the entry once enrolment succeeds or the user starts over
 * with a different number — so data in this cache *means* "enrolling, now".
 */
export function PanelStack() {
  const t = useT()
  const { data } = use2FASetup(false)
  const qrCode = data?.qrCode

  return (
    <div className="relative">
      <IdCardStack
        mode="panel"
        qr={
          qrCode
            ? {
                src: qrCodeSrc(qrCode),
                title: t("auth.enroll.cardTitle"),
                hint: t("auth.enroll.cardHint"),
              }
            : null
        }
      />

      {/* Absolutely placed, and rendered whether or not there is a code: the
          stack is optically centred in the panel, so a caption that joins the
          flow would shove it upward at the exact moment the card turns.

          Hidden from assistive tech along with the stack it describes — the
          form carries the real instruction, and the setup key with it, at every
          breakpoint. */}
      <p
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-full mt-9 text-center text-[13px] text-white/55",
          "transition-opacity duration-500 delay-700",
          qrCode ? "opacity-100" : "opacity-0"
        )}
      >
        {t("auth.enroll.scanHint")}
      </p>
    </div>
  )
}
