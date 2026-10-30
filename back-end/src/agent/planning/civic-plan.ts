import { z } from "zod";
import {
  CCPC_AGE_GROUPS,
  CCPC_SECTION_TYPES,
  CCPC_SEXES,
  CCPC_YEARS,
} from "../../application/ports/civic-data.js";
import { ENTITY_CODES } from "../../domain/civic-entities.js";
import { BREAKDOWN_DIMENSIONS } from "../../schemas/civic.schema.js";
import { type AgentToolCall } from "../schemas/agent.schema.js";

export const CIVIC_ANALYSES = ["summary", "comparison", "trend", "breakdown", "evidence", "methodology"] as const;
export const CIVIC_INDICATORS = ["participation", "nominal-participation", "abstention", "nominal-list"] as const;
export const CIVIC_PRESENTATIONS = ["map", "chart", "table", "ranking", "matrix", "story"] as const;
export const CIVIC_FOCUSES = ["maximum-change", "coverage"] as const;

export type CivicAnalysis = typeof CIVIC_ANALYSES[number];
export type CivicIndicator = typeof CIVIC_INDICATORS[number];
export type CivicPresentation = typeof CIVIC_PRESENTATIONS[number];

const YearSchema = z.number().int().refine(
  (year) => (CCPC_YEARS as readonly number[]).includes(year),
  "Año sin conteo censal de participación",
);

export const CivicPlanSchema = z.object({
  analysis: z.enum(CIVIC_ANALYSES),
  indicator: z.enum(CIVIC_INDICATORS),
  years: z.array(YearSchema).max(CCPC_YEARS.length),
  entityCodes: z.array(z.enum(ENTITY_CODES)).max(32),
  sexes: z.array(z.enum(CCPC_SEXES)).max(3),
  ageGroups: z.array(z.enum(CCPC_AGE_GROUPS)).max(CCPC_AGE_GROUPS.length),
  sectionTypes: z.array(z.enum(CCPC_SECTION_TYPES)).max(3),
  breakdown: z.enum(BREAKDOWN_DIMENSIONS).optional(),
  presentation: z.array(z.enum(CIVIC_PRESENTATIONS)).max(CIVIC_PRESENTATIONS.length),
  includeEvidence: z.boolean().optional(),
  focus: z.enum(CIVIC_FOCUSES).optional(),
  clarification: z.string().trim().min(1).max(400).optional(),
}).strict();

export type CivicPlan = z.infer<typeof CivicPlanSchema>;

export const SUMMARY_TOOL = "get_participation_summary";
export const COMPARE_TOOL = "compare_elections";
export const BREAKDOWN_TOOL = "get_participation_breakdown";
export const SUPPORTING_TOOL = "get_supporting_records";

export function planToolCalls(plan: CivicPlan): AgentToolCall[] {
  if (plan.clarification || plan.analysis === "methodology") return [];
  const filters = {
    ...(plan.entityCodes.length > 0 ? { entities: plan.entityCodes } : {}),
    ...(plan.sexes.length > 0 ? { sexes: plan.sexes } : {}),
    ...(plan.ageGroups.length > 0 ? { ageGroups: plan.ageGroups } : {}),
    ...(plan.sectionTypes.length > 0 ? { sectionTypes: plan.sectionTypes } : {}),
  };
  const year = plan.years[0];
  const singleYear = year === undefined ? {} : { year };

  let calls: AgentToolCall[];
  if (plan.analysis === "comparison" || plan.analysis === "trend") {
    const years = plan.years.length >= 2 ? plan.years : [...CCPC_YEARS];
    calls = [{ name: COMPARE_TOOL, arguments: { years, ...filters } }];
  } else if (plan.analysis === "breakdown" && plan.breakdown === "grupo_edad"
    && plan.sexes.includes("hombre") && plan.sexes.includes("mujer")) {
    calls = (["hombre", "mujer"] as const).map((sex) => ({
      name: BREAKDOWN_TOOL,
      arguments: { ...singleYear, dimension: "grupo_edad", ...filters, sexes: [sex] },
    }));
  } else if (plan.analysis === "breakdown") {
    calls = [{
      name: BREAKDOWN_TOOL,
      arguments: { ...singleYear, dimension: plan.breakdown ?? "entidad", ...filters },
    }];
  } else if (plan.analysis === "evidence") {
    calls = [{ name: SUPPORTING_TOOL, arguments: { ...singleYear, ...filters } }];
  } else {
    calls = [{ name: SUMMARY_TOOL, arguments: { ...singleYear, ...filters } }];
  }
  if (plan.includeEvidence && plan.analysis !== "evidence" && year !== undefined) {
    calls.push({ name: SUPPORTING_TOOL, arguments: { ...singleYear, ...filters } });
  }
  return calls;
}
