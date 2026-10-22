import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Spectral } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${plexMono.variable} ${spectral.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
