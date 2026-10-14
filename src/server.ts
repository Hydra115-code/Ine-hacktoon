import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type SupabaseClient } from "@supabase/supabase-js";
import { type AuthenticatedUser } from "./application/authenticated-user.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { ToolRateLimiter } from "./application/tool-rate-limiter.js";
import { CivicDataService } from "./services/civic-data.service.js";
import { registerGetParticipationSummaryTool } from "./tools/get-participation-summary.tool.js";
import { registerCompareElectionsTool } from "./tools/compare-elections.tool.js";
import { registerGetParticipationBreakdownTool } from "./tools/get-participation-breakdown.tool.js";
import { registerGetSupportingRecordsTool } from "./tools/get-supporting-records.tool.js";
import { registerCivicResources, CIVIC_RESOURCE_COUNT } from "./resources/civic-resources.js";
import { CIVIC_TOOL_NAMES } from "./agent/civic-tool-policy.js";

// Todas las tools cívicas son de sólo lectura, así que comparten un mismo límite.
const sharedToolRateLimiter = new ToolRateLimiter({
  maxCalls: env.MCP_RATE_LIMIT_PER_MINUTE,
  windowMs: 60_000,
});

export interface ServerContext {
  client: SupabaseClient;
  user: AuthenticatedUser;
}

interface ServerOptions {
  rateLimiter?: ToolRateLimiter;
  civicDataService?: CivicDataService;
}

/** Arma el servidor MCP con las 4 tools cívicas y sus recursos de referencia. */
export function crearServidor(context: ServerContext, options: ServerOptions = {}): McpServer {
  const server = new McpServer({
    name: env.MCP_SERVER_NAME,
    version: env.MCP_SERVER_VERSION,
  });

  const civicDataService = options.civicDataService ?? new CivicDataService();
  const rateLimiter = (options.rateLimiter ?? sharedToolRateLimiter).forScope(context.user.id);

  registerGetParticipationSummaryTool(server, civicDataService, rateLimiter);
  registerCompareElectionsTool(server, civicDataService, rateLimiter);
  registerGetParticipationBreakdownTool(server, civicDataService, rateLimiter);
  registerGetSupportingRecordsTool(server, civicDataService, rateLimiter);
  registerCivicResources(server);

  logger.info("Servidor MCP configurado", {
    nombre: env.MCP_SERVER_NAME,
    version: env.MCP_SERVER_VERSION,
    totalHerramientas: CIVIC_TOOL_NAMES.length,
    totalRecursos: CIVIC_RESOURCE_COUNT,
  });

  return server;
}
