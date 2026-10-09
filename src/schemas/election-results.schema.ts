import { z } from "zod";

export const ELECTION_OFFICES = ["presidencia", "senadurias", "diputaciones"] as const;

/**
 * Entrada de get_election_results.
 * Por ahora sólo se consultan los niveles nacional y estatal.
 */
export const GetElectionResultsInputSchema = z.object({
  year: z
    .number()
    .int()
    .min(1991)
    .max(2030)
    .describe("Año del proceso electoral, por ejemplo 2024"),
  office: z
    .enum(ELECTION_OFFICES)
    .describe("Cargo elegido: presidencia, senadurias o diputaciones"),
  entity: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .default("Nacional")
    .describe("\"Nacional\" o el nombre de una entidad federativa, por ejemplo \"Jalisco\""),
});

export type GetElectionResultsInput = z.infer<typeof GetElectionResultsInputSchema>;

const PartyResultSchema = z.object({
  party: z.string().min(1).max(80),
  votes: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});

export const GetElectionResultsOutputSchema = z.object({
  dataType: z.literal("OBSERVED"),
  isSampleData: z.boolean(),
  process: z.object({
    year: z.number().int(),
    office: z.enum(ELECTION_OFFICES),
  }),
  level: z.enum(["nacional", "estatal"]),
  entity: z.string().min(1),
  results: z.array(PartyResultSchema).min(1).max(30),
  participation: z.object({
    nominalList: z.number().int().positive(),
    totalVotes: z.number().int().nonnegative(),
    turnoutPercentage: z.number().min(0).max(100),
  }),
  source: z.object({
    name: z.string().min(1),
    note: z.string().optional(),
  }),
  metadata: z.object({
    queriedAt: z.string().datetime(),
  }),
});

export type GetElectionResultsOutput = z.infer<typeof GetElectionResultsOutputSchema>;
