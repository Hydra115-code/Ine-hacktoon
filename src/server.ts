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
import { type CivicDataSource } from "./application/ports/civic-data.js";
import { FixtureCivicDataSource } from "./fixtures/civic-data.fixture.js";
import { CcpcEngineDataSource } from "./infrastructure/ccpc/ccpc-engine-data-source.js";

const sharedDataSource: CivicDataSource = env.CCPC_DATA_DIR
  ? CcpcEngineDataSource.fromOptions({
    dataDir: env.CCPC_DATA_DIR,
    ...(env.CCPC_DATASET_PATH ? { datasetPath: env.CCPC_DATASET_PATH } : {}),
  })
  : new FixtureCivicDataSource();

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

export function crearServidor(context: ServerContext, options: ServerOptions = {}): McpServer {
  const server = new McpServer({
    name: env.MCP_SERVER_NAME,
    version: env.MCP_SERVER_VERSION,
  });

  const civicDataService = options.civicDataService ?? new CivicDataService({ dataSource: sharedDataSource });
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
