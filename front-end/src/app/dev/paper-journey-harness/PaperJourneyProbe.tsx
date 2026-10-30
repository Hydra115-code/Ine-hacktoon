"use client";

import { useMemo, useState } from "react";
import { PaperDialogue } from "@/features/paper/components/PaperDialogue";
import { PaperGuide } from "@/features/paper/components/PaperGuide";
import { PaperReaction } from "@/features/paper/components/PaperReaction";
import { PaperResultIntro } from "@/features/paper/components/PaperResultIntro";
import { PaperSuggestions } from "@/features/paper/components/PaperSuggestions";
import { resolvePaperGuide } from "@/features/paper/state/paper-guide-state";
import { paperStates, type PaperState } from "@/features/paper/types/paper-state";
import type { PaperSuggestion } from "@/features/paper/types/paper-suggestion";
import styles from "./page.module.css";

const stateLabels: Record<PaperState, string> = {
  idle: "Inicio",
  understanding: "Comprendiendo",
  consulting: "Consultando",
  building: "Construyendo",
  explaining: "Explicando",
  suggesting: "Sugiriendo",
  recovering: "Recuperando",
};

const suggestions: PaperSuggestion[] = [
  {
    id: "territory",
    label: "Territorio",
    title: "Comparar entidades",
    description: "Contrasta lugares equivalentes y conserva su contexto.",
    prompt: "Compara las entidades visibles y conserva la evidencia.",
    focus: "territory",
  },
  {
    id: "period",
    label: "Periodos",
    title: "Explicar el cambio",
    description: "Profundiza sin presentar asociaciones como causas.",
    prompt: "Explica el cambio entre los periodos disponibles.",
    focus: "period",
  },
  {
    id: "evidence",
    label: "Evidencia",
    title: "Revisar el sustento",
    description: "Comprueba fuente, universo y metodología.",
    prompt: "Muestra la fuente, el universo y la metodología.",
    focus: "evidence",
  },
];

export function PaperJourneyProbe() {
  const [paperState, setPaperState] = useState<PaperState>("understanding");
  const [preparedPrompt, setPreparedPrompt] = useState("");
  const [showReaction, setShowReaction] = useState(true);
  const presentation = useMemo(() => resolvePaperGuide("ready", paperState), [paperState]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p>P6 · Recorrido completo de Paper</p>
        <h1>Una guía presente, útil y verificable</h1>
        <span>Laboratorio visual · Sin conexión al backend</span>
      </header>

      <nav className={styles.states} aria-label="Estados de Paper">
        {paperStates.map((state) => (
          <button key={state} type="button" aria-pressed={paperState === state} onClick={() => setPaperState(state)}>
            {stateLabels[state]}
          </button>
        ))}
      </nav>

      <section className={styles.stage} aria-label="Estado activo de Paper">
        <PaperGuide presentation={presentation} context="¿Cómo cambió la participación entre los periodos disponibles?" size="lg" announce={false} />
      </section>

      <section className={styles.result} aria-label="Resultado explicado por Paper">
        <PaperResultIntro
          announce={false}
          intro={{
            summary: "La vista organiza la participación por territorio y periodo para facilitar una comparación verificable.",
            presentationReason: "Preparé un mapa, una gráfica y una tabla para conectar la lectura con sus datos.",
            summaryKind: "orientation",
            evidenceCount: 3,
            sourceLabel: "Datos vinculados a esta vista",
          }}
        />
        <PaperSuggestions suggestions={suggestions} onSelect={(suggestion) => setPreparedPrompt(suggestion.prompt)} />
        {preparedPrompt ? <p className={styles.prepared} role="status"><strong>Pregunta preparada:</strong> {preparedPrompt}</p> : null}
      </section>

      <section className={styles.recovery} aria-label="Recuperación y reacción de Paper">
        <PaperDialogue label="Paper te cuenta" message="No pude completar ese cambio con suficiente evidencia. Conservé la última vista válida para que no pierdas el contexto." />
        <div className={styles.reactionStage}>
          {showReaction ? (
            <PaperReaction
              reaction={{ kind: "territory.selected", message: "Ahora estamos observando Aguascalientes.", mood: "pointing" }}
              onDismiss={() => setShowReaction(false)}
            />
          ) : <button type="button" onClick={() => setShowReaction(true)}>Mostrar reacción breve</button>}
        </div>
      </section>
    </main>
  );
}
