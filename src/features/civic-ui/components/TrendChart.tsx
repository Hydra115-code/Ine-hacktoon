"use client";

import { useId, useState } from "react";
import { ELECTION_HISTORY, type ElectionTurnout } from "../civic-data-fixtures";

interface TrendChartProps {
  data?: ElectionTurnout[];
  title?: string;
  subtitle?: string;
}

export function TrendChart({
  data = ELECTION_HISTORY,
  title = "Evolución de la participación ciudadana",
  subtitle = "Elecciones federales en México (2009–2024)",
}: TrendChartProps) {
  const [showTable, setShowTable] = useState(false);
  const chartId = useId();
  const maxTurnout = 70;
  const minTurnout = 40;

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
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          style={{
            background: "transparent",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "0.2rem 0.5rem",
            fontSize: "0.75rem",
            cursor: "pointer",
            color: "var(--color-text-muted)",
          }}
          aria-expanded={showTable}
        >
          {showTable ? "Ver gráfica" : "Ver tabla accesible"}
        </button>
      </header>

      {showTable ? (
        <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse", margin: "var(--space-3) 0" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border-subtle)", textAlign: "left" }}>
              <th style={{ padding: "0.4rem" }}>Año</th>
              <th style={{ padding: "0.4rem" }}>Tipo</th>
              <th style={{ padding: "0.4rem" }}>Participación</th>
              <th style={{ padding: "0.4rem" }}>Votos emitidos</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year} style={{ borderBottom: "1px solid var(--color-surface-secondary)" }}>
                <td style={{ padding: "0.4rem", fontWeight: 700 }}>{d.year}</td>
                <td style={{ padding: "0.4rem" }}>{d.type}</td>
                <td style={{ padding: "0.4rem", color: "var(--color-brand-primary)", fontWeight: 700 }}>{d.turnout}%</td>
                <td style={{ padding: "0.4rem" }}>{d.totalVotes} millones</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: "var(--space-3) 0" }}>
          <svg
            viewBox="0 0 600 220"
            style={{ width: "100%", height: "auto", overflow: "visible" }}
            aria-hidden="true"
          >
            {/* Guías horizontales */}
            {[45, 55, 65].map((level) => {
              const y = 200 - ((level - minTurnout) / (maxTurnout - minTurnout)) * 170;
              return (
                <g key={level}>
                  <line x1="40" y1={y} x2="580" y2={y} stroke="var(--color-border-subtle)" strokeDasharray="4 4" />
                  <text x="32" y={y + 4} fontSize="11" fill="var(--color-text-muted)" textAnchor="end">
                    {level}%
                  </text>
                </g>
              );
            })}

            {/* Curva de tendencia */}
            {(() => {
              const points = data.map((d, index) => {
                const x = 70 + index * 96;
                const y = 200 - ((d.turnout - minTurnout) / (maxTurnout - minTurnout)) * 170;
                return { x, y, d };
              });

              const pathData = points.reduce(
                (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                ""
              );

              const areaData = `${pathData} L ${points[points.length - 1].x} 200 L ${points[0].x} 200 Z`;

              return (
                <>
                  <path d={areaData} fill="var(--color-brand-soft)" />
                  <path d={pathData} fill="none" stroke="var(--color-brand-primary)" strokeWidth="3" strokeLinecap="round" />
                  {points.map(({ x, y, d }) => (
                    <g key={d.year}>
                      <circle cx={x} cy={y} r="5" fill="var(--color-surface-elevated)" stroke="var(--color-brand-primary)" strokeWidth="3" />
                      <text x={x} y={y - 12} fontSize="12" fontWeight="700" fill="var(--color-brand-primary)" textAnchor="middle">
                        {d.turnout}%
                      </text>
                      <text x={x} y="214" fontSize="11" fontWeight="600" fill="var(--color-text-primary)" textAnchor="middle">
                        {d.year}
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
      )}

      <p className="civic-metric-card__footnote">
        Fuente: Cómputos Distritales e Informes CCPC del INE. La línea más alta corresponde a las presidenciales (2012, 2018, 2024).
      </p>
    </div>
  );
}
