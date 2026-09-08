import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "../globals.css";
import { ThemeProvider, themeInitScript } from "@/components/layout/theme-provider";
import { brandInitScript } from "@/components/layout/brand";
import { IntroSplash, introInitScript } from "@/components/layout/intro-splash";
import { ReactQueryProvider } from "@/providers/react-query-provider";
import { I18nProvider } from "@/i18n/context";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, locales, localeDir } from "@/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist carries no Arabic glyphs, so Arabic copy would fall back to whatever
// the OS happens to have — Tahoma on Windows, Geeza Pro on macOS — and render
// differently on every machine. Loading one face keeps it consistent.
//
// Now that Arabic is a whole UI rather than one subtitle, `html[lang="ar"]` in
// globals.css promotes this face to the document font.
//
// IBM Plex Sans Arabic rather than Noto: Noto's brief is *coverage* — one
// glyph for every script — which is why it reads as neutral to the point of
// plain at UI sizes. Plex Arabic is drawn as an interface text face, so it
// holds even colour down a 13px table column and its slightly squared joins
// sit level beside Geist's Latin instead of reading as a fallback that got
// substituted in.
//
// Static family, so the weights are enumerated. These five are the ones the
// UI actually sets — 300 nowhere yet, but the type scale reserves it, and a
// weight that is asked for and not loaded is synthesised into a smear.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic-sans",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
});

/**
 * Pre-render both languages. Every route sits under this segment, so one list
 * here is the whole set of locale roots the app can serve.
 */
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.app.name,
    description: dict.app.description,
  };
}

// Mobile-first: fill the viewport edge to edge and allow pinch-zoom (never
// disable it — it is an accessibility requirement). See DESIGN.md §18.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  // The proxy only ever routes to a real locale, so anything else was typed by
  // hand. A 404 is honest; falling back to English would serve one language on
  // a URL promising another.
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      // Almost all of this codebase's spacing is written in logical properties
      // (`ms-`, `pe-`, `start-`), so this one attribute mirrors the layout —
      // there is no second, flipped stylesheet to keep in step.
      dir={localeDir[lang]}
      className={`${geistSans.variable} ${geistMono.variable} ${plexArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint so the page never
            flashes the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Same, for the accent hue and primary-button strategy (§2.1).
            No provider — the brand store reads straight from the attributes
            this stamps on <html>. */}
        <script dangerouslySetInnerHTML={{ __html: brandInitScript }} />
        {/* Paints the intro cover before first paint so the app never flashes
            underneath, and keeps SSR/client markup identical. */}
        <script dangerouslySetInnerHTML={{ __html: introInitScript }} />
      </head>
      <body className="min-h-full">
        {/* Outermost of the providers: the splash, the shell and every screen
            under them read their copy from here. */}
        <I18nProvider locale={lang} dict={dict}>
          <ReactQueryProvider>
            <ThemeProvider>
              <IntroSplash />
              {children}
            </ThemeProvider>
          </ReactQueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
