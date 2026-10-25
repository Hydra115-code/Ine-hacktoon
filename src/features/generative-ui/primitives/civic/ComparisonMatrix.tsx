import type { ComparisonMatrixNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatCivicValue, isDataRecord, readCivicLabel, readCivicNumber } from "./civic-data";
import { cleanGeneratedCopy } from "../content/clean-generated-copy";

interface ComparisonMatrixProps {
  data?: DataValue[];
  locale?: string;
  spec: ComparisonMatrixNode;
}

export function ComparisonMatrix({ data, locale = "es-MX", spec }: ComparisonMatrixProps) {
  const entries = (data ?? []).flatMap((item) => {
    if (!isDataRecord(item)) return [];
    const row = readCivicLabel(item, spec.rowField);
    const column = readCivicLabel(item, spec.columnField);
    const value = readCivicNumber(item, spec.valueField);
    return row !== undefined && column !== undefined && value !== undefined ? [{ row, column, value }] : [];
  });
  const allColumns = [...new Set(entries.map((entry) => entry.column))];
  const columns = allColumns.slice(0, spec.maximumColumns ?? 6);
  const rows = [...new Set(entries.map((entry) => entry.row))];
  const valueMap = new Map(entries.map((entry) => [`${entry.row}\u0000${entry.column}`, entry.value]));
  const omittedEntries = (data?.length ?? 0) - entries.length;

  if (rows.length === 0 || columns.length === 0) {
    return <div className="ui-civic-state" role="status">No hay comparaciones suficientes para construir la matriz.</div>;
  }

  return (
    <section aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-comparison-matrix">
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Cruce comparativo</span>
        <h3>{cleanGeneratedCopy(spec.title)}</h3>
        {spec.valueLabel ? <p>{cleanGeneratedCopy(spec.valueLabel)}</p> : null}
      </header>
      <div className="ui-comparison-matrix__scroller" tabIndex={0}>
        <table>
          <caption className="sr-only">{cleanGeneratedCopy(spec.ariaLabel)}</caption>
          <thead>
            <tr><th scope="col">Territorio</th>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th scope="row">{row}</th>
                {columns.map((column) => {
                  const value = valueMap.get(`${row}\u0000${column}`);
                  return <td key={column}>{formatCivicValue(value, spec.format, spec.unit, locale)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allColumns.length > columns.length ? <p className="ui-civic-component__notice">Se muestran {columns.length} de {allColumns.length} columnas para conservar legibilidad.</p> : null}
      {omittedEntries > 0 ? <p className="ui-civic-component__notice">Algunos grupos no tienen todos los datos y no aparecen en esta comparación.</p> : null}
    </section>
  );
}
