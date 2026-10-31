"use client";

import { useId } from "react";
import { AGE_GROUP_DATA, type AgeGroupTurnout } from "../civic-data-fixtures";

interface AgeDistributionProps {
  data?: AgeGroupTurnout[];
  title?: string;
  subtitle?: string;
}

export function AgeDistribution({
  data = AGE_GROUP_DATA,
  title = "Participación y abstención por grupo de edad",
  subtitle = "La paradoja del primer voto vs. jóvenes de 20 a 29 años",
}: AgeDistributionProps) {
  const chartId = useId();

  return (
    <div className="civic-metric-card" role="region" aria-labelledby={chartId}>
      <header className="civic-metric-card__header">
        <div>
          <h3 id={chartId} style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-family-display)" }}>
            {title}
          </h3>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        </div>
      </header>

      <div className="civic-bar-list" style={{ marginTop: "var(--space-3)" }}>
        {data.map((item) => (
          <div key={item.ageGroup} className="civic-bar-item">
            <span className="civic-bar-label">
              {item.ageGroup}
            </span>
            <div className="civic-bar-track" title={`Participación: ${item.turnout}%, Abstención: ${item.abstention}%`}>
              <div
                className={`civic-bar-fill ${item.highlight ? "civic-bar-fill--highlight" : ""}`}
                style={{ width: `${item.turnout}%` }}
              />
            </div>
            <span className="civic-bar-val">{item.turnout}%</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: 10, height: 10, background: "var(--color-crayon)", borderRadius: 2 }} /> Grupos prioritarios (18–29)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: 10, height: 10, background: "var(--color-brand-primary)", borderRadius: 2 }} /> Adultos (30+)
        </span>
      </div>

      <p className="civic-metric-card__footnote">
        Observación clave: Quienes votan por primera vez (18–19) asisten con entusiasmo (64.2%), pero la participación cae drásticamente entre los 20 y 29 años (&lt;50%).
      </p>
    </div>
  );
}
