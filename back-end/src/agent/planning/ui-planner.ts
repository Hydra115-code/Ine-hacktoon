import { type UiDocument } from "../../ui/dsl/ui.schema.js";
import { type UiGenerationInput, type UiGenerator } from "../../ui/generation/ui-generator.js";
import { type ModelGateway } from "../model/model.js";
import {
  type AgentToolDefinition,
  type AgentToolResult,
} from "../schemas/agent.schema.js";
import {
  plannerResultFromTurn,
  type PlannerResult,
  type UiPlannerMode,
} from "./planner-result.js";

export interface PlannerSessionInput {
  query: string;
  systemInstruction: string;
  tools: AgentToolDefinition[];
}

export interface PlannerSession {
  next(
    toolResults?: AgentToolResult[],
    signal?: AbortSignal,
    feedback?: string,
  ): Promise<PlannerResult>;
}

export interface UiPlanner {
  readonly mode: UiPlannerMode;
  createSession(input: PlannerSessionInput): PlannerSession;
  composeUi(input: UiGenerationInput, signal?: AbortSignal): Promise<UiDocument>;
}

export function createModelUiPlanner(
  mode: UiPlannerMode,
  model: ModelGateway,
  uiGenerator: UiGenerator,
): UiPlanner {
  return {
    mode,
    createSession(input) {
      const session = model.createSession(input);
      return {
        next: async (toolResults, signal, feedback) =>
          plannerResultFromTurn(await session.next(toolResults, signal, feedback)),
      };
    },
    composeUi: (input, signal) => uiGenerator.generate(input, signal),
  };
}

export function withUiComposer(planner: UiPlanner, uiGenerator: UiGenerator): UiPlanner {
  return {
    mode: planner.mode,
    createSession: (input) => planner.createSession(input),
    composeUi: (input, signal) => uiGenerator.generate(input, signal),
  };
}
