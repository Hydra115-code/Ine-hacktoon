import { z } from "zod";
import { dataRegistryContractSchema, CONTRACT_VERSION } from "../protocol.js";

const versionField = { version: z.literal(CONTRACT_VERSION) };
const identifierSchema = z.string().uuid();
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const financialSummaryRequestSchema = z.object({
  ...versionField,
  correlationId: identifierSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict();

export const financialSummaryResponseSchema = z.object({
  ...versionField,
  correlationId: identifierSchema,
  dataRegistry: dataRegistryContractSchema,
}).strict();

export type FinancialSummaryRequest = z.infer<typeof financialSummaryRequestSchema>;
export type FinancialSummaryResponse = z.infer<typeof financialSummaryResponseSchema>;

export * from "../financial-domain.js";
export * from "../fixtures.js";
