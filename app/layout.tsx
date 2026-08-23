import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/layout/theme-provider";
import { IntroSplash, introInitScript } from "@/components/layout/intro-splash";

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
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "Bajat",
  description: "Smart Identity System",
};

// Mobile-first: fill the viewport edge to edge and allow pinch-zoom (never
// disable it — it is an accessibility requirement). See DESIGN.md §18.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint so the page never
            flashes the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Paints the intro cover before first paint so the app never flashes
            underneath, and keeps SSR/client markup identical. */}
        <script dangerouslySetInnerHTML={{ __html: introInitScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <IntroSplash />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
