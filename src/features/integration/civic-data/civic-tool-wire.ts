import { z } from "zod";

export const civicToolNames = [
  "get_participation_summary",
  "compare_elections",
  "get_participation_breakdown",
  "get_supporting_records",
] as const;

export type CivicToolName = typeof civicToolNames[number];

const officeSchema = z.enum(["presidencia", "senadurias", "diputaciones"]);
const levelSchema = z.enum(["nacional", "estatal"]);
const percentageSchema = z.number().min(0).max(100);
const countSchema = z.number().int().nonnegative();

export const civicSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  urls: z.array(z.string().url()).optional(),
  note: z.string().optional(),
}).strict();

export const civicMetadataSchema = z.object({
  queriedAt: z.string().datetime(),
  recordsSha256: z.string().min(1).optional(),
  matchedRecords: countSchema.optional(),
}).strict();

const baseOutputShape = {
  dataType: z.literal("OBSERVED"),
  isSampleData: z.boolean(),
  source: civicSourceSchema,
  metadata: civicMetadataSchema,
};

export const civicProcessSchema = z.object({ year: z.number().int(), office: officeSchema }).strict();

export const partyResultSchema = z.object({
  party: z.string().min(1).max(80),
  votes: countSchema,
  percentage: percentageSchema,
}).strict();

const participationBaseSchema = z.object({
  nominalList: z.number().int().positive(),
  totalVotes: countSchema,
  turnoutPercentage: percentageSchema,
  abstentionPercentage: percentageSchema,
}).strict();

export const participationSchema = participationBaseSchema.superRefine((value, context) => {
  validateParticipation(value.totalVotes, value.nominalList, value.turnoutPercentage, context);
  if (!approximatelyEqual(value.turnoutPercentage + value.abstentionPercentage, 100)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["abstentionPercentage"], message: "Participación y abstención deben sumar 100" });
  }
});

const legacyParticipationSummaryOutputSchema = z.object({
  ...baseOutputShape,
  process: civicProcessSchema,
  level: levelSchema,
  entity: z.string().min(1),
  results: z.array(partyResultSchema).min(1).max(30),
  participation: participationSchema,
}).strict().superRefine((value, context) => {
  const resultVotes = value.results.reduce((total, result) => total + result.votes, 0);
  if (resultVotes !== value.participation.totalVotes) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["results"], message: "La suma de resultados no coincide con totalVotes" });
  }
});

export const electionSnapshotSchema = z.object({
  year: z.number().int(),
  nominalList: z.number().int().positive(),
  totalVotes: countSchema,
  turnoutPercentage: percentageSchema,
  results: z.array(partyResultSchema).min(1).max(30),
}).strict().superRefine((value, context) => {
  validateParticipation(value.totalVotes, value.nominalList, value.turnoutPercentage, context);
  const resultVotes = value.results.reduce((total, result) => total + result.votes, 0);
  if (resultVotes !== value.totalVotes) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["results"], message: "La suma de resultados no coincide con totalVotes" });
  }
});

const legacyCompareElectionsOutputSchema = z.object({
  ...baseOutputShape,
  office: officeSchema,
  level: levelSchema,
  entity: z.string().min(1),
  elections: z.array(electionSnapshotSchema).length(2),
  turnoutChange: z.object({
    fromYear: z.number().int(),
    toYear: z.number().int(),
    points: z.number().min(-100).max(100),
  }).strict(),
  methodologyNotes: z.array(z.string().min(1)).max(10),
}).strict();

export const legacyParticipationGroupSchema = z.object({
  group: z.string().min(1),
  nominalList: z.number().int().positive(),
  voters: countSchema,
  turnoutPercentage: percentageSchema,
}).strict().superRefine((value, context) => {
  validateParticipation(value.voters, value.nominalList, value.turnoutPercentage, context);
});

const currentTotalsShape = {
  nominalList: countSchema,
  voted: countSchema,
  didNotVote: countSchema,
  unspecified: countSchema,
  classified: countSchema,
  participationPct: percentageSchema.nullable(),
  nominalParticipationPct: percentageSchema.nullable(),
  abstentionPct: percentageSchema.nullable(),
  unspecifiedPct: percentageSchema.nullable(),
};

const currentTotalsSchema = z.object(currentTotalsShape).strict().superRefine((value, context) => {
  validateCurrentTotals(value, context);
});

export const participationGroupSchema = z.object({
  group: z.string().min(1),
  value: z.string().min(1),
  ...currentTotalsShape,
}).strict().superRefine((value, context) => {
  validateCurrentTotals(value, context);
});

const appliedFiltersSchema = z.object({
  year: z.number().int().optional(),
  entities: z.array(z.object({ code: z.string(), name: z.string() }).strict()),
  sexes: z.array(z.enum(["hombre", "mujer", "no_binario"])).optional(),
  ageGroups: z.array(z.string().min(1)).optional(),
  sectionTypes: z.array(z.enum(["urbana", "mixta", "rural"])).optional(),
}).strict();

const civicWarningSchema = z.object({ code: z.string().min(1), message: z.string().min(1) }).strict();

const currentSourceSchema = z.object({
  name: z.string().min(1),
  urls: z.array(z.string().url()),
  note: z.string().optional(),
}).strict();

const currentBaseOutputShape = {
  dataType: z.literal("OBSERVED"),
  isSampleData: z.boolean(),
  status: z.enum(["ok", "no_data"]),
  level: levelSchema,
  scope: z.string().min(1),
  filters: appliedFiltersSchema,
  source: currentSourceSchema,
  warnings: z.array(civicWarningSchema),
  metadata: civicMetadataSchema,
};

export const currentParticipationSummaryOutputSchema = z.object({
  ...currentBaseOutputShape,
  year: z.number().int(),
  totals: currentTotalsSchema.nullable(),
  composition: z.array(z.object({
    category: z.enum(["Votaron", "No votaron", "No especificado"]),
    count: countSchema,
    nominalSharePct: percentageSchema.nullable(),
  }).strict()).max(3),
}).strict();

export const participationSummaryOutputSchema = z.union([
  currentParticipationSummaryOutputSchema,
  legacyParticipationSummaryOutputSchema,
]);

const currentElectionSnapshotSchema = z.object({
  year: z.number().int(),
  hasData: z.boolean(),
  nominalList: countSchema.nullable(),
  voted: countSchema.nullable(),
  didNotVote: countSchema.nullable(),
  unspecified: countSchema.nullable(),
  classified: countSchema.nullable(),
  participationPct: percentageSchema.nullable(),
  nominalParticipationPct: percentageSchema.nullable(),
  abstentionPct: percentageSchema.nullable(),
  unspecifiedPct: percentageSchema.nullable(),
}).strict();

export const currentCompareElectionsOutputSchema = z.object({
  ...currentBaseOutputShape,
  years: z.array(z.number().int()).min(2).max(6),
  baselineYear: z.number().int(),
  elections: z.array(currentElectionSnapshotSchema).min(2).max(6),
  changes: z.array(z.object({
    year: z.number().int(),
    baselineYear: z.number().int(),
    participationPoints: z.number().min(-100).max(100).nullable(),
    nominalParticipationPoints: z.number().min(-100).max(100).nullable(),
    abstentionPoints: z.number().min(-100).max(100).nullable(),
  }).strict()).min(1).max(5),
  methodologyNotes: z.array(z.string().min(1)).max(12),
}).strict();

export const compareElectionsOutputSchema = z.union([
  currentCompareElectionsOutputSchema,
  legacyCompareElectionsOutputSchema,
]);

const legacyParticipationBreakdownOutputSchema = z.object({
  ...baseOutputShape,
  process: civicProcessSchema,
  dimension: z.enum(["entidad", "sexo", "grupo_edad"]),
  scope: z.string().min(1),
  groups: z.array(legacyParticipationGroupSchema).min(1).max(40),
  coverageNote: z.string().optional(),
}).strict();

export const currentParticipationBreakdownOutputSchema = z.object({
  ...currentBaseOutputShape,
  year: z.number().int(),
  dimension: z.enum(["entidad", "sexo", "grupo_edad", "tipo_seccion"]),
  groups: z.array(participationGroupSchema).max(40),
  coverageNote: z.string().optional(),
}).strict();

export const participationBreakdownOutputSchema = z.union([
  currentParticipationBreakdownOutputSchema,
  legacyParticipationBreakdownOutputSchema,
]);

export const supportingRecordSchema = z.object({
  recordId: z.string().min(1),
  field: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  kind: z.enum(["dato_fuente", "calculado"]),
  derivation: z.string().optional(),
}).strict();

const legacySupportingRecordsOutputSchema = z.object({
  ...baseOutputShape,
  process: civicProcessSchema,
  level: levelSchema,
  entity: z.string().min(1),
  records: z.array(supportingRecordSchema).min(1).max(60),
}).strict().superRefine((value, context) => {
  const nominalList = value.records.find((record) => record.field === "nominalList")?.value;
  const totalVotes = value.records.find((record) => record.field === "totalVotes")?.value;
  const turnout = value.records.find((record) => record.field === "turnoutPercentage")?.value;
  if (nominalList !== undefined && totalVotes !== undefined && turnout !== undefined
    && !participationIsCoherent(totalVotes, nominalList, turnout)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["records"], message: "Los registros de participación se contradicen" });
  }
});

const currentSupportingRecordSchema = z.object({
  entity: z.string().min(1),
  entityCode: z.string().min(1),
  year: z.number().int(),
  sex: z.enum(["hombre", "mujer", "no_binario"]),
  ageGroup: z.string().min(1),
  sectionType: z.enum(["urbana", "mixta", "rural"]),
  ...currentTotalsShape,
  sourceId: z.string().min(1),
  sourceRows: z.number().int().positive(),
}).strict().superRefine((value, context) => {
  validateCurrentTotals(value, context);
});

export const currentSupportingRecordsOutputSchema = z.object({
  ...currentBaseOutputShape,
  year: z.number().int(),
  records: z.array(currentSupportingRecordSchema).max(60),
  totalRecords: countSchema,
  truncated: z.boolean(),
  sources: z.array(z.object({
    id: z.string().min(1),
    year: z.number().int(),
    entity: z.string().min(1),
    url: z.string().url(),
    archiveSha256: z.string().min(1),
  }).strict()),
}).strict();

export const supportingRecordsOutputSchema = z.union([
  currentSupportingRecordsOutputSchema,
  legacySupportingRecordsOutputSchema,
]);

function validateCurrentTotals(value: {
  voted: number;
  didNotVote: number;
  classified: number;
  unspecified: number;
  nominalList: number;
}, context: z.RefinementCtx) {
  if (value.voted + value.didNotVote !== value.classified) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["classified"], message: "El total clasificado no coincide" });
  }
  if (value.classified + value.unspecified !== value.nominalList) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["nominalList"], message: "La lista nominal no coincide con los componentes" });
  }
}

function validateParticipation(voters: number, nominalList: number, turnout: number, context: z.RefinementCtx) {
  if (voters > nominalList) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["totalVotes"], message: "El numerador no puede superar la lista nominal" });
  }
  if (!participationIsCoherent(voters, nominalList, turnout)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["turnoutPercentage"], message: "El porcentaje no coincide con numerador y denominador" });
  }
}

export function participationIsCoherent(voters: number, nominalList: number, turnout: number) {
  if (!Number.isFinite(voters) || !Number.isFinite(nominalList) || !Number.isFinite(turnout) || nominalList <= 0) return false;
  return approximatelyEqual((voters / nominalList) * 100, turnout);
}

function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) <= 0.011;
}

export const civicToolOutputSchemas = {
  get_participation_summary: participationSummaryOutputSchema,
  compare_elections: compareElectionsOutputSchema,
  get_participation_breakdown: participationBreakdownOutputSchema,
  get_supporting_records: supportingRecordsOutputSchema,
} as const;

export type ParticipationSummaryOutput = z.infer<typeof participationSummaryOutputSchema>;
export type CompareElectionsOutput = z.infer<typeof compareElectionsOutputSchema>;
export type ParticipationBreakdownOutput = z.infer<typeof participationBreakdownOutputSchema>;
export type SupportingRecordsOutput = z.infer<typeof supportingRecordsOutputSchema>;
