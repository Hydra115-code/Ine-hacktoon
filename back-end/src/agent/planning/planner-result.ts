import { z } from "zod";
import { AgentToolCallSchema, type AgentToolCall } from "../schemas/agent.schema.js";

export const UI_PLANNER_MODES = ["rules", "local-model", "gemini"] as const;
export type UiPlannerMode = typeof UI_PLANNER_MODES[number];

export const PlannerResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tools"),
    toolCalls: z.array(AgentToolCallSchema).min(1).max(20),
  }).strict(),
  z.object({
    kind: z.literal("answer"),
    text: z.string().trim().min(1).max(20_000),
  }).strict(),
]);

export type PlannerResult = z.infer<typeof PlannerResultSchema>;

export function plannerResultFromTurn(turn: { text: string; toolCalls: AgentToolCall[] }): PlannerResult {
  if (turn.toolCalls.length > 0) return { kind: "tools", toolCalls: turn.toolCalls };
  const text = turn.text.trim();
  if (!text) throw new PlannerProviderError("El planificador no produjo una respuesta");
  return { kind: "answer", text };
}

export class PlannerProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerProviderError";
  }
}

export class PlannerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerConfigurationError";
  }
}

export class UiCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UiCompositionError";
  }
}

export class UiSemanticCompositionError extends UiCompositionError {
  constructor(message: string, readonly issueCodes: readonly string[] = []) {
    super(message);
    this.name = "UiSemanticCompositionError";
  }
}
