"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ELECTION_HISTORY, type ElectionTurnout } from "../civic-data-fixtures";

interface ElectionTimelineProps {
  onSelectYear?: (election: ElectionTurnout) => void;
  selectedYear?: number;
}

export function ElectionTimeline({
  onSelectYear,
  selectedYear: controlledYear,
}: ElectionTimelineProps) {
  const [internalYear, setInternalYear] = useState<number>(2024);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeYear = controlledYear ?? internalYear;

  const handleSelect = (item: ElectionTurnout) => {
    setInternalYear(item.year);
    onSelectYear?.(item);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = ELECTION_HISTORY.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowRight"
          ? (index + 1) % ELECTION_HISTORY.length
          : (index - 1 + ELECTION_HISTORY.length) % ELECTION_HISTORY.length;
    handleSelect(ELECTION_HISTORY[nextIndex]);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h4 style={{ margin: 0, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
          Línea de tiempo electoral (2009–2024)
        </h4>
        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Selecciona un año</span>
      </div>

      <div className="civic-timeline" role="radiogroup" aria-label="Año de elección federal">
        {ELECTION_HISTORY.map((item, index) => {
          const isSelected = item.year === activeYear;
          return (
            <button
              key={item.year}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              ref={(node) => { buttonRefs.current[index] = node; }}
              className="civic-timeline-node"
              data-selected={isSelected}
              onClick={() => handleSelect(item)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="civic-timeline-node__badge">{item.type}</span>
              <div className="civic-timeline-node__year">
                {item.year}
              </div>
              <div className="civic-timeline-node__turnout">{item.turnout}%</div>
              <small style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                {item.totalVotes}M votos
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
