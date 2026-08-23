import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
