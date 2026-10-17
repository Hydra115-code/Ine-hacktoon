import type { TerritoryRankingNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatCivicValue, isDataRecord, readCivicLabel, readCivicNumber } from "./civic-data";

interface TerritoryRankingProps {
  data?: DataValue[];
  locale?: string;
  spec: TerritoryRankingNode;
}

export function TerritoryRanking({ data, locale = "es-MX", spec }: TerritoryRankingProps) {
  const rows = (data ?? []).flatMap((item) => {
    if (!isDataRecord(item)) return [];
    const territory = readCivicLabel(item, spec.territoryField);
    const value = readCivicNumber(item, spec.valueField);
    return territory !== undefined && value !== undefined ? [{ territory, value }] : [];
  });
  const direction = spec.order ?? "descending";
  const visibleRows = [...rows]
    .sort((a, b) => direction === "ascending" ? a.value - b.value : b.value - a.value)
    .slice(0, spec.limit ?? 8);

  if (visibleRows.length === 0) {
    return <div className="ui-civic-state" role="status">No hay territorios disponibles para ordenar.</div>;
  }

  const maxValue = Math.max(...visibleRows.map((row) => Math.abs(row.value)), 1);
  const discardedRows = (data?.length ?? 0) - rows.length;

  return (
    <section aria-label={spec.ariaLabel} className="ui-territory-ranking">
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Ranking territorial</span>
        <h3>{spec.title}</h3>
        {spec.valueLabel ? <p>{spec.valueLabel}</p> : null}
      </header>
      <ol className="ui-territory-ranking__list">
        {visibleRows.map((row, index) => (
          <li key={`${row.territory}-${index}`}>
            <span className="ui-territory-ranking__position">{index + 1}</span>
            <span className="ui-territory-ranking__territory">{row.territory}</span>
            <span aria-hidden="true" className="ui-territory-ranking__track">
              <span style={{ inlineSize: `${Math.max(5, Math.abs(row.value) / maxValue * 100)}%` }} />
            </span>
            <strong>{formatCivicValue(row.value, spec.format, spec.unit, locale)}</strong>
          </li>
        ))}
      </ol>
      {discardedRows > 0 ? <p className="ui-civic-component__notice">Se omitieron {discardedRows} registros incompletos.</p> : null}
    </section>
  );
}
