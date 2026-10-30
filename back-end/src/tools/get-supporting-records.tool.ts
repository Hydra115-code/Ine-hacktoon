import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../config/logger.js";
import { type ToolRateLimiter } from "../application/tool-rate-limiter.js";
import { GetSupportingRecordsInputSchema } from "../schemas/civic.schema.js";
import { type CivicDataService } from "../services/civic-data.service.js";
import { civicToolError, civicToolSuccess } from "./civic-tool-response.js";

export const GET_SUPPORTING_RECORDS = "get_supporting_records";

export function registerGetSupportingRecordsTool(
  server: McpServer,
  service: CivicDataService,
  rateLimiter: ToolRateLimiter,
): void {
  server.registerTool(
    GET_SUPPORTING_RECORDS,
    {
      title: "Registros de respaldo",
      description:
        "Devuelve los grupos de la fuente que respaldan las cifras (año, entidad, sexo, edad, tipo de sección " +
        "y sus conteos) y los archivos oficiales del INE de donde salen, para mostrar evidencia verificable.",
      inputSchema: GetSupportingRecordsInputSchema,
    },
    async (input) => {
      try {
        rateLimiter.consume(GET_SUPPORTING_RECORDS);
        return civicToolSuccess(await service.getSupportingRecords(input));
      } catch (error) {
        return civicToolError(GET_SUPPORTING_RECORDS, error);
      }
    },
  );
  logger.debug(`Herramienta '${GET_SUPPORTING_RECORDS}' registrada`);
}
