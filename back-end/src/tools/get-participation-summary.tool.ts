import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../config/logger.js";
import { type ToolRateLimiter } from "../application/tool-rate-limiter.js";
import { GetParticipationSummaryInputSchema } from "../schemas/civic.schema.js";
import { type CivicDataService } from "../services/civic-data.service.js";
import { civicToolError, civicToolSuccess } from "./civic-tool-response.js";

export const GET_PARTICIPATION_SUMMARY = "get_participation_summary";

export function registerGetParticipationSummaryTool(
  server: McpServer,
  service: CivicDataService,
  rateLimiter: ToolRateLimiter,
): void {
  server.registerTool(
    GET_PARTICIPATION_SUMMARY,
    {
      title: "Resumen de participación",
      description:
        "Participación ciudadana de una elección (datos CCPC del INE): lista nominal, votantes, " +
        "no votantes, no especificados y % de participación oficial y nominal. Filtra por año, " +
        "entidades, sexo, grupo de edad y tipo de sección. No incluye votos por partido.",
      inputSchema: GetParticipationSummaryInputSchema,
    },
    async (input) => {
      try {
        rateLimiter.consume(GET_PARTICIPATION_SUMMARY);
        return civicToolSuccess(await service.getParticipationSummary(input));
      } catch (error) {
        return civicToolError(GET_PARTICIPATION_SUMMARY, error);
      }
    },
  );
  logger.debug(`Herramienta '${GET_PARTICIPATION_SUMMARY}' registrada`);
}
