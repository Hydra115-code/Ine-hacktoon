import { z } from "zod";
import {
  CCPC_AGE_GROUPS,
  CCPC_SECTION_TYPES,
  CCPC_SEXES,
  CCPC_YEARS,
} from "../application/ports/civic-data.js";

export const BREAKDOWN_DIMENSIONS = ["entidad", "sexo", "grupo_edad", "tipo_seccion"] as const;
export type BreakdownDimension = typeof BREAKDOWN_DIMENSIONS[number];

const YearSchema = z
  .union([z.literal(2009), z.literal(2012), z.literal(2015), z.literal(2018), z.literal(2021), z.literal(2024)])
  .describe(`Año de la elección: ${CCPC_YEARS.join(", ")}`);

const OptionalYearSchema = YearSchema.optional().describe("Año de la elección; si se omite, se usa el más reciente (2024)");

const FilterShape = {
  entities: z
    .array(z.string().trim().min(1).max(60))
    .min(1)
    .max(32)
    .optional()
    .describe("Entidades por nombre (\"Jalisco\") o clave INE (\"14\"); si se omite, se usan todas las entidades disponibles"),
  sexes: z.array(z.enum(CCPC_SEXES)).min(1).max(3).optional().describe("hombre, mujer o no_binario (no_binario sólo existe en 2024)"),
  ageGroups: z.array(z.enum(CCPC_AGE_GROUPS)).min(1).max(18).optional().describe("Grupos de edad, por ejemplo 18-19, 20-24 o 100+"),
  sectionTypes: z.array(z.enum(CCPC_SECTION_TYPES)).min(1).max(3).optional().describe("Tipo de sección: urbana, mixta o rural"),
};

const PercentageSchema = z.number().min(0).max(100).nullable();
const CountSchema = z.number().int().nonnegative();
const PointsSchema = z.number().min(-100).max(100).nullable();

const TotalsShape = {
  nominalList: CountSchema,
  voted: CountSchema,
  didNotVote: CountSchema,
  unspecified: CountSchema,
  classified: CountSchema,
  participationPct: PercentageSchema,
  nominalParticipationPct: PercentageSchema,
  abstentionPct: PercentageSchema,
  unspecifiedPct: PercentageSchema,
};
const TotalsSchema = z.object(TotalsShape);

const AppliedFiltersSchema = z.object({
  year: z.number().int().optional(),
  entities: z.array(z.object({ code: z.string(), name: z.string() })),
  sexes: z.array(z.enum(CCPC_SEXES)).optional(),
  ageGroups: z.array(z.enum(CCPC_AGE_GROUPS)).optional(),
  sectionTypes: z.array(z.enum(CCPC_SECTION_TYPES)).optional(),
});

const BaseOutputSchema = z.object({
  dataType: z.literal("OBSERVED"),
  isSampleData: z.boolean(),
  status: z.enum(["ok", "no_data"]),
  level: z.enum(["nacional", "estatal"]),
  scope: z.string().min(1),
  filters: AppliedFiltersSchema,
  source: z.object({
    name: z.string().min(1),
    urls: z.array(z.string().url()),
    note: z.string().optional(),
  }),
  warnings: z.array(z.object({ code: z.string().min(1), message: z.string().min(1) })),
  metadata: z.object({
    queriedAt: z.string().datetime(),
    recordsSha256: z.string().min(1),
    matchedRecords: CountSchema,
  }),
});

export const GetParticipationSummaryInputSchema = z.object({ year: OptionalYearSchema, ...FilterShape });

export const GetParticipationSummaryOutputSchema = BaseOutputSchema.extend({
  year: z.number().int(),
  totals: TotalsSchema.nullable(),
  composition: z.array(z.object({
    category: z.enum(["Votaron", "No votaron", "No especificado"]),
    count: CountSchema,
    nominalSharePct: PercentageSchema,
  })).max(3),
});

export const CompareElectionsInputSchema = z.object({
  years: z.array(YearSchema).min(2).max(6).describe("De 2 a 6 años de elección distintos, por ejemplo [2018, 2024]"),
  ...FilterShape,
});

export const CompareElectionsOutputSchema = BaseOutputSchema.extend({
  years: z.array(z.number().int()).min(2).max(6),
  baselineYear: z.number().int(),
  elections: z.array(z.object({
    year: z.number().int(),
    hasData: z.boolean(),
    nominalList: CountSchema.nullable(),
    voted: CountSchema.nullable(),
    didNotVote: CountSchema.nullable(),
    unspecified: CountSchema.nullable(),
    classified: CountSchema.nullable(),
    participationPct: PercentageSchema,
    nominalParticipationPct: PercentageSchema,
    abstentionPct: PercentageSchema,
    unspecifiedPct: PercentageSchema,
  })).min(2).max(6),
  changes: z.array(z.object({
    year: z.number().int(),
    baselineYear: z.number().int(),
    participationPoints: PointsSchema,
    nominalParticipationPoints: PointsSchema,
    abstentionPoints: PointsSchema,
  })).min(1).max(5),
  methodologyNotes: z.array(z.string().min(1)).max(12),
});

export const GetParticipationBreakdownInputSchema = z.object({
  year: OptionalYearSchema,
  dimension: z.enum(BREAKDOWN_DIMENSIONS).describe("Cómo dividir la participación: entidad, sexo, grupo_edad o tipo_seccion"),
  ...FilterShape,
});

export const GetParticipationBreakdownOutputSchema = BaseOutputSchema.extend({
  year: z.number().int(),
  dimension: z.enum(BREAKDOWN_DIMENSIONS),
  groups: z.array(z.object({ group: z.string().min(1), value: z.string().min(1), ...TotalsShape })).max(40),
  coverageNote: z.string().optional(),
});

export const MAX_SUPPORTING_RECORDS = 60;

export const GetSupportingRecordsInputSchema = z.object({ year: OptionalYearSchema, ...FilterShape });

export const GetSupportingRecordsOutputSchema = BaseOutputSchema.extend({
  year: z.number().int(),
  records: z.array(z.object({
    entity: z.string().min(1),
    entityCode: z.string().min(1),
    year: z.number().int(),
    sex: z.enum(CCPC_SEXES),
    ageGroup: z.enum(CCPC_AGE_GROUPS),
    sectionType: z.enum(CCPC_SECTION_TYPES),
    ...TotalsShape,
    sourceId: z.string().min(1),
    // Filas del archivo original, no personas.
    sourceRows: z.number().int().positive(),
  })).max(MAX_SUPPORTING_RECORDS),
  totalRecords: CountSchema,
  truncated: z.boolean(),
  sources: z.array(z.object({
    id: z.string().min(1),
    year: z.number().int(),
    entity: z.string().min(1),
    url: z.string().url(),
    archiveSha256: z.string().min(1),
  })),
});

export type GetParticipationSummaryInput = z.infer<typeof GetParticipationSummaryInputSchema>;
export type GetParticipationSummaryOutput = z.infer<typeof GetParticipationSummaryOutputSchema>;
export type CompareElectionsInput = z.infer<typeof CompareElectionsInputSchema>;
export type CompareElectionsOutput = z.infer<typeof CompareElectionsOutputSchema>;
export type GetParticipationBreakdownInput = z.infer<typeof GetParticipationBreakdownInputSchema>;
export type GetParticipationBreakdownOutput = z.infer<typeof GetParticipationBreakdownOutputSchema>;
export type GetSupportingRecordsInput = z.infer<typeof GetSupportingRecordsInputSchema>;
export type GetSupportingRecordsOutput = z.infer<typeof GetSupportingRecordsOutputSchema>;
