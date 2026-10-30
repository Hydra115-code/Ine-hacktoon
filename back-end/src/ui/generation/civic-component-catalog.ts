export const CIVIC_COMPONENT_TYPES = [
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

export type CivicComponentType = typeof CIVIC_COMPONENT_TYPES[number];

/** Exact public node surface rendered by the integrated frontend runtime. */
export const FRONTEND_RUNTIME_NODE_TYPES = [
  "container", "section", "stack", "grid", "flex", "split", "scrollable", "divider", "tabs", "accordion",
  "text", "heading", "metric", "badge", "alert", "progress", "icon", "list",
  ...CIVIC_COMPONENT_TYPES,
  "visualization", "table",
  "button", "input", "numberInput", "select", "multiSelect", "slider", "datePicker", "dateRange", "checkbox", "switch", "radioGroup",
  "repeat", "conditional",
] as const;

export type CivicComponentRole = "primary" | "supporting" | "context";

export interface CivicComponentCapability {
  type: CivicComponentType;
  role: CivicComponentRole;
  purpose: string;
  requires: readonly string[];
}

/**
 * Canonical list of the civic components implemented by the shared frontend
 * runtime. The backend planner only selects a component when its required
 * fields can be built from an authorised MCP result.
 */
export const CIVIC_COMPONENT_CATALOG: Readonly<Record<CivicComponentType, CivicComponentCapability>> = {
  electionDelta: {
    type: "electionDelta",
    role: "primary",
    purpose: "Compare two elections and expose the change in percentage points.",
    requires: ["elections.year", "elections.participationPct"],
  },
  territoryRanking: {
    type: "territoryRanking",
    role: "primary",
    purpose: "Order territories by an observed participation indicator.",
    requires: ["groups.group", "groups.participationPct"],
  },
  participationTimeline: {
    type: "participationTimeline",
    role: "primary",
    purpose: "Show participation across three or more elections.",
    requires: ["elections.year", "elections.participationPct"],
  },
  dataQualityBadge: {
    type: "dataQualityBadge",
    role: "context",
    purpose: "Disclose source coverage, freshness and sample status.",
    requires: ["quality.status"],
  },
  demographicBreakdown: {
    type: "demographicBreakdown",
    role: "primary",
    purpose: "Compare participation between demographic or section segments.",
    requires: ["groups.group", "groups.participationPct"],
  },
  comparisonMatrix: {
    type: "comparisonMatrix",
    role: "primary",
    purpose: "Cross a row dimension with elections or demographic columns.",
    requires: ["row", "column", "value"],
  },
  evidenceSummary: {
    type: "evidenceSummary",
    role: "primary",
    purpose: "Show the numerator, denominator and resulting participation rate.",
    requires: ["totals.voted", "totals.classified", "totals.participationPct"],
  },
  civicInsight: {
    type: "civicInsight",
    role: "supporting",
    purpose: "Explain a grounded finding in citizen-facing language.",
    requires: ["title", "explanation", "source"],
  },
  mexicoChoropleth: {
    type: "mexicoChoropleth",
    role: "primary",
    purpose: "Locate an observed indicator across Mexican states.",
    requires: ["groups.value", "groups.group", "groups.participationPct"],
  },
};

export const CIVIC_COMPOSITION_RECIPES = {
  ranking: ["territoryRanking", "dataQualityBadge"],
  timeline: ["participationTimeline", "dataQualityBadge"],
  // The age-by-sex view uses a grouped generic visualization because it needs
  // two simultaneous series; the single-series civic breakdown would hide one.
  "age-sex": ["dataQualityBadge"],
  "two-elections": ["electionDelta", "dataQualityBadge"],
  methodology: [],
  "insufficient-data": ["dataQualityBadge"],
  summary: ["evidenceSummary", "dataQualityBadge"],
  "group-comparison": ["demographicBreakdown", "dataQualityBadge"],
  evidence: ["dataQualityBadge"],
} as const satisfies Readonly<Record<string, readonly CivicComponentType[]>>;

export interface CivicComponentPlanInput {
  composition: keyof typeof CIVIC_COMPOSITION_RECIPES;
  presentation: readonly string[];
  forbidCharts?: boolean;
}

export function planCivicComponents(input: CivicComponentPlanInput): CivicComponentType[] {
  const selected = [...CIVIC_COMPOSITION_RECIPES[input.composition]] as CivicComponentType[];
  if (input.presentation.includes("map") && input.composition === "ranking" && !input.forbidCharts) {
    selected.unshift("mexicoChoropleth");
  }
  if (input.presentation.includes("matrix") && MATRIX_COMPATIBLE_COMPOSITIONS.has(input.composition)) {
    selected.unshift("comparisonMatrix");
  }
  if (input.presentation.includes("story")) selected.push("civicInsight");
  return [...new Set(selected)];
}

const MATRIX_COMPATIBLE_COMPOSITIONS = new Set<CivicComponentPlanInput["composition"]>([
  "ranking", "timeline", "age-sex", "two-elections", "group-comparison",
]);

export function supportsCivicComponent(type: string): type is CivicComponentType {
  return Object.hasOwn(CIVIC_COMPONENT_CATALOG, type);
}
