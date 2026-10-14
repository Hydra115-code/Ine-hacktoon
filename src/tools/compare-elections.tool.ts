import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../config/logger.js";
import { type ToolRateLimiter } from "../application/tool-rate-limiter.js";
import { CompareElectionsInputSchema } from "../schemas/civic.schema.js";
import { type CivicDataService } from "../services/civic-data.service.js";
import { civicToolError, civicToolSuccess } from "./civic-tool-response.js";

export const COMPARE_ELECTIONS = "compare_elections";

export function registerCompareElectionsTool(
  server: McpServer,
  service: CivicDataService,
  rateLimiter: ToolRateLimiter,
): void {
  server.registerTool(
    COMPARE_ELECTIONS,
    {
      title: "Comparar procesos electorales",
      description:
        "Compara dos procesos del mismo cargo y territorio (por ejemplo 2018 contra 2024): " +
        "participación de cada año, cambio en puntos porcentuales y advertencias metodológicas.",
      inputSchema: CompareElectionsInputSchema,
    },
    async (input) => {
      try {
        rateLimiter.consume(COMPARE_ELECTIONS);
        return civicToolSuccess(await service.compareElections(input));
      } catch (error) {
        return civicToolError(COMPARE_ELECTIONS, error);
      }
    },
  );
  logger.debug(`Herramienta '${COMPARE_ELECTIONS}' registrada`);
}
