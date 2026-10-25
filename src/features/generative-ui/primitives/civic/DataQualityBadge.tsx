import type { DataQualityBadgeNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { isDataRecord, readCivicField, readCivicLabel } from "./civic-data";
import { cleanGeneratedCopy } from "../content/clean-generated-copy";

interface DataQualityBadgeProps {
  data?: DataValue;
  locale?: string;
  spec: DataQualityBadgeNode;
}

const statusCopy: Readonly<Record<string, { label: string; tone: "complete" | "sample" | "partial" | "unknown" }>> = {
  complete: { label: "Cobertura completa", tone: "complete" },
  completed: { label: "Cobertura completa", tone: "complete" },
  full: { label: "Cobertura completa", tone: "complete" },
  official: { label: "Fuente oficial", tone: "complete" },
  sample: { label: "Muestra de datos", tone: "sample" },
  simulated: { label: "Datos de demostración", tone: "sample" },
  partial: { label: "Cobertura parcial", tone: "partial" },
  preliminary: { label: "Dato preliminar", tone: "partial" },
};

export function DataQualityBadge({ data, locale = "es-MX", spec }: DataQualityBadgeProps) {
  if (!isDataRecord(data)) {
    return <div className="ui-civic-state" role="status">La cobertura del dato no está disponible.</div>;
  }

  const statusValue = readCivicLabel(data, spec.statusField)?.toLocaleLowerCase("es-MX") ?? "unknown";
  const mappedStatus = statusCopy[statusValue] ?? { label: "Cobertura por confirmar", tone: "unknown" as const };
  const customLabel = spec.labelField ? readCivicLabel(data, spec.labelField) : undefined;
  const recordCount = spec.recordCountField ? readCivicField(data, spec.recordCountField) : undefined;
  const updatedAt = spec.updatedAtField ? readCivicLabel(data, spec.updatedAtField) : undefined;
  const formattedCount = typeof recordCount === "number"
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(recordCount)
    : undefined;

  return (
    <aside aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-data-quality" data-tone={mappedStatus.tone}>
      <span aria-hidden="true" className="ui-data-quality__signal" />
      <div>
        <span className="ui-data-quality__title">{cleanGeneratedCopy(spec.title ?? "Calidad del dato")}</span>
        <strong>{cleanGeneratedCopy(customLabel ?? mappedStatus.label)}</strong>
      </div>
      <div className="ui-data-quality__meta">
        {formattedCount ? <span>{formattedCount} registros</span> : null}
        {updatedAt ? <span>Actualizado: {updatedAt}</span> : null}
      </div>
    </aside>
  );
}
