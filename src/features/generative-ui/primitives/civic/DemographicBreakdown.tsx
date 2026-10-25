import type { DemographicBreakdownNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatCivicValue, isDataRecord, readCivicLabel, readCivicNumber } from "./civic-data";
import { cleanGeneratedCopy } from "../content/clean-generated-copy";

interface DemographicBreakdownProps {
  data?: DataValue[];
  locale?: string;
  spec: DemographicBreakdownNode;
}

export function DemographicBreakdown({ data, locale = "es-MX", spec }: DemographicBreakdownProps) {
  const rows = (data ?? []).flatMap((item, sourceIndex) => {
    if (!isDataRecord(item)) return [];
    const segment = readCivicLabel(item, spec.segmentField);
    const value = readCivicNumber(item, spec.valueField);
    return segment !== undefined && value !== undefined ? [{ segment, value, sourceIndex }] : [];
  });
  const order = spec.order ?? "source";
  const visibleRows = order === "source" ? rows : [...rows].sort((a, b) => (
    order === "ascending" ? a.value - b.value : b.value - a.value
  ));

  if (visibleRows.length === 0) {
    return <div className="ui-civic-state" role="status">No hay segmentos demográficos disponibles.</div>;
  }

  const maxValue = Math.max(...visibleRows.map((row) => Math.abs(row.value)), 1);

  return (
    <section aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-demographic-breakdown">
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Lectura por segmento</span>
        <h3>{cleanGeneratedCopy(spec.title)}</h3>
        {spec.valueLabel ? <p>{cleanGeneratedCopy(spec.valueLabel)}</p> : null}
      </header>
      <ul className="ui-demographic-breakdown__list">
        {visibleRows.map((row) => (
          <li key={`${row.segment}-${row.sourceIndex}`}>
            <div>
              <span>{row.segment}</span>
              <strong>{formatCivicValue(row.value, spec.format, spec.unit, locale)}</strong>
            </div>
            <span aria-hidden="true" className="ui-demographic-breakdown__track">
              <span style={{ inlineSize: `${Math.max(4, Math.abs(row.value) / maxValue * 100)}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {rows.length < (data?.length ?? 0) ? <p className="ui-civic-component__notice">Algunos grupos no tenían información suficiente y no aparecen aquí.</p> : null}
    </section>
  );
}
