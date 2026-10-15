import { AppShell } from "@/features/workspace/components/AppShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversar con Paper",
  description:
    "Haz preguntas en lenguaje natural sobre las elecciones y participación ciudadana. Paper genera visualizaciones adaptativas al instante.",
};

export default function ConversarPage() {
  return <AppShell />;
}
