import { env } from "../../config/env.js";
import { type AuthenticatedSupabaseSession } from "../../config/supabase.js";
import { crearServidor } from "../../server.js";
import { GeminiUiGenerator } from "../../ui/generation/gemini-ui-generator.js";
import { FinancialMcpClient } from "../mcp-client/financial-mcp-client.js";
import { GeminiModel } from "../model/gemini-model.js";
import { AgentExecutionError, AgentOrchestrator } from "../orchestrator.js";
import { type UiGenerator } from "../../ui/generation/ui-generator.js";
import { CIVIC_TOOL_NAMES } from "../civic-tool-policy.js";

export type SessionFactory = () => Promise<AuthenticatedSupabaseSession>;

export interface AgentRuntime {
  orchestrator: AgentOrchestrator;
  close(): Promise<void>;
}

interface AgentRuntimeOptions {
  uiGenerator?: UiGenerator;
}

export async function createAgentRuntime(
  sessionFactory: SessionFactory,
  options: AgentRuntimeOptions = {},
): Promise<AgentRuntime> {
  const geminiConfig = requireGeminiConfig();
  const supabaseSession = await sessionFactory();
  const permittedToolNames = [...CIVIC_TOOL_NAMES];
  const mcpClient = await FinancialMcpClient.connect(
    crearServidor(supabaseSession),
    env.AGENT_TOOL_TIMEOUT_MS,
  );
  const orchestrator = new AgentOrchestrator(
    new GeminiModel(geminiConfig),
    mcpClient,
    options.uiGenerator ?? new GeminiUiGenerator(geminiConfig, fetch, env.FINANCIAL_EXPERIENCE_SCOPE),
    {
      maxToolCalls: env.AGENT_MAX_TOOL_CALLS,
      maxToolRetries: env.AGENT_TOOL_MAX_RETRIES,
      retryDelayMs: env.AGENT_RETRY_DELAY_MS,
      userId: supabaseSession.user.id,
      permittedToolNames,
      experienceScope: env.FINANCIAL_EXPERIENCE_SCOPE,
    },
  );

  return {
    orchestrator,
    close: async () => mcpClient.close(),
  };
}

function requireGeminiConfig() {
  if (!env.GEMINI_API_URL || !env.GEMINI_API_KEY) {
    throw new AgentExecutionError(
      "GEMINI_API_URL y GEMINI_API_KEY son obligatorias para ejecutar el agente",
    );
  }

  return {
    apiUrl: env.GEMINI_API_URL,
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    timeoutMs: env.GEMINI_TIMEOUT_MS,
  };
}
