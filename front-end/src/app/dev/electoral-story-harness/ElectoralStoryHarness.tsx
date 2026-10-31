"use client";

import { useState } from "react";
import { ElectoralExplorationStart } from "@/features/electoral-exploration/components/ElectoralExplorationStart";
import styles from "./page.module.css";

export function ElectoralStoryHarness() {
  const [draft, setDraft] = useState("");

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <ElectoralExplorationStart onSelect={setDraft} />
      </div>
      <aside className={styles.selection} aria-live="polite">
        <strong>Borrador de consulta</strong>
        <p>{draft || "Selecciona una intención para comprobar el traspaso al chat."}</p>
      </aside>
    </main>
  );
}
