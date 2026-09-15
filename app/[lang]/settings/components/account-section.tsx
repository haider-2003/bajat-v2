"use client"

import { Loader2, LogOut, UserRound } from "lucide-react"

import {
  SettingsBlock,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { useLogout } from "@/features/auth/api"
import { useAuthStore } from "@/features/auth/store"
import type { User } from "@/features/users/types"
import { useT } from "@/i18n/context"
import { useLocaleRouter } from "@/i18n/navigation"
import type { TranslationKey } from "@/i18n/translate"
import { formatPhone } from "@/utils/format"

/**
 * Account — who you are signed in as.
 *
 * The rail used to carry this as a read-only 52px block above the sign-out
 * button. It was the wrong place for it: a permanent slot in the navigation,
 * spent on fields nobody navigates to. The rail carries no account block at
 * all now — this screen is where "things about you" live, and the only way
 * out of the app.
 *
 * Every field here is a stable fact about the account, and a login-time
 * snapshot is a fair way to show one. Two-factor status is deliberately absent:
 * it is the one thing on this list that changes server-side mid-session, so a
 * snapshot of it is either always true — nobody reaches this screen without
 * clearing 2FA — or quietly wrong. There is no endpoint to read it live.
 *
 * The fields are read-only on purpose. They come from the directory — an admin
 * creates the account and sets its type and roles — so an editable form here
 * would be promising a write this screen has no endpoint for. Saying where to
 * go instead is more honest than a disabled input.
 *
 * Signing out lives at the bottom of this section rather than in the rail. A
 * permanent red button in the navigation spends a slot, every day, on the one
 * action a person takes when they are already leaving; here it sits with the
 * rest of the account, one step off the path of anything else.
 *
 * The local logout runs whether or not the server call succeeds — a failed
 * request must never trap someone inside a signed-in shell
 * (docs/authentication.md §7).
 */

/**
 * Not `t(\`settings.account.type.${user.type}\`)`: the wire values are
 * snake_case and `TranslationKey` is a literal union, so the mapping has to be
 * written down for the type checker to agree it is total.
 */
const TYPE_LABEL: Record<User["type"], TranslationKey> = {
  admin: "settings.account.type.admin",
  organization_user: "settings.account.type.organizationUser",
  branch_user: "settings.account.type.branchUser",
}

function Value({
  children,
  muted,
  ltr,
}: {
  children: React.ReactNode
  muted?: boolean
  ltr?: boolean
}) {
  return (
    <span
      // A phone number is digits: it reads left-to-right in both languages,
      // and letting it inherit `rtl` moves the country code to the wrong end.
      dir={ltr ? "ltr" : undefined}
      className={
        muted
          ? "text-[13px] text-text-muted"
          : "text-[13px] font-medium text-text"
      }
    >
      {children}
    </span>
  )
}

export function AccountSection() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  // The locale-aware router: `/login` is not a route, `/en/login` is.
  const router = useLocaleRouter()
  const logout = useAuthStore((s) => s.logout)
  const logoutMutation = useLogout()
  const pending = logoutMutation.isPending

  const signOut = () => {
    if (pending) return
    const finish = () => {
      logout()
      router.push("/login")
    }
    logoutMutation.mutate(undefined, { onSuccess: finish, onError: finish })
  }

  return (
    <SettingsSection
      id="account"
      icon={UserRound}
      title={t("settings.account.title")}
      description={t("settings.account.description")}
    >
      {!user ? (
        <SettingsBlock>
          <p className="text-[13px] text-text-muted">
            {t("settings.account.signedOut")}
          </p>
        </SettingsBlock>
      ) : (
        <>
          <SettingsRow
            label={t("settings.account.nameLabel")}
            control={<Value>{user.name}</Value>}
          />
          <SettingsRow
            label={t("settings.account.phoneLabel")}
            control={<Value ltr>{formatPhone(user.phone)}</Value>}
          />
          <SettingsRow
            label={t("settings.account.emailLabel")}
            control={
              user.email ? (
                <Value ltr>{user.email}</Value>
              ) : (
                <Value muted>{t("settings.account.notSet")}</Value>
              )
            }
          />
          <SettingsRow
            label={t("settings.account.typeLabel")}
            control={<Value>{t(TYPE_LABEL[user.type])}</Value>}
          />
          {user.organization && (
            <SettingsRow
              label={t("settings.account.organizationLabel")}
              control={<Value>{user.organization.name}</Value>}
            />
          )}
          <SettingsRow
            label={t("settings.account.signOutLabel")}
            description={t("settings.account.signOutDescription")}
            control={
              <Button
                variant="destructive"
                onClick={signOut}
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <LogOut data-icon="inline-start" strokeWidth={1.75} />
                )}
                {pending ? t("auth.signingOut") : t("auth.signOut")}
              </Button>
            }
          />
        </>
      )}
    </SettingsSection>
  )
}
