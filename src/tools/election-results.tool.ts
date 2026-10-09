import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../config/logger.js";
import { GetElectionResultsInputSchema } from "../schemas/election-results.schema.js";
import {
  ElectionDataNotFoundError,
  type ElectionResultsService,
} from "../services/election-results.service.js";
import { ToolRateLimiter } from "../application/tool-rate-limiter.js";
import { RateLimitError } from "../application/errors/rate-limit.error.js";

const TOOL_NAME = "get_election_results";

export function registrarHerramientaElectionResults(
  server: McpServer,
  service: ElectionResultsService,
  rateLimiter: ToolRateLimiter,
): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Resultados electorales",
      description:
        "Devuelve votos por partido y participación de un proceso electoral " +
        "a nivel nacional o de una entidad federativa.",
      inputSchema: GetElectionResultsInputSchema,
    },
    async (input) => {
      try {
        rateLimiter.consume(TOOL_NAME);
        const resultado = service.getResults(input);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error("Error en herramienta get_election_results", {
          errorType: error instanceof Error ? error.name : "UnknownError",
        });

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: error instanceof RateLimitError
                ? "Límite de solicitudes alcanzado. Inténtalo más tarde."
                : error instanceof ElectionDataNotFoundError
                ? "No hay datos para ese proceso, cargo o entidad. Prueba con otro año o con el nivel nacional."
                : "No fue posible consultar los resultados electorales.",
            },
          ],
        };
      }
    },
  );

  logger.debug("Herramienta 'get_election_results' registrada");
}
