import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "INE | Explorador ciudadano",
  description: "Explora datos públicos del INE mediante interfaces generativas, claras y adaptables.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  await connection();

  return (
    <html data-theme="light" lang="es">
      <body>{children}</body>
    </html>
  );
}
