import { logger } from "../config/logger.js";
import { GeminiApiClient } from "../agent/model/gemini-api-client.js";
import { askGeminiText, geminiRequest, parseGeminiJson } from "../agent/model/gemini-quick-request.js";
import { readPlannerSettings } from "../agent/planning/planner-factory.js";

export const VIEW_EDIT_OPERATIONS = {
  "solo-tabla": "deja sólo la tabla",
  "solo-grafica": "deja sólo la gráfica",
  "formato-grafica": "muéstralo en formato gráfica",
  "quitar-grafica": "quita la gráfica",
  "quitar-tabla": "quita la tabla",
  "quitar-mapa": "quita el mapa",
  "grafica-lineas": "cambia a gráfica de líneas",
  "grafica-barras": "cambia a gráfica de barras",
  "grafica-area": "cambia a gráfica de área",
  "convertir-tabla": "convierte la gráfica en tabla",
  "menor-a-mayor": "ordénalo de menor a mayor",
  "mayor-a-menor": "ordénalo de mayor a menor",
  "mostrar-fuente": "muéstrame la fuente",
  "mostrar-metodologia": "muéstrame la metodología",
  "regresar": "regresa a la vista anterior",
} as const;

export type ViewEditOperation = keyof typeof VIEW_EDIT_OPERATIONS;

export interface ViewEditInterpreter {
  interpret(request: string, signal?: AbortSignal): Promise<string | undefined>;
}

export class GeminiViewEditInterpreter implements ViewEditInterpreter {
  constructor(
    private readonly client: GeminiApiClient,
    private readonly timeoutMs: number,
  ) {}

  async interpret(request: string, signal?: AbortSignal): Promise<string | undefined> {
    try {
      const text = await askGeminiText(
        this.client,
        geminiRequest(EDIT_INSTRUCTION, request.slice(0, 400), true),
        this.timeoutMs,
        signal,
      );
      const parsed = parseGeminiJson(text);
      const operation = typeof parsed === "object" && parsed !== null && "operacion" in parsed
        ? (parsed as { operacion: unknown }).operacion
        : undefined;
      return typeof operation === "string" && operation in VIEW_EDIT_OPERATIONS
        ? VIEW_EDIT_OPERATIONS[operation as ViewEditOperation]
        : undefined;
    } catch (error) {
      logger.warn("Gemini no interpretó la edición a tiempo", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return undefined;
    }
  }
}

export function createViewEditInterpreter(): ViewEditInterpreter | undefined {
  const settings = readPlannerSettings();
  if (settings.mode !== "gemini" || !settings.gemini) return undefined;
  const timeoutMs = settings.geminiBudget?.editMs ?? 4_000;
  return new GeminiViewEditInterpreter(new GeminiApiClient({ ...settings.gemini, timeoutMs }), timeoutMs);
}

const EDIT_INSTRUCTION = [
  "Decide si el mensaje pide cambiar cómo se ve la vista actual de datos electorales, sin pedir datos nuevos.",
  `Responde sólo {"operacion": X} donde X es una de: ${Object.keys(VIEW_EDIT_OPERATIONS).join(", ")} o "ninguna".`,
  "formato-grafica = verlo como gráfica; solo-grafica = quitar todo menos la gráfica; convertir-tabla = pasar la gráfica a tabla.",
  "Usa \"ninguna\" si pide otro año, territorio, grupo o dato, o si no es sobre la vista.",
  "Ejemplos: «dámelo en formato gráfica» → formato-grafica; «quiero verlo en barras» → grafica-barras;",
  "«ponlo de menor a mayor» → menor-a-mayor; «¿de dónde salen los datos?» → mostrar-fuente; «ahora para 2018» → ninguna.",
].join(" ");
