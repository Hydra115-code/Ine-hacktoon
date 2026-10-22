import { z } from "zod";
import { CCPC_AGE_GROUPS, CCPC_SECTION_TYPES, CCPC_SEXES, CCPC_YEARS } from "../../application/ports/civic-data.js";
import { ENTITIES } from "../../domain/civic-entities.js";
import { logger } from "../../config/logger.js";
import { BREAKDOWN_DIMENSIONS } from "../../schemas/civic.schema.js";
import {
  CIVIC_ANALYSES,
  CIVIC_INDICATORS,
  CIVIC_PRESENTATIONS,
  CivicPlanSchema,
  type CivicPlan,
} from "./civic-plan.js";
import { type CivicQueryInterpreter } from "./civic-query-interpreter.js";

export interface LocalModelConfig {
  url: string;
  model: string;
  timeoutMs: number;
}

const ChatCompletionSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().min(1).max(8_000) }),
  })).min(1),
});

export class LocalModelQueryInterpreter implements CivicQueryInterpreter {
  constructor(
    private readonly config: LocalModelConfig,
    private readonly fallback: CivicQueryInterpreter,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async interpret(query: string, signal?: AbortSignal): Promise<CivicPlan> {
    try {
      return await this.requestPlan(query, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      logger.warn("Modelo local no disponible; se usa el planificador por reglas", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return this.fallback.interpret(query, signal);
    }
  }

  private async requestPlan(query: string, signal?: AbortSignal): Promise<CivicPlan> {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Tiempo de espera agotado")), this.config.timeoutMs);
    try {
      return await this.fetchPlan(query, controller.signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  private async fetchPlan(query: string, signal: AbortSignal): Promise<CivicPlan> {
    const response = await this.fetchImplementation(new URL("/v1/chat/completions", this.config.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: LOCAL_PLANNER_PROMPT },
          { role: "user", content: query.slice(0, 4_000) },
        ],
      }),
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const completion = ChatCompletionSchema.parse(await response.json());
    return CivicPlanSchema.parse(JSON.parse(completion.choices[0]!.message.content));
  }
}

const LOCAL_PLANNER_PROMPT = [
  "Convierte la pregunta sobre participación electoral en México en un JSON con exactamente estas claves:",
  `analysis (${CIVIC_ANALYSES.join("|")}), indicator (${CIVIC_INDICATORS.join("|")}),`,
  `years (sólo ${CCPC_YEARS.join(", ")}), entityCodes (claves INE de 2 dígitos), sexes (${CCPC_SEXES.join("|")}),`,
  `ageGroups (${CCPC_AGE_GROUPS.join("|")}), sectionTypes (${CCPC_SECTION_TYPES.join("|")}),`,
  `breakdown opcional (${BREAKDOWN_DIMENSIONS.join("|")}), presentation (${CIVIC_PRESENTATIONS.join("|")}) y clarification opcional.`,
  "Usa listas vacías cuando la pregunta no mencione un filtro. Nunca inventes años, entidades ni filtros.",
  "Si la pregunta usa un año sin conteo o es ambigua, escribe una pregunta corta en clarification.",
  `Claves: ${ENTITIES.map((entity) => `${entity.code}=${entity.name}`).join(", ")}.`,
  "Responde sólo el JSON.",
].join(" ");
