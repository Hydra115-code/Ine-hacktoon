import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

const uiFont = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ui",
  display: "swap",
});

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "INE Explora | Entiende cómo participamos, con Paper",
    template: "%s | INE Explora",
  },
  description:
    "Paper te guía por los datos oficiales de participación ciudadana 2009–2024: historias, mapas y comparaciones para entender cómo vota tu generación y tu estado.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#15141f" },
  ],
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  await connection();

  return (
    <html data-theme="light" lang="es-MX" className={`${uiFont.variable} ${displayFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
