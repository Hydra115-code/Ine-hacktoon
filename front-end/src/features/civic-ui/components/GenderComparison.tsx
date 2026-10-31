"use client";

import { useId } from "react";
import { GENDER_TURNOUT_DATA, type GenderTurnoutByAge } from "../civic-data-fixtures";

interface GenderComparisonProps {
  data?: GenderTurnoutByAge[];
  title?: string;
}

export function GenderComparison({
  data = GENDER_TURNOUT_DATA,
  title = "Participación por sexo y grupo de edad",
}: GenderComparisonProps) {
  const chartId = useId();

  return (
    <div className="civic-metric-card" role="region" aria-labelledby={chartId}>
      <header className="civic-metric-card__header">
        <h3 id={chartId} style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-family-display)" }}>
          {title}
        </h3>
        <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "0.8rem", fontWeight: 600 }}>
          <span style={{ color: "var(--color-brand-primary)" }}>● Mujeres</span>
          <span style={{ color: "var(--color-civic-accent)" }}>● Hombres</span>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        {data.map((item) => (
          <div key={item.ageGroup} style={{ display: "grid", gridTemplateColumns: "70px 1fr 60px", gap: "var(--space-3)", alignItems: "center", fontSize: "0.85rem" }}>
            <span style={{ fontWeight: 600 }}>{item.ageGroup}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {/* Barra mujeres */}
              <div role="img" aria-label={`Mujeres de ${item.ageGroup}: ${item.womenTurnout}%`} style={{ height: 10, background: "var(--color-surface-secondary)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${item.womenTurnout}%`, height: "100%", background: "var(--color-brand-primary)", borderRadius: 2 }} />
              </div>
              {/* Barra hombres */}
              <div role="img" aria-label={`Hombres de ${item.ageGroup}: ${item.menTurnout}%`} style={{ height: 10, background: "var(--color-surface-secondary)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${item.menTurnout}%`, height: "100%", background: "var(--color-civic-accent)", borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "0.78rem" }}>
              <strong style={{ color: "var(--color-brand-primary)" }} aria-label={`Mujeres: ${item.womenTurnout}%`}>M: {item.womenTurnout}%</strong>
              <div style={{ color: "var(--color-civic-accent)" }} aria-label={`Hombres: ${item.menTurnout}%`}>H: {item.menTurnout}%</div>
            </div>
          </div>
        ))}
      </div>

      <p className="civic-metric-card__footnote">
        En casi todos los rangos (especialmente de 20 a 39 años), las mujeres participan en una proporción de 8 a 10 puntos porcentuales mayor que los hombres.
      </p>
    </div>
  );
}
