/** DATA-03: contratos de consulta puros y esquemas Zod de entrada y salida. */
import { z } from 'zod';
import {
  AGE_GROUPS, ALLOWED_YEARS, METRIC_DEFINITIONS, SECTION_TYPES, SEXES,
  calculateMetrics, officialSourceUrl, participationKey, percentagePointDifference, relativePercentageChange,
} from '../../domain/civic/participation.ts';
import type { ParticipationRecord, ParticipationSource } from '../../domain/civic/participation.ts';
import { parseParticipationRecord, parseParticipationSource } from '../../schemas/civic/participation.schema.ts';

export const ENTITY_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16',
  '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32',
] as const;
export const BREAKDOWN_DIMENSIONS = ['entity', 'year', 'sex', 'ageGroup', 'sectionType'] as const;
export type Year = typeof ALLOWED_YEARS[number];
export type EntityCode = typeof ENTITY_CODES[number];
export type Sex = typeof SEXES[number];
export type AgeGroup = typeof AGE_GROUPS[number];
export type SectionType = typeof SECTION_TYPES[number];
export type BreakdownDimension = typeof BREAKDOWN_DIMENSIONS[number];
export type ParticipationFilters = {
  year?: Year;
  entityCodes?: readonly EntityCode[];
  sexes?: readonly Sex[];
  ageGroups?: readonly AgeGroup[];
  sectionTypes?: readonly SectionType[];
};

const yearSchema = z.union(ALLOWED_YEARS.map(year => z.literal(year)));
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positiveInteger = integer.min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const ratio = z.number().min(0).max(1).nullable();
const percentage = z.number().min(0).max(100).nullable();
const finiteNullable = z.number().nullable();
const nonemptyText = z.string().min(1);

function distinct<T>(items: readonly T[]): boolean { return new Set(items).size === items.length; }
const uniqueList = <T extends z.ZodType>(schema: T) => z.array(schema).min(1)
  .refine(distinct, 'No se permiten valores duplicados.');

export const participationFiltersSchema = z.strictObject({
  year: yearSchema.optional(),
  entityCodes: uniqueList(z.enum(ENTITY_CODES)).optional(),
  sexes: uniqueList(z.enum(SEXES)).optional(),
  ageGroups: uniqueList(z.enum(AGE_GROUPS)).optional(),
  sectionTypes: uniqueList(z.enum(SECTION_TYPES)).optional(),
});

/** Copias canónicas: no modifica arreglos ni objetos entregados por el consumidor. */
export function parseParticipationFilters(input: unknown): ParticipationFilters {
  const parsed = participationFiltersSchema.parse(input);
  return {
    ...(parsed.year === undefined ? {} : { year: parsed.year }),
    ...(parsed.entityCodes === undefined ? {} : { entityCodes: [...parsed.entityCodes].sort((a, b) => Number(a) - Number(b)) }),
    ...(parsed.sexes === undefined ? {} : { sexes: SEXES.filter(sex => parsed.sexes!.includes(sex)) }),
    ...(parsed.ageGroups === undefined ? {} : { ageGroups: AGE_GROUPS.filter(age => parsed.ageGroups!.includes(age)) }),
    ...(parsed.sectionTypes === undefined ? {} : { sectionTypes: SECTION_TYPES.filter(type => parsed.sectionTypes!.includes(type)) }),
  };
}

export const datasetMetadataSchema = z.strictObject({
  schemaVersion: z.literal('ccpc-participation/v1'),
  kind: z.enum(['full', 'sample']),
  years: uniqueList(yearSchema),
  recordsSha256: sha256,
  validation: z.literal('runtime_schema'),
}).superRefine((metadata, ctx) => {
  if (metadata.years.some((year, index) => index > 0 && year <= metadata.years[index - 1])) {
    ctx.addIssue({ code: 'custom', path: ['years'], message: 'Los años deben estar ordenados ascendentemente.' });
  }
});
export type DatasetMetadata = z.infer<typeof datasetMetadataSchema>;

export interface ParticipationDataPort {
  readonly metadata: DatasetMetadata;
  selectRecords(filters: ParticipationFilters): readonly ParticipationRecord[];
  selectSources(filters: ParticipationFilters): readonly ParticipationSource[];
}

const countsShape = {
  nominalList: integer, voted: integer, didNotVote: integer, unspecified: integer,
};
const metricsShape = {
  classified: integer,
  participationRate: ratio, abstentionRate: ratio, unspecifiedRate: ratio,
  participationPct: percentage, abstentionPct: percentage, unspecifiedPct: percentage,
  ccpcParticipationPct: percentage, ccpcAbstentionPct: percentage,
};
export const participationTotalsSchema = z.strictObject({ ...countsShape, ...metricsShape })
  .superRefine((totals, ctx) => {
    try {
      const calculated = calculateMetrics(totals);
      for (const field of Object.keys(calculated) as Array<keyof typeof calculated>) {
        if (totals[field] !== calculated[field]) {
          ctx.addIssue({ code: 'custom', path: [field], message: 'La métrica no corresponde a los conteos y su denominador.' });
        }
      }
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Conteos inconsistentes.' });
    }
  });

export const participationRecordSchema = z.strictObject({
  entityCode: z.enum(ENTITY_CODES), entityName: nonemptyText, year: yearSchema, sex: z.enum(SEXES),
  ageGroup: z.enum(AGE_GROUPS), sectionType: z.enum(SECTION_TYPES),
  ...countsShape, ...metricsShape, sourceId: nonemptyText, sourceRows: positiveInteger,
}).superRefine((record, ctx) => {
  try { parseParticipationRecord(record); }
  catch (error) { ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Registro inconsistente.' }); }
});

export const participationSourceSchema = z.strictObject({
  id: nonemptyText, entityCode: z.enum(ENTITY_CODES), year: yearSchema,
  url: z.url(), archiveSha256: sha256, member: nonemptyText,
  memberSha256: sha256, dictionarySha256: sha256, downloadedAt: z.string().nullable(),
  rawRows: positiveInteger, totals: z.strictObject(countsShape),
}).superRefine((source, ctx) => {
  try { parseParticipationSource(source); }
  catch (error) { ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Fuente inconsistente.' }); }
});

export const metricDefinitionsSchema = z.strictObject({
  rateUnit: z.literal(METRIC_DEFINITIONS.rateUnit),
  percentageUnit: z.literal(METRIC_DEFINITIONS.percentageUnit),
  comparisonUnit: z.literal(METRIC_DEFINITIONS.comparisonUnit),
  nominalDenominator: z.literal(METRIC_DEFINITIONS.nominalDenominator),
  ccpcDenominator: z.literal(METRIC_DEFINITIONS.ccpcDenominator),
});
export const queryWarningSchema = z.strictObject({ code: nonemptyText, message: nonemptyText });
export type QueryWarning = z.infer<typeof queryWarningSchema>;

export const evidenceSchema = z.strictObject({
  dataset: datasetMetadataSchema,
  matchedRecords: integer,
  matchedSourceRows: integer,
  recordsSha256: sha256,
  sources: z.array(participationSourceSchema),
  contributions: z.array(z.strictObject({ sourceId: nonemptyText, records: positiveInteger, sourceRows: positiveInteger })),
  catalogSources: z.array(z.strictObject({ year: yearSchema, url: z.url() })),
}).superRefine((evidence, ctx) => {
  const sourceMap = new Map(evidence.sources.map(source => [source.id, source]));
  if (sourceMap.size !== evidence.sources.length) ctx.addIssue({ code: 'custom', path: ['sources'], message: 'Fuentes duplicadas.' });
  if (!distinct(evidence.contributions.map(item => item.sourceId))) ctx.addIssue({ code: 'custom', path: ['contributions'], message: 'Contribuciones duplicadas.' });
  let records = 0;
  let rows = 0;
  for (const source of evidence.sources) {
    if (!evidence.dataset.years.includes(source.year)) {
      ctx.addIssue({ code: 'custom', path: ['sources'], message: 'Una fuente pertenece a un año ajeno al conjunto.' });
    }
  }
  for (const contribution of evidence.contributions) {
    const source = sourceMap.get(contribution.sourceId);
    if (!source || contribution.sourceRows > source.rawRows) {
      ctx.addIssue({ code: 'custom', path: ['contributions'], message: 'Contribución sin fuente o superior al universo original.' });
    }
    records += contribution.records;
    rows += contribution.sourceRows;
  }
  if (!Number.isSafeInteger(records) || records !== evidence.matchedRecords || !Number.isSafeInteger(rows) || rows !== evidence.matchedSourceRows) {
    ctx.addIssue({ code: 'custom', message: 'Las contribuciones no conservan los registros y filas consultados.' });
  }
  if (!distinct(evidence.catalogSources.map(source => source.year))) ctx.addIssue({ code: 'custom', path: ['catalogSources'], message: 'Años de catálogo duplicados.' });
  for (const source of evidence.catalogSources) {
    if (source.url !== officialSourceUrl(source.year)) ctx.addIssue({ code: 'custom', path: ['catalogSources'], message: 'URL no oficial para el año.' });
  }
});
export type Evidence = z.infer<typeof evidenceSchema>;

const commonShape = {
  filters: participationFiltersSchema,
  status: z.enum(['ok', 'no_data']),
  evidence: evidenceSchema,
  warnings: z.array(queryWarningSchema),
  units: metricDefinitionsSchema,
};

export const participationSummarySchema = z.strictObject({
  query: z.literal('getParticipationSummary'), ...commonShape,
  totals: participationTotalsSchema.nullable(),
}).superRefine((result, ctx) => {
  const empty = result.evidence.matchedRecords === 0;
  if ((result.status === 'no_data') !== empty || (result.totals === null) !== empty) {
    ctx.addIssue({ code: 'custom', message: 'status, totals y número de registros deben coincidir.' });
  }
});
export type SummaryResult = z.infer<typeof participationSummarySchema>;

export const participationBreakdownSchema = z.strictObject({
  query: z.literal('getParticipationBreakdown'), ...commonShape,
  dimension: z.enum(BREAKDOWN_DIMENSIONS),
  groups: z.array(z.strictObject({ value: nonemptyText, label: nonemptyText, summary: participationSummarySchema })),
}).superRefine((result, ctx) => {
  if ((result.status === 'no_data') !== (result.evidence.matchedRecords === 0) || (result.groups.length === 0) !== (result.status === 'no_data')) {
    ctx.addIssue({ code: 'custom', message: 'status y grupos deben coincidir con la evidencia.' });
  }
  if (!distinct(result.groups.map(group => group.value))) ctx.addIssue({ code: 'custom', path: ['groups'], message: 'Valores de desglose duplicados.' });
  const count = result.groups.reduce((sum, group) => sum + group.summary.evidence.matchedRecords, 0);
  const rows = result.groups.reduce((sum, group) => sum + group.summary.evidence.matchedSourceRows, 0);
  if (count !== result.evidence.matchedRecords || rows !== result.evidence.matchedSourceRows) {
    ctx.addIssue({ code: 'custom', path: ['groups'], message: 'Los grupos no conservan los registros o filas consultados.' });
  }
});
export type BreakdownResult = z.infer<typeof participationBreakdownSchema>;

export const supportingRecordsSchema = z.strictObject({
  query: z.literal('getSupportingRecords'), ...commonShape,
  records: z.array(participationRecordSchema),
}).superRefine((result, ctx) => {
  if ((result.status === 'no_data') !== (result.records.length === 0) || result.evidence.matchedRecords !== result.records.length) {
    ctx.addIssue({ code: 'custom', message: 'status y evidencia deben corresponder a los registros.' });
  }
  if (!distinct(result.records.map(participationKey))) ctx.addIssue({ code: 'custom', path: ['records'], message: 'Combinaciones duplicadas.' });
  const rows = result.records.reduce((sum, record) => sum + record.sourceRows, 0);
  if (!Number.isSafeInteger(rows) || rows !== result.evidence.matchedSourceRows) ctx.addIssue({ code: 'custom', path: ['records'], message: 'Los registros no conservan las filas de evidencia.' });
  const sourceIds = new Set(result.evidence.sources.map(source => source.id));
  if (result.records.some(record => !sourceIds.has(record.sourceId))) ctx.addIssue({ code: 'custom', path: ['records'], message: 'Registro sin fuente en la evidencia.' });
  const contributions = new Map<string, { records: number; sourceRows: number }>();
  for (const record of result.records) {
    const matches = (result.filters.year === undefined || result.filters.year === record.year) &&
      (result.filters.entityCodes === undefined || result.filters.entityCodes.includes(record.entityCode)) &&
      (result.filters.sexes === undefined || result.filters.sexes.includes(record.sex)) &&
      (result.filters.ageGroups === undefined || result.filters.ageGroups.includes(record.ageGroup)) &&
      (result.filters.sectionTypes === undefined || result.filters.sectionTypes.includes(record.sectionType));
    if (!matches) ctx.addIssue({ code: 'custom', path: ['records'], message: 'Un registro no cumple los filtros de la respuesta.' });
    const contribution = contributions.get(record.sourceId) ?? { records: 0, sourceRows: 0 };
    contribution.records++;
    contribution.sourceRows += record.sourceRows;
    contributions.set(record.sourceId, contribution);
  }
  if (contributions.size !== result.evidence.contributions.length || result.evidence.contributions.some(contribution => {
    const expected = contributions.get(contribution.sourceId);
    return expected?.records !== contribution.records || expected.sourceRows !== contribution.sourceRows;
  })) ctx.addIssue({ code: 'custom', path: ['evidence', 'contributions'], message: 'Las contribuciones no corresponden a los registros entregados.' });
});
export type SupportingResult = z.infer<typeof supportingRecordsSchema>;

export const electionComparisonSchema = z.strictObject({
  query: z.literal('compareElections'), ...commonShape,
  years: uniqueList(yearSchema), baselineYear: yearSchema,
  elections: z.array(z.strictObject({ year: yearSchema, summary: participationSummarySchema })),
  changes: z.array(z.strictObject({
    year: yearSchema, baselineYear: yearSchema,
    participationPercentagePoints: finiteNullable,
    abstentionPercentagePoints: finiteNullable,
    ccpcParticipationPercentagePoints: finiteNullable,
    ccpcAbstentionPercentagePoints: finiteNullable,
    participationRelativePercent: finiteNullable,
  })),
}).superRefine((result, ctx) => {
  if (result.years.length < 2 || result.years.some((year, index) => index > 0 && year <= result.years[index - 1]) || result.baselineYear !== result.years[0]) {
    ctx.addIssue({ code: 'custom', path: ['years'], message: 'Comparar requiere al menos dos años únicos ascendentes y la base debe ser el primero.' });
  }
  if (result.elections.length !== result.years.length || result.elections.some((election, index) => election.year !== result.years[index])) {
    ctx.addIssue({ code: 'custom', path: ['elections'], message: 'Se requiere un resumen ordenado por cada año solicitado.' });
  }
  if (result.changes.length !== result.years.length - 1 || result.changes.some((change, index) => change.year !== result.years[index + 1] || change.baselineYear !== result.baselineYear)) {
    ctx.addIssue({ code: 'custom', path: ['changes'], message: 'Se requiere un cambio por año posterior respecto al año base.' });
  }
  if ((result.status === 'no_data') !== (result.evidence.matchedRecords === 0)) ctx.addIssue({ code: 'custom', message: 'status debe coincidir con la evidencia.' });
  const totalRecords = result.elections.reduce((sum, election) => sum + election.summary.evidence.matchedRecords, 0);
  const totalRows = result.elections.reduce((sum, election) => sum + election.summary.evidence.matchedSourceRows, 0);
  if (totalRecords !== result.evidence.matchedRecords || totalRows !== result.evidence.matchedSourceRows) {
    ctx.addIssue({ code: 'custom', path: ['elections'], message: 'Los años no conservan los registros o filas consultados.' });
  }
  for (const election of result.elections) {
    if (election.summary.filters.year !== election.year) ctx.addIssue({ code: 'custom', path: ['elections'], message: 'Cada resumen debe estar filtrado por el año declarado.' });
  }
  const baseline = result.elections.find(election => election.year === result.baselineYear)?.summary.totals;
  for (const [index, change] of result.changes.entries()) {
    const current = result.elections.find(election => election.year === change.year)?.summary.totals;
    const point = (field: 'participationPct' | 'abstentionPct' | 'ccpcParticipationPct' | 'ccpcAbstentionPct') => {
      const left = current?.[field] ?? null;
      const right = baseline?.[field] ?? null;
      return left === null || right === null ? null : percentagePointDifference(left, right);
    };
    const currentPct = current?.participationPct ?? null;
    const baselinePct = baseline?.participationPct ?? null;
    const expected = {
      participationPercentagePoints: point('participationPct'),
      abstentionPercentagePoints: point('abstentionPct'),
      ccpcParticipationPercentagePoints: point('ccpcParticipationPct'),
      ccpcAbstentionPercentagePoints: point('ccpcAbstentionPct'),
      participationRelativePercent: currentPct === null || baselinePct === null ? null : relativePercentageChange(currentPct, baselinePct),
    };
    for (const field of Object.keys(expected) as Array<keyof typeof expected>) {
      if (change[field] !== expected[field]) ctx.addIssue({ code: 'custom', path: ['changes', index, field], message: 'El cambio no corresponde a los porcentajes y al año base.' });
    }
  }
});
export type ComparisonResult = z.infer<typeof electionComparisonSchema>;
