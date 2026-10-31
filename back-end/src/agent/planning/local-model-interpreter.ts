import { z } from "zod";
import { CCPC_AGE_GROUPS, CCPC_SECTION_TYPES, CCPC_SEXES, CCPC_YEARS } from "../../application/ports/civic-data.js";
import { ENTITIES } from "../../domain/civic-entities.js";
import { logger } from "../../config/logger.js";
import { BREAKDOWN_DIMENSIONS } from "../../schemas/civic.schema.js";
import {
  CIVIC_ANALYSES,
  CIVIC_FOCUSES,
  CIVIC_INDICATORS,
  CIVIC_PRESENTATIONS,
  CivicPlanSchema,
  type CivicPlan,
} from "./civic-plan.js";
import { readLatestRequest, type CivicQueryInterpreter } from "./civic-query-interpreter.js";

export interface LocalModelConfig {
  url: string;
  model: string;
  timeoutMs: number;
}

export type LocalModelOutcome = "model" | "fallback";

const ChatCompletionSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().min(1).max(8_000) }),
  })).min(1),
});

const RANGE_WORDS = /\b(?:desde|hasta|evoluci\p{L}*|hist[oó]ric\p{L}*|tendencia|todas las elecciones|cada elecci[oó]n|anterior|pasada|previa|[uú]ltima|reciente)\b|\bde\s+\d{4}\s+a\s+\d{4}\b/iu;

export class LocalModelQueryInterpreter implements CivicQueryInterpreter {
  constructor(
    private readonly config: LocalModelConfig,
    private readonly fallback: CivicQueryInterpreter,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly onOutcome?: (outcome: LocalModelOutcome) => void,
  ) {}

  async interpret(query: string, signal?: AbortSignal): Promise<CivicPlan> {
    const request = readLatestRequest(query);
    if (request.hasContext || !request.text.trim()) return this.useFallback(query, signal);
    try {
      const plan = groundedPlan(await this.requestPlan(request.text, signal), request.text);
      this.onOutcome?.("model");
      return plan;
    } catch (error) {
      if (signal?.aborted) throw error;
      logger.warn("Modelo local no disponible; se usa el planificador por reglas", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return this.useFallback(query, signal);
    }
  }

  private useFallback(query: string, signal?: AbortSignal): Promise<CivicPlan> {
    this.onOutcome?.("fallback");
    return this.fallback.interpret(query, signal);
  }

  private async requestPlan(text: string, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Tiempo de espera agotado")), this.config.timeoutMs);
    try {
      return await this.fetchPlan(text, controller.signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  private async fetchPlan(text: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.fetchImplementation(new URL("/v1/chat/completions", this.config.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: LOCAL_PLANNER_PROMPT },
          { role: "user", content: text.slice(0, 2_000) },
        ],
      }),
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const completion = ChatCompletionSchema.parse(await response.json());
    return JSON.parse(completion.choices[0]!.message.content) as unknown;
  }
}

export function groundedPlan(raw: unknown, text: string): CivicPlan {
  const source = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const list = (key: string) => (Array.isArray(source[key]) ? source[key] : []);
  const plan = CivicPlanSchema.parse({
    analysis: source.analysis,
    indicator: source.indicator ?? "participation",
    years: [...new Set(list("years").map(Number))].sort((left, right) => left - right),
    entityCodes: [...new Set(list("entityCodes").map((code) => String(code).padStart(2, "0")))].sort(),
    sexes: [...new Set(list("sexes"))].sort(),
    ageGroups: CCPC_AGE_GROUPS.filter((group) => list("ageGroups").includes(group)),
    sectionTypes: [...new Set(list("sectionTypes"))].sort(),
    ...(typeof source.breakdown === "string" ? { breakdown: source.breakdown } : {}),
    presentation: [...new Set(list("presentation"))],
    ...(source.includeEvidence === true ? { includeEvidence: true } : {}),
    ...(typeof source.focus === "string" && (CIVIC_FOCUSES as readonly string[]).includes(source.focus) ? { focus: source.focus } : {}),
    ...(typeof source.clarification === "string" && source.clarification.trim() ? { clarification: source.clarification } : {}),
  });
  const writtenYears = new Set([...text.matchAll(/\b(\d{4})\b/gu)].map((match) => Number(match[1])));
  if (!RANGE_WORDS.test(text) && plan.years.some((year) => !writtenYears.has(year))) {
    throw new Error("El modelo agregó años que la pregunta no menciona");
  }
  return plan;
}

const LOCAL_PLANNER_PROMPT = [
  "Convierte la pregunta sobre participación electoral en México en un JSON con exactamente estas claves:",
  `analysis (${CIVIC_ANALYSES.join("|")}), indicator (${CIVIC_INDICATORS.join("|")}),`,
  `years (sólo ${CCPC_YEARS.join(", ")}), entityCodes (claves INE de 2 dígitos), sexes (${CCPC_SEXES.join("|")}),`,
  `ageGroups (${CCPC_AGE_GROUPS.join("|")}), sectionTypes (${CCPC_SECTION_TYPES.join("|")}),`,
  `breakdown opcional (${BREAKDOWN_DIMENSIONS.join("|")}), presentation (${CIVIC_PRESENTATIONS.join("|")}) y clarification opcional.`,
  "Usa listas vacías cuando la pregunta no mencione un filtro. Nunca inventes años, entidades ni filtros. Nacional = entityCodes vacío.",
  "summary = un territorio y un año; comparison = dos elecciones; trend = tres o más años o evolución; breakdown = por entidad, sexo, edad o tipo de sección (o ranking); evidence = registros; methodology = cómo se calcula.",
  "Si la pregunta usa un año sin conteo, no es sobre participación electoral o le falta qué comparar, escribe una pregunta corta en clarification.",
  `Claves: ${ENTITIES.map((entity) => `${entity.code}=${entity.name}`).join(", ")}.`,
  "Ejemplo: «¿Qué estado votó más en 2018?» → {\"analysis\":\"breakdown\",\"breakdown\":\"entidad\",\"indicator\":\"participation\",\"years\":[2018],\"entityCodes\":[],\"sexes\":[],\"ageGroups\":[],\"sectionTypes\":[],\"presentation\":[\"ranking\"]}.",
  "Ejemplo: «abstención de mujeres en Jalisco 2024» → {\"analysis\":\"summary\",\"indicator\":\"abstention\",\"years\":[2024],\"entityCodes\":[\"14\"],\"sexes\":[\"mujer\"],\"ageGroups\":[],\"sectionTypes\":[],\"presentation\":[]}.",
  "Responde sólo el JSON.",
].join(" ");
