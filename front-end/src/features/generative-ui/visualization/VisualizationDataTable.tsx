import { readDataField } from "../data-binding/resolver/read-data-field";
import type { DataValue } from "../data-binding/schemas/data-registry-schema";
import type { VisualizationNode } from "../schemas/visualization-node";
import type { VisualizationDataRow } from "./VisualizationCompiler";
import { maskSensitiveIdentifier } from "../data-binding/formatting/mask-sensitive-identifier";
import { formatDataValue, inferDataDisplayFormat, localizeDisplayValue, type DataDisplayFormat } from "../data-binding/formatting/format-data-value";
import { cleanGeneratedCopy } from "../primitives/content/clean-generated-copy";

interface VisualizationDataTableProps {
  rows: VisualizationDataRow[];
  spec: VisualizationNode;
}

interface AccessibleColumn {
  field: string;
  label: string;
  format?: DataDisplayFormat;
}

const MAX_ACCESSIBLE_ROWS = 100;

function getAccessibleColumns(spec: VisualizationNode): AccessibleColumn[] {
  const columns = new Map<string, AccessibleColumn>();

  Object.values(spec.encoding).forEach((channel) => {
    if (!channel || columns.has(channel.field)) return;
    columns.set(channel.field, {
      field: channel.field,
      label: cleanGeneratedCopy(channel.label ?? channel.field),
      ...(inferDataDisplayFormat(channel.format, channel.field, channel.label) ? {
        format: inferDataDisplayFormat(channel.format, channel.field, channel.label),
      } : {}),
    });
  });

  return [...columns.values()];
}

function formatAccessibleValue(value: DataValue | undefined, column: AccessibleColumn, row: VisualizationDataRow) {
  if (value === null || value === undefined) return "Sin dato";
  const masked = maskSensitiveIdentifier(column.field, value);
  if (masked) return masked;
  if (column.format) {
    const currency = typeof row.currency === "string" && /^[A-Z]{3}$/u.test(row.currency) ? row.currency : "MXN";
    return formatDataValue(value, column.format, { locale: "es-MX", currency }) ?? "Sin dato";
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") return localizeDisplayValue(value);
  return "Dato no textual";
}

function accessibleCellAlignment(column: AccessibleColumn) {
  return column.format === "number" || column.format === "percent" || column.format === "percentage" || column.format === "currency"
    ? "ui-visualization__data-cell--numeric"
    : "ui-visualization__data-cell--text";
}

export function VisualizationDataTable({ rows, spec }: VisualizationDataTableProps) {
  const columns = getAccessibleColumns(spec);
  const visibleRows = rows.slice(0, MAX_ACCESSIBLE_ROWS);
  const accessibleTitle = cleanGeneratedCopy(spec.ariaLabel);

  return (
    <details className="ui-visualization__data">
      <summary>Consultar datos de la gráfica</summary>
      <div
        aria-label={`Datos de ${accessibleTitle}`}
        className="ui-visualization__data-viewport"
        role="region"
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">Datos utilizados para {accessibleTitle}</caption>
          <thead>
            <tr>{columns.map((column) => <th className={accessibleCellAlignment(column)} key={column.field} scope="col">{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td className={accessibleCellAlignment(column)} key={column.field}>{formatAccessibleValue(readDataField(row, column.field), column, row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ACCESSIBLE_ROWS ? (
        <p>Se muestran los primeros {MAX_ACCESSIBLE_ROWS} de {rows.length} registros.</p>
      ) : null}
    </details>
  );
}
