import type { Metadata } from "next";
import { VerifiedStoryPage } from "@/features/electoral-story/components/VerifiedStoryPage";
import "@/features/electoral-story/styles/verified-story.css";

export const metadata: Metadata = {
  title: "Historia guiada de participación",
  description: "Recorrido verificable por los datos públicos de participación ciudadana del CCPC.",
};

export default function HistoriasPage() {
  return <VerifiedStoryPage />;
}
