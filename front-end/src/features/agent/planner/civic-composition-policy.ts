export const civicComponentTypes = [
  "electionDelta",
  "territoryRanking",
  "participationTimeline",
  "dataQualityBadge",
  "demographicBreakdown",
  "comparisonMatrix",
  "evidenceSummary",
  "civicInsight",
  "mexicoChoropleth",
] as const;

export type CivicComponentType = typeof civicComponentTypes[number];
export type CivicCompositionIntent = "change" | "territory" | "geography" | "trend" | "demographic" | "evidence" | "overview";

export interface CivicCompositionPlan {
  intent: CivicCompositionIntent;
  primary: CivicComponentType;
  supporting: CivicComponentType[];
  excluded: CivicComponentType[];
  presentation: "focused" | "table-only" | "without-chart";
  rationale: string;
}

export const CIVIC_COMPOSITION_RECIPES: Record<CivicCompositionIntent, {
  primary: CivicComponentType;
  supporting: CivicComponentType[];
  rationale: string;
}> = {
  change: {
    primary: "electionDelta",
    supporting: ["evidenceSummary", "civicInsight"],
    rationale: "Compara dos cortes y conserva el cálculo que respalda la diferencia.",
  },
  territory: {
    primary: "territoryRanking",
    supporting: ["comparisonMatrix", "civicInsight"],
    rationale: "Prioriza el orden territorial y mantiene el cruce verificable.",
  },
  geography: {
    primary: "mexicoChoropleth",
    supporting: ["territoryRanking", "dataQualityBadge"],
    rationale: "Sitúa el indicador en las 32 entidades y conserva orden y cobertura como apoyo verificable.",
  },
  trend: {
    primary: "participationTimeline",
    supporting: ["comparisonMatrix", "civicInsight"],
    rationale: "Muestra la secuencia temporal y una alternativa tabular accesible.",
  },
  demographic: {
    primary: "demographicBreakdown",
    supporting: ["evidenceSummary", "civicInsight"],
    rationale: "Explica diferencias entre segmentos sin perder el universo observado.",
  },
  evidence: {
    primary: "evidenceSummary",
    supporting: ["comparisonMatrix", "dataQualityBadge"],
    rationale: "Hace visible el cálculo, sus registros comparables y la calidad de la fuente.",
  },
  overview: {
    primary: "civicInsight",
    supporting: ["electionDelta", "dataQualityBadge"],
    rationale: "Resume el hallazgo y ofrece una comparación concreta con contexto de calidad.",
  },
};

const intentPatterns: Array<{ intent: Exclude<CivicCompositionIntent, "overview">; patterns: RegExp[] }> = [
  { intent: "demographic", patterns: [/edad/u, /grupo/u, /segment/u, /j[oó]ven/u, /generaci/u] },
  { intent: "geography", patterns: [/mapa/u, /geograf/u, /colorea/u, /territorialmente/u] },
  { intent: "territory", patterns: [/territor/u, /entidad/u, /estado/u, /d[oó]nde/u, /ranking/u, /mayor/u, /menor/u] },
  { intent: "trend", patterns: [/evoluci/u, /tendencia/u, /hist[oó]ric/u, /a trav[eé]s/u, /serie/u] },
  { intent: "evidence", patterns: [/evidencia/u, /fuente/u, /metodolog/u, /c[aá]lculo/u, /numerador/u, /denominador/u, /respalda/u, /sustenta/u] },
  { intent: "change", patterns: [/cambi/u, /compar/u, /diferencia/u, /entre/u, /aument/u, /dismin/u] },
];

const chartLikeComponents = new Set<CivicComponentType>([
  "electionDelta",
  "territoryRanking",
  "participationTimeline",
  "demographicBreakdown",
  "mexicoChoropleth",
]);

function normalizeQuery(query: string) {
  return query.trim().toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/gu, "");
}

function inferIntent(query: string): CivicCompositionIntent {
  const scores = intentPatterns.map(({ intent, patterns }) => ({
    intent,
    score: patterns.reduce((score, pattern) => score + (pattern.test(query) ? 1 : 0), 0),
  }));
  const best = scores.sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.intent : "overview";
}

export function planCivicComposition(query: string): CivicCompositionPlan {
  const normalized = normalizeQuery(query);
  const asksOnlyTable = /(?:solo|solamente|unicamente).{0,20}(?:tabla|matriz)|(?:tabla|matriz).{0,20}(?:solo|solamente|unicamente)/u.test(normalized);
  const asksWithoutChart = /(?:quita|elimina|sin|no (?:quiero|muestres)).{0,20}(?:grafica|grafico|visualizacion)/u.test(normalized);
  const intent = inferIntent(normalized);
  const recipe = CIVIC_COMPOSITION_RECIPES[intent];

  if (asksOnlyTable) {
    return {
      intent,
      primary: "comparisonMatrix",
      supporting: [],
      excluded: civicComponentTypes.filter((component) => component !== "comparisonMatrix"),
      presentation: "table-only",
      rationale: "La solicitud explícita de una sola tabla tiene prioridad sobre la receta temática.",
    };
  }

  if (asksWithoutChart) {
    const selected = [recipe.primary, ...recipe.supporting].filter((component) => !chartLikeComponents.has(component));
    const fallback = selected.length > 0 ? selected : ["comparisonMatrix", "evidenceSummary"] as CivicComponentType[];
    return {
      intent,
      primary: fallback[0],
      supporting: fallback.slice(1, 3),
      excluded: [...chartLikeComponents],
      presentation: "without-chart",
      rationale: "Se conserva la evidencia en formatos no gráficos y se respeta la exclusión solicitada.",
    };
  }

  return {
    intent,
    primary: recipe.primary,
    supporting: recipe.supporting.slice(0, 2),
    excluded: [],
    presentation: "focused",
    rationale: recipe.rationale,
  };
}
