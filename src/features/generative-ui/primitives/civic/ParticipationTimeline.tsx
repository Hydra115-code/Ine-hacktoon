"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ParticipationTimelineNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatCivicValue, isDataRecord, readCivicLabel, readCivicNumber } from "./civic-data";

interface ParticipationTimelineProps {
  data?: DataValue[];
  locale?: string;
  spec: ParticipationTimelineNode;
}

export function ParticipationTimeline({ data, locale = "es-MX", spec }: ParticipationTimelineProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const items = useMemo(() => (data ?? []).flatMap((item) => {
    if (!isDataRecord(item)) return [];
    const period = readCivicLabel(item, spec.periodField);
    const value = readCivicNumber(item, spec.valueField);
    return period !== undefined && value !== undefined ? [{ period, value }] : [];
  }).sort((a, b) => a.period.localeCompare(b.period, locale, { numeric: true })), [data, locale, spec.periodField, spec.valueField]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));

  if (items.length === 0) {
    return <div className="ui-civic-state" role="status">No hay periodos disponibles para construir la evolución.</div>;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowRight"
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
    setSelectedIndex(nextIndex);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <section aria-label={spec.ariaLabel} className="ui-participation-timeline">
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Evolución</span>
        <h3>{spec.title}</h3>
        {spec.valueLabel ? <p>{spec.valueLabel}</p> : null}
      </header>
      <div aria-label={spec.ariaLabel} className="ui-participation-timeline__rail" role="radiogroup">
        {items.map((item, index) => {
          const selected = index === safeIndex;
          return (
            <button
              aria-checked={selected}
              className="ui-participation-timeline__point"
              data-selected={selected || undefined}
              key={`${item.period}-${index}`}
              ref={(element) => { buttonRefs.current[index] = element; }}
              role="radio"
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => setSelectedIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span>{item.period}</span>
              <strong>{formatCivicValue(item.value, spec.format, spec.unit, locale)}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
