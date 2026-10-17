import type { EvidenceSummaryNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatCivicValue, isDataRecord, readCivicNumber } from "./civic-data";

interface EvidenceSummaryProps {
  data?: DataValue;
  locale?: string;
  spec: EvidenceSummaryNode;
}

export function EvidenceSummary({ data, locale = "es-MX", spec }: EvidenceSummaryProps) {
  if (!isDataRecord(data)) {
    return <div className="ui-civic-state" role="status">No hay evidencia cuantitativa disponible.</div>;
  }

  const numerator = readCivicNumber(data, spec.numeratorField);
  const denominator = readCivicNumber(data, spec.denominatorField);
  const suppliedResult = spec.resultField ? readCivicNumber(data, spec.resultField) : undefined;
  const result = suppliedResult ?? (
    numerator !== undefined && denominator !== undefined && denominator !== 0
      ? numerator / denominator * 100
      : undefined
  );
  const isPartial = numerator === undefined || denominator === undefined;

  return (
    <article aria-label={spec.ariaLabel} className="ui-evidence-summary">
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Evidencia verificable</span>
        <h3>{spec.title}</h3>
      </header>
      <div className="ui-evidence-summary__equation">
        <div><span>{spec.numeratorLabel ?? "Casos observados"}</span><strong>{formatCivicValue(numerator, "number", undefined, locale)}</strong></div>
        <span aria-hidden="true">÷</span>
        <div><span>{spec.denominatorLabel ?? "Universo analizado"}</span><strong>{formatCivicValue(denominator, "number", undefined, locale)}</strong></div>
        <span aria-hidden="true">=</span>
        <div className="ui-evidence-summary__result"><span>{spec.resultLabel ?? "Resultado"}</span><strong>{formatCivicValue(result, spec.format, spec.unit, locale)}</strong></div>
      </div>
      {isPartial ? <p className="ui-civic-component__notice">El cálculo es parcial porque falta el numerador o denominador.</p> : null}
    </article>
  );
}
