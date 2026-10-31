"use client";

import { useId } from "react";
import { STATE_TURNOUT_DATA, type StateTurnout } from "../civic-data-fixtures";

interface ComparisonChartProps {
  data?: StateTurnout[];
  selectedCode?: string;
  onSelectState?: (code: string) => void;
  title?: string;
  maxItems?: number;
}

export function ComparisonChart({
  data = STATE_TURNOUT_DATA,
  selectedCode = "CDMX",
  onSelectState,
  title = "Comparación de participación por entidad (2024)",
  maxItems = 8,
}: ComparisonChartProps) {
  const chartId = useId();
  const ranked = [...data].sort((a, b) => b.turnout2024 - a.turnout2024);
  const selected = ranked.find((item) => item.code === selectedCode);
  const visible = ranked.slice(0, maxItems);
  const sorted = selected && !visible.some((item) => item.code === selected.code)
    ? [...visible.slice(0, Math.max(0, maxItems - 1)), selected]
    : visible;

  return (
    <div className="civic-metric-card" role="region" aria-labelledby={chartId}>
      <header className="civic-metric-card__header">
        <h3 id={chartId} style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-family-display)" }}>
          {title}
        </h3>
        <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Media nacional: 60.9%</span>
      </header>

      <div className="civic-bar-list" style={{ marginTop: "var(--space-3)" }}>
        {sorted.map((item) => {
          const isSelected = item.code === selectedCode;
          return (
            <button
              key={item.code}
              type="button"
              className="civic-bar-item civic-bar-item--interactive"
              onClick={() => onSelectState?.(item.code)}
              aria-pressed={isSelected}
              disabled={!onSelectState}
              style={{ background: isSelected ? "var(--color-brand-soft)" : "transparent" }}
            >
              <span className="civic-bar-label">
                {item.name}
              </span>
              <div className="civic-bar-track">
                <div
                  className={`civic-bar-fill ${isSelected ? "civic-bar-fill--highlight" : ""}`}
                  style={{ width: `${Math.min(100, (item.turnout2024 / 80) * 100)}%` }}
                />
              </div>
              <span className="civic-bar-val">{item.turnout2024}%</span>
            </button>
          );
        })}
      </div>

      <p className="civic-metric-card__footnote">
        Comparación de entidades disponibles para la elección federal de 2024.
      </p>
    </div>
  );
}
