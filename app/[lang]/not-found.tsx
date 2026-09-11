import type { Metadata } from "next"
import { House } from "lucide-react"

import { BajatMark } from "@/components/brand/bajat-mark"
import { IdCardFlip } from "@/components/brand/id-card-flip"
import { InitScriptsReplay } from "@/components/layout/init-scripts-replay"
import { Button } from "@/components/ui/button"
import { LocaleLink } from "@/i18n/link"
import { getTranslations } from "@/i18n/server"

/**
 * Honoured here even though `not-found.tsx` takes no params: the tab would
 * otherwise read the layout's plain app name, which says nothing went wrong.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
  return { title: t("notFound.metaTitle") }
}

/**
 * 404 — the page under `/[lang]` that does not exist.
 *
 * Renders for two things: a `notFound()` thrown anywhere under this segment
 * (a member or template id that is not on the server), and any URL the
 * catch-all in `[...missing]/page.tsx` swallows. Either way it sits inside
 * the `[lang]` layout, so the theme, both fonts and the dictionary are all
 * already here — `getTranslations()` reads the locale straight from the root
 * param, the same as any other server component.
 *
 * No app shell. A lost visitor may well be signed out, and the sidebar's
 * route guard would bounce them to /login before they read what happened.
 * Like the login screen it is a standalone page on the page grey, with the
 * wordmark up top so it is recognisably still Bajat.
 *
 * A 404 is also the one response Next client-renders from an empty shell,
 * which silently skips the layout's head scripts — `InitScriptsReplay`
 * explains and repairs that.
 *
 * Laid out as an empty state (DESIGN.md §8.10, §20.11): illustration, a
 * 16–24px headline, muted body capped at ~320px, one primary CTA. The
 * illustration is the only thing that moves, and it stops under reduced
 * motion (§18.0 rule 10).
 */
export default async function NotFound() {
  const t = await getTranslations()

  return (
    <main
      className="flex min-h-svh flex-col bg-background px-4 sm:px-6"
      // §18.0 rule 7 — the wordmark row and the CTA sit near screen edges on
      // a phone, so both clear the notch and the home indicator.
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <InitScriptsReplay />

      {/* Wordmark — same row height as the app header (§6.2), so the page
          lines up with the shell it stands in for. */}
      <header className="flex h-14 shrink-0 items-center gap-2.5">
        <BajatMark className="size-5 text-text" />
        <span className="text-sm font-semibold tracking-[-0.01em] text-text">
          {t("app.name")}
        </span>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-12">
        {/* Illustration, on a dot grid faded to nothing before it reaches an
            edge. The grid is the flow canvas's "infinite surface" motif
            (§1.7) and gives the card a ground to turn over on without a
            panel boxing it in. The box is taller than the card so the grid
            has room to fade, and so the card's corners have room to sweep
            through it mid-turn. */}
        <div className="relative flex h-52 w-full max-w-110 items-center justify-center sm:h-60">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 inset-y-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, color-mix(in oklab, var(--border-strong) 70%, transparent) 1px, transparent 1.5px)",
              backgroundSize: "20px 20px",
              backgroundPosition: "center",
              maskImage:
                "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 75%)",
            }}
          />
          <IdCardFlip className="relative" />
        </div>

        {/* Overline (§3.3 `--text-overline`): the one place uppercase is
            allowed outside sidebar section labels. */}
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted sm:mt-10">
          {t("notFound.code")}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.015em] text-balance text-text sm:text-2xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-2 max-w-85 text-[13px] leading-[1.55] text-pretty text-text-muted sm:text-sm">
          {t("notFound.body")}
        </p>

        {/* The single primary action on the page (§1.1 rule 4). Full width
            and 44px on a phone, a `lg` control on anything wider — the same
            pair the templates page uses for its own CTA. */}
        <Button
          size="lg"
          className="mt-6 h-11 w-full sm:mt-8 sm:h-9 sm:w-auto"
          nativeButton={false}
          render={<LocaleLink href="/" />}
        >
          <House data-icon="inline-start" strokeWidth={1.75} />
          {t("notFound.goHome")}
        </Button>
      </section>
    </main>
  )
}
