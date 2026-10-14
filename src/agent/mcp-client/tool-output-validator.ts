import { z } from "zod";
import {
  CompareElectionsOutputSchema,
  GetParticipationBreakdownOutputSchema,
  GetParticipationSummaryOutputSchema,
  GetSupportingRecordsOutputSchema,
} from "../../schemas/civic.schema.js";

/** Contrato de salida de cada tool: si una salida no lo cumple, se rechaza. */
const TOOL_OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
  get_participation_summary: GetParticipationSummaryOutputSchema,
  compare_elections: CompareElectionsOutputSchema,
  get_participation_breakdown: GetParticipationBreakdownOutputSchema,
  get_supporting_records: GetSupportingRecordsOutputSchema,
};

export function validateToolOutput(toolName: string, output: unknown): unknown {
  const schema = TOOL_OUTPUT_SCHEMAS[toolName];
  if (!schema) throw new ToolOutputValidationError(toolName);

  const result = schema.safeParse(output);
  if (!result.success) throw new ToolOutputValidationError(toolName);
  return result.data;
}

export class ToolOutputValidationError extends Error {
  constructor(toolName: string) {
    super(`La salida de ${toolName} no cumple su contrato`);
    this.name = "ToolOutputValidationError";
  }
}
