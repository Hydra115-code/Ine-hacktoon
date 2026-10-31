import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { GeminiApiClient, type GeminiModelConfig } from "../model/gemini-api-client.js";
import { rulesQueryInterpreter } from "./civic-query-interpreter.js";
import { GeminiAnswerWriter } from "./gemini-answer-writer.js";
import { GeminiQueryInterpreter } from "./gemini-query-interpreter.js";
import { LocalModelQueryInterpreter, type LocalModelConfig } from "./local-model-interpreter.js";
import { PlannerConfigurationError, type UiPlannerMode } from "./planner-result.js";
import { createRulesUiPlanner } from "./rules-planner.js";
import { type UiPlanner } from "./ui-planner.js";

export interface GeminiBudget {
  plannerMs: number;
  answerMs: number;
  editMs: number;
}

export interface PlannerSettings {
  mode: UiPlannerMode;
  gemini?: GeminiModelConfig;
  geminiBudget?: GeminiBudget;
  localModel?: LocalModelConfig;
}

const DEFAULT_GEMINI_BUDGET: GeminiBudget = { plannerMs: 8_000, answerMs: 0, editMs: 4_000 };

export interface PlannerStatus {
  mode: UiPlannerMode;
  ready: boolean;
}

export function readPlannerSettings(): PlannerSettings {
  return {
    mode: env.UI_PLANNER_MODE,
    geminiBudget: {
      plannerMs: env.GEMINI_PLANNER_TIMEOUT_MS,
      answerMs: env.GEMINI_ANSWER_TIMEOUT_MS,
      editMs: env.GEMINI_EDIT_TIMEOUT_MS,
    },
    ...(env.GEMINI_API_URL && env.GEMINI_API_KEY
      ? {
        gemini: {
          apiUrl: env.GEMINI_API_URL,
          apiKey: env.GEMINI_API_KEY,
          model: env.GEMINI_MODEL,
          timeoutMs: env.GEMINI_TIMEOUT_MS,
        },
      }
      : {}),
    ...(env.LOCAL_MODEL_URL && env.LOCAL_MODEL_NAME
      ? {
        localModel: {
          url: env.LOCAL_MODEL_URL,
          model: env.LOCAL_MODEL_NAME,
          timeoutMs: env.LOCAL_MODEL_TIMEOUT_MS,
        },
      }
      : {}),
  };
}

export function createUiPlanner(settings: PlannerSettings = readPlannerSettings()): UiPlanner {
  if (settings.mode === "gemini") {
    if (!settings.gemini) {
      throw new PlannerConfigurationError("UI_PLANNER_MODE=gemini requiere GEMINI_API_URL y GEMINI_API_KEY");
    }
    const budget = settings.geminiBudget ?? DEFAULT_GEMINI_BUDGET;
    return createRulesUiPlanner(
      new GeminiQueryInterpreter(new GeminiApiClient({ ...settings.gemini, timeoutMs: budget.plannerMs }), budget.plannerMs),
      "gemini",
      budget.answerMs > 0
        ? new GeminiAnswerWriter(new GeminiApiClient({ ...settings.gemini, timeoutMs: budget.answerMs }), budget.answerMs)
        : undefined,
    );
  }
  if (settings.mode === "local-model") {
    if (!settings.localModel) {
      logger.warn("UI_PLANNER_MODE=local-model sin LOCAL_MODEL_URL o LOCAL_MODEL_NAME; se usa el planificador por reglas");
      return createRulesUiPlanner(rulesQueryInterpreter, "local-model");
    }
    return createRulesUiPlanner(
      new LocalModelQueryInterpreter(settings.localModel, rulesQueryInterpreter),
      "local-model",
    );
  }
  return createRulesUiPlanner(rulesQueryInterpreter, "rules");
}

export function readPlannerStatus(settings: PlannerSettings = readPlannerSettings()): PlannerStatus {
  return {
    mode: settings.mode,
    ready: settings.mode !== "gemini" || Boolean(settings.gemini),
  };
}
