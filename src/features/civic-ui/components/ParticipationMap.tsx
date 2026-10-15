"use client";

import { useState } from "react";
import { STATE_TURNOUT_DATA, type StateTurnout } from "../civic-data-fixtures";

interface ParticipationMapProps {
  onSelectState?: (state: StateTurnout) => void;
  selectedStateCode?: string;
}

export function ParticipationMap({
  onSelectState,
  selectedStateCode = "CDMX",
}: ParticipationMapProps) {
  const [filterRegion, setFilterRegion] = useState<string>("Todos");

  const regions = ["Todos", "Norte", "Centro", "Sur", "Occidente"];

  const filtered = filterRegion === "Todos"
    ? STATE_TURNOUT_DATA
    : STATE_TURNOUT_DATA.filter((s) => s.region === filterRegion);

  const getColorClass = (turnout: number) => {
    if (turnout >= 68) return "var(--color-data-5)";
    if (turnout >= 64) return "var(--color-data-4)";
    if (turnout >= 60) return "var(--color-data-3)";
    if (turnout >= 55) return "var(--color-data-2)";
    return "var(--color-data-1)";
  };

  return (
    <div className="civic-metric-card" role="region" aria-label="Mapa territorial de participación">
      <header className="civic-metric-card__header">
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-family-display)" }}>
            Mapa y territorio: Convocatoria por entidad
          </h3>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
            Elección Federal 2024 · Selecciona un estado para ver su detalle
          </p>
        </div>

        {/* Filtros regionales */}
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
          {regions.map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => setFilterRegion(reg)}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-subtle)",
                background: filterRegion === reg ? "var(--color-brand-primary)" : "var(--color-surface-secondary)",
                color: filterRegion === reg ? "var(--color-text-on-brand)" : "var(--color-text-primary)",
                cursor: "pointer",
              }}
            >
              {reg}
            </button>
          ))}
        </div>
      </header>

      {/* Grid territorial */}
      <div className="civic-territorial-grid" style={{ marginTop: "var(--space-3)" }}>
        {filtered.map((item) => {
          const isSelected = item.code === selectedStateCode;
          return (
            <button
              key={item.code}
              type="button"
              className="civic-territorial-tile"
              data-selected={isSelected}
              onClick={() => onSelectState?.(item)}
              style={{
                borderLeft: `4px solid ${getColorClass(item.turnout2024)}`,
              }}
            >
              <span className="civic-territorial-tile__name">
                {item.name}
              </span>
              <span className="civic-territorial-tile__pct">{item.turnout2024}%</span>
              <small style={{ fontSize: "0.7rem", color: item.delta >= 0 ? "var(--color-data-positive)" : "var(--color-data-negative)" }}>
                {item.delta >= 0 ? "+" : ""}{item.delta}% vs 2018
              </small>
            </button>
          );
        })}
      </div>

      {/* Escala de colores */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
        <span>Menor &lt;50%</span>
        <div style={{ display: "flex", height: 8, width: 120, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ flex: 1, background: "var(--color-data-1)" }} />
          <div style={{ flex: 1, background: "var(--color-data-2)" }} />
          <div style={{ flex: 1, background: "var(--color-data-3)" }} />
          <div style={{ flex: 1, background: "var(--color-data-4)" }} />
          <div style={{ flex: 1, background: "var(--color-data-5)" }} />
        </div>
        <span>Mayor &gt;70%</span>
      </div>
    </div>
  );
}
