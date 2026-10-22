import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { GeminiUiGenerator } from "../../ui/generation/gemini-ui-generator.js";
import { type GeminiModelConfig } from "../model/gemini-api-client.js";
import { GeminiModel } from "../model/gemini-model.js";
import { rulesQueryInterpreter } from "./civic-query-interpreter.js";
import { LocalModelQueryInterpreter, type LocalModelConfig } from "./local-model-interpreter.js";
import { PlannerConfigurationError, type UiPlannerMode } from "./planner-result.js";
import { createRulesUiPlanner } from "./rules-planner.js";
import { createModelUiPlanner, type UiPlanner } from "./ui-planner.js";

export interface PlannerSettings {
  mode: UiPlannerMode;
  gemini?: GeminiModelConfig;
  localModel?: LocalModelConfig;
}

export interface PlannerStatus {
  mode: UiPlannerMode;
  ready: boolean;
}

export function readPlannerSettings(): PlannerSettings {
  return {
    mode: env.UI_PLANNER_MODE,
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
    return createModelUiPlanner(
      "gemini",
      new GeminiModel(settings.gemini),
      new GeminiUiGenerator(settings.gemini),
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
