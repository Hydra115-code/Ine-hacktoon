"use client";

import { useMemo, useState } from "react";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import { MethodologyNotice } from "@/features/generative-ui/primitives/content/MethodologyNotice";
import { SourceNotice } from "@/features/generative-ui/primitives/content/SourceNotice";
import type { LocalUIEvent } from "@/features/generative-ui/interactions/events/local-ui-event";
import {
  buildParticipationHarnessSpecification,
  buildSyntheticParticipationData,
  type ParticipationHarnessView,
  type SyntheticEntityId,
} from "./participation-harness-model";
import styles from "./page.module.css";

const viewLabels: Record<ParticipationHarnessView, string> = {
  complete: "Vista completa",
  "without-chart": "Sin gráfica",
  "table-only": "Sólo tabla",
};

export function INEParticipationProbe() {
  const [entityId, setEntityId] = useState<SyntheticEntityId>("national-scenario");
  const [view, setView] = useState<ParticipationHarnessView>("complete");
  const [history, setHistory] = useState<ParticipationHarnessView[]>([]);
  const [announcement, setAnnouncement] = useState("Vista completa lista para explorar.");
  const data = useMemo(() => buildSyntheticParticipationData(entityId), [entityId]);
  const specification = useMemo(() => buildParticipationHarnessSpecification(view), [view]);

  function changeView(next: ParticipationHarnessView, message: string) {
    if (next === view) return;
    setHistory((current) => [...current, view].slice(-10));
    setView(next);
    setAnnouncement(message);
  }

  function restorePreviousView() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setView(previous);
    setAnnouncement(`Se recuperó: ${viewLabels[previous]}.`);
  }

  function handleEvent(event: LocalUIEvent) {
    if (event.name !== "participation.entity.changed" || typeof event.value !== "string") return;
    if (!["national-scenario", "entity-alpha", "entity-beta"].includes(event.value)) return;
    setEntityId(event.value as SyntheticEntityId);
    setAnnouncement("La comparación se actualizó para la entidad seleccionada.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>INT-03 · Laboratorio de integración</p>
        <h1>Participación ciudadana: evidencia que se puede explorar</h1>
        <p>Prueba el contrato, las ediciones de vista y la accesibilidad antes de conectar el dataset CCPC.</p>
        <strong className={styles.syntheticWarning}>Datos sintéticos de prueba · No son cifras oficiales del INE</strong>
      </header>

      <nav aria-label="Ediciones de la interfaz generativa" className={styles.commands}>
        <span>Simular petición:</span>
        <button aria-pressed={view === "complete"} type="button" onClick={() => changeView("complete", "Se mostró la vista completa.")}>Vista completa</button>
        <button aria-pressed={view === "without-chart"} type="button" onClick={() => changeView("without-chart", "Se quitó la gráfica y se conservó la evidencia.")}>Quita la gráfica</button>
        <button aria-pressed={view === "table-only"} type="button" onClick={() => changeView("table-only", "Se dejó únicamente la tabla.")}>Deja sólo la tabla</button>
        <button disabled={history.length === 0} type="button" onClick={restorePreviousView}>Recuperar vista anterior</button>
      </nav>

      <p aria-live="polite" className={styles.announcement}>{announcement}</p>

      <section aria-label="Vista generada" className={styles.canvas}>
        <UIRenderer
          bindingOptions={{ locale: "es-MX" }}
          data={data}
          onEvent={handleEvent}
          specification={specification}
        />
      </section>

      <section aria-label="Procedencia y método" className={styles.evidence}>
        <SourceNotice institution="Laboratorio local INE Explora" label="Fixture sintético para validar la integración; pendiente de sustituir por CCPC verificado" />
        <MethodologyNotice caveats={[
          "Los valores usan una base ficticia de 100 personas para hacer verificable el cálculo.",
          "No deben citarse, publicarse ni interpretarse como resultados electorales.",
        ]}>
          La participación se calcula como personas que votaron entre lista nominal, multiplicado por cien. La diferencia se expresa en puntos porcentuales.
        </MethodologyNotice>
      </section>
    </main>
  );
}
