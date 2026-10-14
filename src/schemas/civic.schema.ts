import { z } from "zod";

/**
 * Contratos (entradas y salidas) de las 4 tools cívicas. Zod revisa que los
 * datos tengan la forma correcta antes y después de cada consulta.
 * Por ahora sólo se consultan los niveles nacional y estatal.
 */

export const ELECTION_OFFICES = ["presidencia", "senadurias", "diputaciones"] as const;
export const BREAKDOWN_DIMENSIONS = ["entidad", "sexo", "grupo_edad"] as const;

const YearSchema = z
  .number()
  .int()
  .min(1991)
  .max(2030)
  .describe("Año del proceso electoral, por ejemplo 2024");

const OfficeSchema = z
  .enum(ELECTION_OFFICES)
  .describe("Cargo elegido: presidencia, senadurias o diputaciones");

const EntitySchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .default("Nacional")
  .describe("\"Nacional\" o el nombre de una entidad federativa, por ejemplo \"Jalisco\"");

const PercentageSchema = z.number().min(0).max(100);
const CountSchema = z.number().int().nonnegative();
const LevelSchema = z.enum(["nacional", "estatal"]);

const SourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  note: z.string().optional(),
});

/** Campos que llevan todas las salidas: tipo de dato, fuente y hora de consulta. */
const BaseOutputSchema = z.object({
  dataType: z.literal("OBSERVED"),
  isSampleData: z.boolean(),
  source: SourceSchema,
  metadata: z.object({ queriedAt: z.string().datetime() }),
});

const ProcessSchema = z.object({ year: z.number().int(), office: z.enum(ELECTION_OFFICES) });

const PartyResultSchema = z.object({
  party: z.string().min(1).max(80),
  votes: CountSchema,
  percentage: PercentageSchema,
});

const ParticipationSchema = z.object({
  nominalList: z.number().int().positive(),
  totalVotes: CountSchema,
  turnoutPercentage: PercentageSchema,
  abstentionPercentage: PercentageSchema,
});

// ---------- get_participation_summary ----------

export const GetParticipationSummaryInputSchema = z.object({
  year: YearSchema,
  office: OfficeSchema,
  entity: EntitySchema,
});

export const GetParticipationSummaryOutputSchema = BaseOutputSchema.extend({
  process: ProcessSchema,
  level: LevelSchema,
  entity: z.string().min(1),
  results: z.array(PartyResultSchema).min(1).max(30),
  participation: ParticipationSchema,
});

// ---------- compare_elections ----------

// Que los dos años sean distintos se revisa en el servicio, porque el servidor
// MCP necesita que la entrada sea un objeto Zod simple.
export const CompareElectionsInputSchema = z.object({
  office: OfficeSchema,
  entity: EntitySchema,
  baseYear: YearSchema.describe("Año del proceso de referencia, por ejemplo 2018"),
  compareYear: YearSchema.describe("Año del proceso a comparar, por ejemplo 2024"),
});

const ElectionSnapshotSchema = z.object({
  year: z.number().int(),
  nominalList: z.number().int().positive(),
  totalVotes: CountSchema,
  turnoutPercentage: PercentageSchema,
  results: z.array(PartyResultSchema).min(1).max(30),
});

export const CompareElectionsOutputSchema = BaseOutputSchema.extend({
  office: z.enum(ELECTION_OFFICES),
  level: LevelSchema,
  entity: z.string().min(1),
  elections: z.array(ElectionSnapshotSchema).length(2),
  turnoutChange: z.object({
    fromYear: z.number().int(),
    toYear: z.number().int(),
    /** Diferencia en puntos porcentuales (no es un porcentaje de cambio). */
    points: z.number().min(-100).max(100),
  }),
  methodologyNotes: z.array(z.string().min(1)).max(10),
});

// ---------- get_participation_breakdown ----------

export const GetParticipationBreakdownInputSchema = z.object({
  year: YearSchema,
  office: OfficeSchema,
  dimension: z
    .enum(BREAKDOWN_DIMENSIONS)
    .describe("Cómo dividir la participación: entidad, sexo o grupo_edad"),
  entity: EntitySchema.describe("Territorio para sexo o grupo_edad; se ignora con dimension=entidad"),
});

export const GetParticipationBreakdownOutputSchema = BaseOutputSchema.extend({
  process: ProcessSchema,
  dimension: z.enum(BREAKDOWN_DIMENSIONS),
  scope: z.string().min(1),
  groups: z.array(z.object({
    group: z.string().min(1),
    nominalList: z.number().int().positive(),
    voters: CountSchema,
    turnoutPercentage: PercentageSchema,
  })).min(1).max(40),
  coverageNote: z.string().optional(),
});

// ---------- get_supporting_records ----------

export const GetSupportingRecordsInputSchema = GetParticipationSummaryInputSchema;

export const GetSupportingRecordsOutputSchema = BaseOutputSchema.extend({
  process: ProcessSchema,
  level: LevelSchema,
  entity: z.string().min(1),
  records: z.array(z.object({
    recordId: z.string().min(1),
    field: z.string().min(1),
    label: z.string().min(1),
    value: z.number(),
    kind: z.enum(["dato_fuente", "calculado"]),
    derivation: z.string().optional(),
  })).min(1).max(60),
});

export type GetParticipationSummaryInput = z.infer<typeof GetParticipationSummaryInputSchema>;
export type GetParticipationSummaryOutput = z.infer<typeof GetParticipationSummaryOutputSchema>;
export type CompareElectionsInput = z.infer<typeof CompareElectionsInputSchema>;
export type CompareElectionsOutput = z.infer<typeof CompareElectionsOutputSchema>;
export type GetParticipationBreakdownInput = z.infer<typeof GetParticipationBreakdownInputSchema>;
export type GetParticipationBreakdownOutput = z.infer<typeof GetParticipationBreakdownOutputSchema>;
export type GetSupportingRecordsInput = z.infer<typeof GetSupportingRecordsInputSchema>;
export type GetSupportingRecordsOutput = z.infer<typeof GetSupportingRecordsOutputSchema>;
