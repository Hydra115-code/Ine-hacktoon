import { CCPC_AGE_GROUPS, CCPC_SECTION_TYPES, CCPC_SEXES, CCPC_YEARS } from "../../application/ports/civic-data.js";
import { logger } from "../../config/logger.js";
import { ENTITIES } from "../../domain/civic-entities.js";
import { BREAKDOWN_DIMENSIONS } from "../../schemas/civic.schema.js";
import { type GeminiApiClient } from "../model/gemini-api-client.js";
import { askGeminiText, geminiRequest, parseGeminiJson } from "../model/gemini-quick-request.js";
import { CIVIC_ANALYSES, CIVIC_FOCUSES, CIVIC_INDICATORS, CIVIC_PRESENTATIONS, type CivicPlan } from "./civic-plan.js";
import {
  CIVIC_GUIDANCE,
  readRequestContext,
  rulesQueryInterpreter,
  type CivicQueryInterpreter,
} from "./civic-query-interpreter.js";
import { groundedPlan } from "./local-model-interpreter.js";

export type GeminiPlanOutcome = "gemini" | "rules";

const MAX_TEXT_LENGTH = 600;

export class GeminiQueryInterpreter implements CivicQueryInterpreter {
  constructor(
    private readonly client: GeminiApiClient,
    private readonly timeoutMs: number,
    private readonly fallback: CivicQueryInterpreter = rulesQueryInterpreter,
    private readonly onOutcome?: (outcome: GeminiPlanOutcome) => void,
  ) {}

  async interpret(query: string, signal?: AbortSignal): Promise<CivicPlan> {
    const rules = await this.fallback.interpret(query, signal);
    const conversation = readRequestContext(query);
    const resolvedByRules = conversation.selectedValue !== undefined
      || !conversation.latest.trim()
      || (!rules.clarification && rules.analysis === "methodology")
      || (rules.clarification !== undefined && rules.clarification !== CIVIC_GUIDANCE);
    if (resolvedByRules) return this.useRules(rules);

    const previous = conversation.previous.at(-1)?.slice(0, MAX_TEXT_LENGTH);
    const latest = conversation.latest.slice(0, MAX_TEXT_LENGTH);
    try {
      const text = await askGeminiText(
        this.client,
        geminiRequest(PLANNER_INSTRUCTION, previous ? `Pregunta anterior: ${previous}\nPregunta actual: ${latest}` : latest, true),
        this.timeoutMs,
        signal,
      );
      const plan = groundedPlan(parseGeminiJson(text), [previous ?? "", latest].join("\n"));
      const dropsData = !rules.clarification && (Boolean(plan.clarification) || plan.analysis === "methodology");
      if (dropsData) return this.useRules(rules);
      this.onOutcome?.("gemini");
      return rules.clarification ? plan : withRuleFilters(plan, rules);
    } catch (error) {
      if (signal?.aborted) throw error;
      logger.warn("Gemini no planeó a tiempo; se usa el planificador por reglas", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return this.useRules(rules);
    }
  }

  private useRules(plan: CivicPlan): CivicPlan {
    this.onOutcome?.("rules");
    return plan;
  }
}

const FILTER_KEYS = ["years", "entityCodes", "sexes", "ageGroups", "sectionTypes"] as const;

function withRuleFilters(plan: CivicPlan, rules: CivicPlan): CivicPlan {
  const completed = { ...plan };
  for (const key of FILTER_KEYS) {
    if (completed[key].length === 0 && rules[key].length > 0) Object.assign(completed, { [key]: rules[key] });
  }
  return completed;
}

const PLANNER_INSTRUCTION = [
  "Convierte la pregunta sobre participación electoral federal en México en un JSON con estas claves:",
  `analysis (${CIVIC_ANALYSES.join("|")}), indicator (${CIVIC_INDICATORS.join("|")}),`,
  `years (sólo ${CCPC_YEARS.join(", ")}), entityCodes (claves INE de 2 dígitos), sexes (${CCPC_SEXES.join("|")}),`,
  `ageGroups (${CCPC_AGE_GROUPS.join("|")}), sectionTypes (${CCPC_SECTION_TYPES.join("|")}),`,
  `breakdown opcional (${BREAKDOWN_DIMENSIONS.join("|")}), presentation (${CIVIC_PRESENTATIONS.join("|")}),`,
  `includeEvidence opcional (true), focus opcional (${CIVIC_FOCUSES.join("|")}) y clarification opcional.`,
  "Listas vacías cuando no se menciona un filtro. Nunca inventes años, entidades ni filtros. Nacional = entityCodes vacío.",
  "summary = un territorio y un año; comparison = dos elecciones; trend = tres o más años o evolución;",
  "breakdown = por entidad, sexo, edad o tipo de sección, o ranking de estados; evidence = registros; methodology = cómo se calcula.",
  "Si hay pregunta anterior y la actual sólo cambia algo, conserva los filtros anteriores que no cambian.",
  "No recomiendes por quién votar, no predigas resultados ni pidas datos personales: en esos casos escribe clarification.",
  "Si la pregunta usa un año sin conteo o no es sobre participación electoral, escribe una pregunta corta en clarification.",
  `Claves: ${ENTITIES.map((entity) => `${entity.code}=${entity.name}`).join(", ")}.`,
  "Ejemplo: «¿Qué estado votó más en 2018?» → {\"analysis\":\"breakdown\",\"breakdown\":\"entidad\",\"indicator\":\"participation\",\"years\":[2018],\"entityCodes\":[],\"sexes\":[],\"ageGroups\":[],\"sectionTypes\":[],\"presentation\":[\"ranking\"]}.",
  "Responde sólo el JSON.",
].join(" ");
