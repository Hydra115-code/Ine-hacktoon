import { env } from "../../config/env.js";
import { type AuthenticatedSupabaseSession } from "../../config/supabase.js";
import { crearServidor } from "../../server.js";
import { CivicMcpClient } from "../mcp-client/civic-mcp-client.js";
import { AgentOrchestrator } from "../orchestrator.js";
import { type UiGenerator } from "../../ui/generation/ui-generator.js";
import { CIVIC_TOOL_NAMES } from "../civic-tool-policy.js";
import { createUiPlanner } from "../planning/planner-factory.js";
import { withUiComposer, type UiPlanner } from "../planning/ui-planner.js";

export type SessionFactory = () => Promise<AuthenticatedSupabaseSession>;

export interface AgentRuntime {
  orchestrator: AgentOrchestrator;
  close(): Promise<void>;
}

interface AgentRuntimeOptions {
  planner?: UiPlanner;
  uiGenerator?: UiGenerator;
}

export async function createAgentRuntime(
  sessionFactory: SessionFactory,
  options: AgentRuntimeOptions = {},
): Promise<AgentRuntime> {
  const basePlanner = options.planner ?? createUiPlanner();
  const planner = options.uiGenerator ? withUiComposer(basePlanner, options.uiGenerator) : basePlanner;
  const supabaseSession = await sessionFactory();
  const permittedToolNames = [...CIVIC_TOOL_NAMES];
  const mcpClient = await CivicMcpClient.connect(
    crearServidor(supabaseSession),
    env.AGENT_TOOL_TIMEOUT_MS,
  );
  const orchestrator = new AgentOrchestrator(
    planner,
    mcpClient,
    {
      maxToolCalls: env.AGENT_MAX_TOOL_CALLS,
      maxToolRetries: env.AGENT_TOOL_MAX_RETRIES,
      retryDelayMs: env.AGENT_RETRY_DELAY_MS,
      userId: supabaseSession.user.id,
      permittedToolNames,
    },
  );

  return {
    orchestrator,
    close: async () => mcpClient.close(),
  };
}
