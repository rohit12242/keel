import type { Metadata } from "next";
import { Archivo, Spectral, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Spectral({
  variable: "--font-serif",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
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
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
