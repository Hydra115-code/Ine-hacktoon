"use client";

import { useState } from "react";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import type { LocalUIEvent } from "@/features/generative-ui/interactions/events/local-ui-event";
import {
  f3MexicoMapData,
  f3MexicoMapSpecification,
} from "@/features/generative-ui/fixtures/f3-mexico-map-fixture";
import styles from "./page.module.css";

export function F3MexicoMapProbe() {
  const [lastEvent, setLastEvent] = useState<LocalUIEvent>();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>F3 · Geografía interactiva</p>
          <h1>México se convierte en una interfaz</h1>
        </div>
        <span>Geometría INEGI · Valores sintéticos</span>
      </header>
      <aside aria-live="polite" className={styles.eventLog}>
        <span>Última intención emitida</span>
        <strong>{lastEvent ? `${lastEvent.name} · entidad ${String(lastEvent.value)}` : "Selecciona una entidad para probar el circuito"}</strong>
      </aside>
      <section aria-label="Vista generada del mapa F3" className={styles.canvas}>
        <UIRenderer
          bindingOptions={{ locale: "es-MX" }}
          data={f3MexicoMapData}
          onEvent={setLastEvent}
          specification={f3MexicoMapSpecification}
        />
      </section>
    </main>
  );
}
