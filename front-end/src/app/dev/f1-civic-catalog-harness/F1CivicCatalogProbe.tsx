"use client";

import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import {
  f1CivicCatalogData,
  f1CivicCatalogSpecification,
} from "@/features/generative-ui/fixtures/f1-civic-catalog-fixture";
import styles from "./page.module.css";

export function F1CivicCatalogProbe() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p>F1 · Catálogo GenUI electoral</p>
        <h1>Nuevas piezas para contar historias con evidencia</h1>
        <span>Fixture sintético · No representa cifras oficiales</span>
      </header>
      <section aria-label="Vista generada del catálogo F1" className={styles.canvas}>
        <UIRenderer
          bindingOptions={{ locale: "es-MX" }}
          data={f1CivicCatalogData}
          specification={f1CivicCatalogSpecification}
        />
      </section>
    </main>
  );
}
