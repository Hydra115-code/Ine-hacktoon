"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OnboardingModal } from "@/features/onboarding/components/OnboardingModal";
import { PaperAvatar } from "@/features/paper/components/PaperAvatar";
import { PaperDialogue } from "@/features/paper/components/PaperDialogue";
import { PublicNav } from "@/features/workspace/components/PublicNav";
import { useWorkspaceStore } from "@/features/workspace/state/workspace-store";
import type { PaperMood } from "@/features/paper/paper-mood";

const PAPER_TEASERS: Array<{ kicker: string; message: string; mood: PaperMood }> = [
  {
    kicker: "Una pista para empezar",
    message: "Un promedio nacional puede ocultar historias muy distintas por edad y territorio. ¿Buscamos la tuya?",
    mood: "presenting",
  },
  {
    kicker: "Cambia la pregunta",
    message: "No preguntes solo cuántas personas votaron. Pregunta qué cambió y para quién.",
    mood: "pointing",
  },
  {
    kicker: "Mira más de cerca",
    message: "Tu estado puede contar una historia diferente a la del país. Puedo ayudarte a compararlas.",
    mood: "approving",
  },
  {
    kicker: "Hay algo que descubrir",
    message: "A veces la diferencia más interesante no está entre años, sino entre generaciones.",
    mood: "surprised",
  },
];

export default function HomePage() {
  const router = useRouter();
  const setDraft = useWorkspaceStore((state) => state.setDraft);
  const [question, setQuestion] = useState("");
  const [teaserIndex, setTeaserIndex] = useState(0);
  const teaser = PAPER_TEASERS[teaserIndex];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTeaserIndex((current) => (current + 1) % PAPER_TEASERS.length);
    }, 6800);
    return () => window.clearInterval(interval);
  }, []);

  const startQuestion = (event: React.FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    if (!value) return;
    setDraft(value);
    router.push("/conversar");
  };

  return (
    <div className="landing-shell">
      <PublicNav />
      <OnboardingModal />

      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <span className="landing-sticker landing-sticker--primary">Datos que sí puedes seguir</span>
            <p className="landing-overline">INE Explora · Participación ciudadana</p>
            <h1 id="landing-title">
              Entender cómo participamos empieza con <em>una buena pregunta.</em>
            </h1>
            <p className="landing-intro">
              Paper convierte datos oficiales en una experiencia que puedes preguntar,
              comparar y recorrer a tu manera.
            </p>

          </div>

          <div className="landing-paper-stage">
            <span className="landing-sticker landing-sticker--paper">Pregunta. Paper investiga.</span>
            <PaperAvatar mood="idle" size="hero" followPointer={false} />
            <PaperDialogue
              key={teaserIndex}
              className="landing-paper-note"
              label={`Paper · ${teaser.kicker}`}
              message={teaser.message}
            />
          </div>
        </section>

        <form className="landing-question" onSubmit={startQuestion} role="search" aria-label="Pregunta a Paper">
          <label htmlFor="landing-question-input">Pregunta a Paper</label>
          <div className="landing-question__control">
            <input
              id="landing-question-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Escribe una pregunta sobre participación ciudadana"
              enterKeyHint="send"
            />
            <button type="submit" aria-label="Preguntar a Paper" disabled={!question.trim()}>
              Preguntar <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>

      </main>
    </div>
  );
}
