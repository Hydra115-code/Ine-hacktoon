"use client";

import { useMemo, useState } from "react";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import {
  composeF2CivicFixture,
  f2CompositionData,
  f2CompositionQuestions,
} from "@/features/generative-ui/fixtures/f2-civic-composition-fixture";
import styles from "./page.module.css";

export function F2CompositionProbe() {
  const [query, setQuery] = useState<string>(f2CompositionQuestions[0]);
  const result = useMemo(() => composeF2CivicFixture(query), [query]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>F2 · Composición por intención</p>
          <h1>La pregunta decide la interfaz</h1>
        </div>
        <span>Fixture sintético · No representa cifras oficiales</span>
      </header>
      <nav aria-label="Consultas para probar la composición" className={styles.questions}>
        {f2CompositionQuestions.map((question) => (
          <button aria-pressed={query === question} key={question} onClick={() => setQuery(question)} type="button">
            {question}
          </button>
        ))}
      </nav>
      <aside aria-live="polite" className={styles.plan}>
        <span>Intención: <strong>{result.plan.intent}</strong></span>
        <span>Principal: <strong>{result.plan.primary}</strong></span>
        <span>Apoyo: <strong>{result.plan.supporting.join(" + ") || "ninguno"}</strong></span>
        <span>Presentación: <strong>{result.plan.presentation}</strong></span>
        <p>{result.plan.rationale}</p>
      </aside>
      <section aria-label="Vista compuesta para la consulta seleccionada" className={styles.canvas}>
        <UIRenderer
          bindingOptions={{ locale: "es-MX" }}
          data={f2CompositionData}
          specification={result.specification}
        />
      </section>
    </main>
  );
}
