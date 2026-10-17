"use client";

import { useState } from "react";
import { UIRenderer } from "@/features/generative-ui/renderer/UIRenderer";
import { f1CivicCatalogData, f1CivicCatalogSpecification } from "@/features/generative-ui/fixtures/f1-civic-catalog-fixture";
import { f3MexicoMapData, f3MexicoMapSpecification } from "@/features/generative-ui/fixtures/f3-mexico-map-fixture";
import {
  auditContentSpecification, auditCoveredNodeTypes, auditInteractionSpecification,
  auditTableSpecification, auditVisualizationMarks, auditVisualizationSpecification, genUIAuditData,
} from "@/features/generative-ui/fixtures/genui-audit-fixture";
import { nodeCapabilityMatrix } from "@/features/generative-ui/runtime/node-capability-matrix";
import styles from "./page.module.css";

const sections = [
  ["content", "Contenido y estados"], ["civic", "Componentes cívicos"], ["charts", "Gráficas"],
  ["tables", "Tablas"], ["controls", "Controles y layouts"], ["map", "Mapa interactivo"],
] as const;

export function GenUIAuditProbe() {
  const [lastEvent, setLastEvent] = useState("Ninguna interacción emitida");
  const missingTypes = nodeCapabilityMatrix.map((item) => item.type)
    .filter((type) => !auditCoveredNodeTypes.includes(type as (typeof auditCoveredNodeTypes)[number]));
  const onEvent = (event: unknown) => setLastEvent(JSON.stringify(event));

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p>Auditoría integral · GenUI</p>
        <h1>Todo lo que Paper puede generar</h1>
        <span>Datos sintéticos · Auditoría visual y funcional</span>
        <div className={styles.score}>
          <strong>{auditCoveredNodeTypes.length}/{nodeCapabilityMatrix.length}</strong><span>tipos de nodo cubiertos</span>
          <strong>{auditVisualizationMarks.length}/8</strong><span>variantes de gráfica</span>
          <strong>{missingTypes.length}</strong><span>capacidades faltantes</span>
        </div>
      </header>

      <nav className={styles.nav} aria-label="Secciones de auditoría">
        {sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
      </nav>
      <p className={styles.event} aria-live="polite"><strong>Último evento:</strong> {lastEvent}</p>

      <AuditSection id="content" label="01 · Jerarquía, contenido y estados">
        <UIRenderer bindingOptions={{ locale: "es-MX" }} data={genUIAuditData} specification={auditContentSpecification} />
      </AuditSection>
      <AuditSection id="civic" label="02 · Componentes electorales especializados">
        <UIRenderer bindingOptions={{ locale: "es-MX" }} data={f1CivicCatalogData} specification={f1CivicCatalogSpecification} />
      </AuditSection>
      <AuditSection id="charts" label="03 · Todas las gráficas y sus tablas alternativas">
        <UIRenderer bindingOptions={{ locale: "es-MX" }} data={genUIAuditData} specification={auditVisualizationSpecification} />
      </AuditSection>
      <AuditSection id="tables" label="04 · Tablas, densidad, filtros, orden y selección">
        <UIRenderer bindingOptions={{ locale: "es-MX" }} data={genUIAuditData} specification={auditTableSpecification} onEvent={onEvent} />
      </AuditSection>
      <AuditSection id="controls" label="05 · Controles, layouts y lógica">
        <UIRenderer bindingOptions={{ locale: "es-MX" }} data={genUIAuditData} specification={auditInteractionSpecification} onEvent={onEvent} />
      </AuditSection>
      <AuditSection id="map" label="06 · Geografía interactiva">
        <UIRenderer bindingOptions={{ locale: "es-MX" }} data={f3MexicoMapData} specification={f3MexicoMapSpecification} onEvent={onEvent} />
      </AuditSection>
    </main>
  );
}

function AuditSection({ children, id, label }: { children: React.ReactNode; id: string; label: string }) {
  return <section className={styles.auditSection} id={id}><h2>{label}</h2><div className={styles.canvas}>{children}</div></section>;
}
