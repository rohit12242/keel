import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Spectral } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeFrom } from "@/modules/shell/domain/shell";
import "./globals.css";

// The variable names differ from the tokens that read them
// (keel-modern-tokens.css), so the class on <html> can't override a token.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

// The wordmark only.
const spectral = Spectral({
  variable: "--font-spectral",
  weight: ["600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keel",
  description:
    "A logbook that records effort against declared objectives — the record decides what to do next.",
};

/**
 * A theme the person chose is rendered on <html>, so no page is drawn in the
 * other one first. Without a choice there is no attribute, and the tokens
 * follow the device (keel-modern-tokens.css).
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      className={`${geist.variable} ${plexMono.variable} ${spectral.variable}`}
      data-theme={theme ?? undefined}
    >
      <body>{children}</body>
    </html>
  );
}
