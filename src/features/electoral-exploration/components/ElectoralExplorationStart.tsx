"use client";

import { electoralExplorationIntents } from "../electoral-exploration-intents";

interface ElectoralExplorationStartProps {
  onSelect?: (prompt: string) => void;
}

function IntentIcon({ focus }: { focus: "period" | "territory" | "evidence" }) {
  if (focus === "period") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18V9m7 9V5m7 13v-7M3 20h18" /></svg>;
  }
  if (focus === "territory") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 5-3 6 3 5-3v13l-5 3-6-3-5 3V7Zm5-3v13m6-10v13" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8m-8 4h8m-8 4h5" /></svg>;
}

export function ElectoralExplorationStart({ onSelect }: ElectoralExplorationStartProps) {
  return (
    <section className="electoral-start" aria-labelledby="electoral-start-title">
      <header className="electoral-start__header">
        <p className="electoral-start__eyebrow">Exploración electoral</p>
        <h2 id="electoral-start-title">Haz una pregunta; la vista se adapta a lo que necesitas entender</h2>
        <p>
          Elige un punto de partida o escribe tu propia consulta. La interfaz se construirá únicamente
          con información disponible en las fuentes conectadas.
        </p>
      </header>

      <div className="electoral-start__guide" aria-label="Cómo obtener una respuesta clara">
        <span><strong>Territorio</strong> ¿Dónde?</span>
        <span><strong>Periodo</strong> ¿Cuándo?</span>
        <span><strong>Evidencia</strong> ¿Qué lo respalda?</span>
      </div>

      <div className="electoral-start__intents" aria-label="Ideas para comenzar">
        {electoralExplorationIntents.map((intent) => (
          <button key={intent.id} type="button" onClick={() => onSelect?.(intent.prompt)}>
            <span className="electoral-start__icon"><IntentIcon focus={intent.focus} /></span>
            <span className="electoral-start__card-copy">
              <small>{intent.label}</small>
              <strong>{intent.title}</strong>
              <span>{intent.description}</span>
            </span>
            <svg className="electoral-start__arrow" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10h11M11 6l4 4-4 4" />
            </svg>
          </button>
        ))}
      </div>

      <p className="electoral-start__trust">
        <span aria-hidden="true">✓</span>
        Sin cifras estimadas: si una fuente todavía no está conectada, te lo diremos con claridad.
      </p>
    </section>
  );
}
