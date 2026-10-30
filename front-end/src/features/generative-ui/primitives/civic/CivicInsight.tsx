import type { CivicInsightNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { isDataRecord, readCivicLabel } from "./civic-data";
import { cleanGeneratedCopy } from "../content/clean-generated-copy";

interface CivicInsightProps {
  data?: DataValue;
  spec: CivicInsightNode;
}

export function CivicInsight({ data, spec }: CivicInsightProps) {
  if (!isDataRecord(data)) {
    return <div className="ui-civic-state" role="status">No hay un hallazgo ciudadano disponible.</div>;
  }

  const title = readCivicLabel(data, spec.titleField);
  const explanation = readCivicLabel(data, spec.explanationField);
  const statistic = spec.statisticField ? readCivicLabel(data, spec.statisticField) : undefined;
  const source = spec.sourceField ? readCivicLabel(data, spec.sourceField) : undefined;

  if (!title || !explanation) {
    return <div className="ui-civic-state" role="status">El hallazgo no tiene suficiente contexto para mostrarse.</div>;
  }

  return (
    <aside aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-civic-insight" data-tone={spec.tone ?? "neutral"}>
      <span className="ui-civic-insight__label">Lectura ciudadana</span>
      <div>
        <h3>{cleanGeneratedCopy(title)}</h3>
        <p>{cleanGeneratedCopy(explanation)}</p>
        {source ? <small>Fuente: {cleanGeneratedCopy(source)}</small> : null}
      </div>
      {statistic ? <strong className="ui-civic-insight__statistic">{statistic}</strong> : null}
    </aside>
  );
}
