import type { ElectionDeltaNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatCivicValue, isDataRecord, readCivicLabel, readCivicNumber } from "./civic-data";
import { cleanGeneratedCopy } from "../content/clean-generated-copy";

interface ElectionDeltaProps {
  data?: DataValue;
  locale?: string;
  spec: ElectionDeltaNode;
}

export function ElectionDelta({ data, locale = "es-MX", spec }: ElectionDeltaProps) {
  if (!isDataRecord(data)) {
    return <div className="ui-civic-state" role="status">No hay datos comparables disponibles.</div>;
  }

  const previousLabel = readCivicLabel(data, spec.previousLabelField) ?? "Periodo anterior";
  const currentLabel = readCivicLabel(data, spec.currentLabelField) ?? "Periodo actual";
  const previousValue = readCivicNumber(data, spec.previousValueField);
  const currentValue = readCivicNumber(data, spec.currentValueField);
  const suppliedDifference = spec.differenceField ? readCivicNumber(data, spec.differenceField) : undefined;
  const difference = suppliedDifference ?? (
    previousValue !== undefined && currentValue !== undefined ? currentValue - previousValue : undefined
  );
  const direction = difference === undefined || difference === 0 ? "neutral" : difference > 0 ? "increase" : "decrease";
  const isPartial = previousValue === undefined || currentValue === undefined;

  return (
    <article aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-election-delta" data-direction={direction}>
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Comparación electoral</span>
        <h3>{cleanGeneratedCopy(spec.title)}</h3>
      </header>
      <div className="ui-election-delta__periods">
        <div>
          <span>{previousLabel}</span>
          <strong>{formatCivicValue(previousValue, spec.format, spec.unit, locale)}</strong>
        </div>
        <span aria-hidden="true" className="ui-election-delta__arrow">→</span>
        <div>
          <span>{currentLabel}</span>
          <strong>{formatCivicValue(currentValue, spec.format, spec.unit, locale)}</strong>
        </div>
      </div>
      <footer className="ui-election-delta__result">
        <span>{direction === "increase" ? "Aumentó" : direction === "decrease" ? "Disminuyó" : "Sin cambio"}</span>
        <strong>{difference !== undefined && difference > 0 ? "+" : ""}{formatCivicValue(difference, "number", spec.differenceUnit ?? spec.unit, locale)}</strong>
      </footer>
      {isPartial ? <p className="ui-civic-component__notice">Falta el dato de uno de los periodos, así que no puedo completar la comparación.</p> : null}
    </article>
  );
}
