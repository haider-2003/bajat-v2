import { House } from "lucide-react"

import { IdCardHover } from "@/components/brand/id-card-hover"
import { AppShell } from "@/components/layout/app-shell"
import { SidebarTrigger } from "@/components/layout/sidebar"
import { Button } from "@/components/ui/button"
import { LocaleLink } from "@/i18n/link"
import { getTranslations } from "@/i18n/server"
import type { TranslationKey } from "@/i18n/translate"

/**
 * A screen the sidebar already lists but nobody has built yet.
 *
 * Until now these routes fell through the catch-all to the 404, which says
 * the wrong thing: the page is not lost, it is not written. This is the
 * honest version — the same shell as every finished screen, with the rail
 * lighting the item you clicked and the breadcrumb naming where you are,
 * and in place of the table a state laid out exactly like the 404 and the
 * failed load (§8.10, §20.11): illustration on the dot grid, overline,
 * headline, muted body, one action. The illustration is the card held
 * above the slot it will go in, so the four states stay one object in four
 * situations — see `IdCardHover`.
 *
 * The body is the screen's own line about what it will do, not a generic
 * "check back later": the sidebar is the roadmap (a screen listed there is
 * a screen that is coming), and this page is where that roadmap gets a
 * sentence. When the real screen ships, its `page.tsx` replaces the one
 * that renders this; nothing here needs unpicking.
 *
 * The action is outline, not primary, and goes home rather than anywhere
 * clever: there is nothing on this screen to act on, and on a phone — where
 * the drawer is closed — it is the one way out that is not the browser's
 * back button.
 */
export async function ComingSoon({
  sectionKey,
  titleKey,
  bodyKey,
}: {
  /** The sidebar section the route sits in, for the breadcrumb. */
  sectionKey: TranslationKey
  /** The route's own label — the same key the sidebar uses. */
  titleKey: TranslationKey
  /** One sentence on what the screen will do once it exists. */
  bodyKey: TranslationKey
}) {
  const t = await getTranslations()
  const screen = t(titleKey)

  return (
    <AppShell>
      {/* Identity bar (§6.1) — the same one every finished screen has, so
          the rail's chip and the breadcrumb agree on where you are. */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
        <SidebarTrigger />
        <nav
          aria-label={t("common.breadcrumb")}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="hidden text-sm text-text-secondary sm:inline">
            {t(sectionKey)}
          </span>
          <span className="hidden text-sm text-text-placeholder sm:inline">/</span>
          <span className="truncate text-sm font-medium text-text">{screen}</span>
        </nav>
      </header>

      {/* The rest of the viewport, with the state centred in it — the way
          the 404 centres in its page, not a card in the top-left corner of
          an otherwise empty screen. `min-h` rather than `h`, so on a short
          phone the page scrolls instead of clipping the button. */}
      <section className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-12">
        {/* Illustration, on the dot grid faded to nothing before it reaches
            an edge — the flow canvas's "infinite surface" (§1.7), the same
            ground the 404 and the failed load stand on. The box is taller
            than the drawing so the grid has room to fade around it. */}
        <div className="relative flex h-56 w-full max-w-110 items-center justify-center sm:h-64">
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
          <IdCardHover className="relative" />
        </div>

        {/* Overline (§3.3 `--text-overline`): the one place uppercase is
            allowed outside sidebar section labels. The screen's name goes
            here, the way the 404's overline names its kind, and the headline
            is the two words that matter. */}
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted sm:mt-8">
          {screen}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.015em] text-balance text-text sm:text-2xl">
          {t("comingSoon.title")}
        </h1>
        <p className="mt-2 max-w-85 text-[13px] leading-[1.55] text-pretty text-text-muted sm:text-sm">
          {t(bodyKey)}
        </p>

        <Button
          variant="outline"
          size="lg"
          className="mt-6 h-11 w-full sm:mt-8 sm:h-9 sm:w-auto"
          nativeButton={false}
          render={<LocaleLink href="/" />}
        >
          <House data-icon="inline-start" strokeWidth={1.75} />
          {t("comingSoon.goHome")}
        </Button>
      </section>
    </AppShell>
  )
}
