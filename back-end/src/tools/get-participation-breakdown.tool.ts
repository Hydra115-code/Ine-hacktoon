import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../config/logger.js";
import { type ToolRateLimiter } from "../application/tool-rate-limiter.js";
import { GetParticipationBreakdownInputSchema } from "../schemas/civic.schema.js";
import { type CivicDataService } from "../services/civic-data.service.js";
import { civicToolError, civicToolSuccess } from "./civic-tool-response.js";

export const GET_PARTICIPATION_BREAKDOWN = "get_participation_breakdown";

export function registerGetParticipationBreakdownTool(
  server: McpServer,
  service: CivicDataService,
  rateLimiter: ToolRateLimiter,
): void {
  server.registerTool(
    GET_PARTICIPATION_BREAKDOWN,
    {
      title: "Desglose de participación",
      description:
        "Divide la participación de una elección por entidad, sexo, grupo de edad o tipo de sección " +
        "(urbana, mixta, rural), con lista nominal, votantes y % de participación de cada grupo.",
      inputSchema: GetParticipationBreakdownInputSchema,
    },
    async (input) => {
      try {
        rateLimiter.consume(GET_PARTICIPATION_BREAKDOWN);
        return civicToolSuccess(await service.getParticipationBreakdown(input));
      } catch (error) {
        return civicToolError(GET_PARTICIPATION_BREAKDOWN, error);
      }
    },
  );
  logger.debug(`Herramienta '${GET_PARTICIPATION_BREAKDOWN}' registrada`);
}
