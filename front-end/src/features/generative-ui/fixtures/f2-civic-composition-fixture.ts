import { dataRegistrySchema, uiSpecificationSchema, type UINode, type UISpecification } from "@ine/contracts";
import {
  planCivicComposition,
  type CivicComponentType,
  type CivicCompositionPlan,
} from "../../agent/planner/civic-composition-policy.ts";
import { f1CivicCatalogData } from "./f1-civic-catalog-fixture.ts";
import { f3MexicoMapRows } from "./f3-mexico-map-fixture.ts";

export const f2CompositionData = dataRegistrySchema.parse({ ...f1CivicCatalogData, mexicoMap: f3MexicoMapRows });

export const f2CompositionQuestions = [
  "¿Cómo cambió la participación entre 2009 y 2024?",
  "¿Dónde se observa mayor participación por entidad?",
  "¿Cómo evolucionó la participación a través del tiempo?",
  "¿Qué diferencias hay entre grupos de edad?",
  "¿De dónde sale el porcentaje y qué evidencia lo respalda?",
  "Muéstrame en un mapa cómo cambia la participación por entidad.",
  "Quita la gráfica y conserva la evidencia verificable.",
  "Déjame únicamente la tabla comparativa.",
] as const;

const civicNodeFactories: Record<CivicComponentType, () => UINode> = {
  electionDelta: () => ({
    type: "electionDelta", id: "f2-election-delta", ariaLabel: "Cambio de participación entre elecciones",
    title: "Cambio entre elecciones", dataBinding: "comparison", previousLabelField: "previousPeriod",
    currentLabelField: "currentPeriod", previousValueField: "previousValue", currentValueField: "currentValue",
    differenceField: "difference", format: "number", unit: "%",
  }),
  territoryRanking: () => ({
    type: "territoryRanking", id: "f2-territory-ranking", ariaLabel: "Participación ordenada por entidad",
    title: "Dónde se observa mayor participación", dataBinding: "territoryRanking", territoryField: "entity",
    valueField: "participation", order: "descending", limit: 5, format: "number", unit: "%",
  }),
  participationTimeline: () => ({
    type: "participationTimeline", id: "f2-participation-timeline", ariaLabel: "Evolución de la participación entre elecciones",
    title: "Participación a través del tiempo", dataBinding: "timeline", periodField: "election",
    valueField: "participation", valueLabel: "Recorre los periodos con las flechas del teclado", format: "number", unit: "%",
    selectionEvent: "timeline.period_selected",
  }),
  dataQualityBadge: () => ({
    type: "dataQualityBadge", id: "f2-data-quality", ariaLabel: "Cobertura de los datos usados",
    title: "Cobertura de la evidencia", dataBinding: "dataQuality", statusField: "status", labelField: "label",
    recordCountField: "recordCount", updatedAtField: "updatedAt",
  }),
  demographicBreakdown: () => ({
    type: "demographicBreakdown", id: "f2-demographic-breakdown", ariaLabel: "Participación por grupo de edad",
    title: "Cómo cambia por grupo de edad", dataBinding: "demographics", segmentField: "segment",
    valueField: "participation", order: "source", format: "number", unit: "%",
  }),
  comparisonMatrix: () => ({
    type: "comparisonMatrix", id: "f2-comparison-matrix", ariaLabel: "Matriz de participación por territorio y elección",
    title: "Territorios a través de tres elecciones", dataBinding: "comparisonMatrix", rowField: "territory",
    columnField: "election", valueField: "participation", maximumColumns: 4, format: "number", unit: "%",
  }),
  evidenceSummary: () => ({
    type: "evidenceSummary", id: "f2-evidence-summary", ariaLabel: "Cálculo verificable de participación",
    title: "De dónde sale el porcentaje", dataBinding: "evidence", numeratorField: "votesObserved",
    denominatorField: "nominalList", resultField: "participation", numeratorLabel: "Participaciones observadas",
    denominatorLabel: "Lista nominal", resultLabel: "Participación", format: "number", unit: "%",
  }),
  civicInsight: () => ({
    type: "civicInsight", id: "f2-civic-insight", ariaLabel: "Hallazgo ciudadano de la consulta",
    dataBinding: "insight", titleField: "title", explanationField: "explanation", statisticField: "statistic",
    sourceField: "source", tone: "highlight",
  }),
  mexicoChoropleth: () => ({
    type: "mexicoChoropleth", id: "f2-mexico-choropleth", ariaLabel: "Mapa de participación por entidad",
    title: "Participación en el territorio", dataBinding: "mexicoMap", entityCodeField: "entityCode",
    entityNameField: "entity", valueField: "participation", valueLabel: "Escenario sintético por entidad",
    numeratorField: "votesObserved", denominatorField: "nominalList", periodField: "period",
    format: "number", unit: "%", selectionEvent: "map.entity_selected",
  }),
};

export function composeF2CivicFixture(query: string): {
  plan: CivicCompositionPlan;
  specification: UISpecification;
} {
  const plan = planCivicComposition(query);
  const selected = [plan.primary, ...plan.supporting];
  const children: UINode[] = [
    { type: "heading", id: "f2-title", content: titleForIntent(plan.intent), level: 2, size: "title" },
    { type: "text", id: "f2-query", content: query, tone: "secondary" },
    ...selected.map((component) => civicNodeFactories[component]()),
  ];
  return {
    plan,
    specification: uiSpecificationSchema.parse({
      version: "1",
      root: {
        type: "section",
        id: "f2-composed-view",
        ariaLabel: "Vista cívica compuesta según la intención",
        surface: "primary",
        padding: "md",
        children,
      },
    }),
  };
}

function titleForIntent(intent: CivicCompositionPlan["intent"]) {
  if (intent === "change") return "Cambio entre periodos";
  if (intent === "territory") return "Contrastes territoriales";
  if (intent === "geography") return "La participación sobre el territorio";
  if (intent === "trend") return "Evolución de la participación";
  if (intent === "demographic") return "Participación entre grupos";
  if (intent === "evidence") return "Cómo se sostiene el resultado";
  return "Lectura ciudadana de los datos";
}
