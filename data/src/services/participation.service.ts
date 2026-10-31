import { createHash } from 'node:crypto';
import {
  AGE_GROUPS, ALLOWED_YEARS, CivicParticipationError, METRIC_DEFINITIONS, SECTION_TYPES, SEXES,
  calculateMetrics, officialSourceUrl, percentagePointDifference, relativePercentageChange,
} from '../domain/civic/participation.ts';
import type { Counts, ParticipationRecord, ParticipationSource } from '../domain/civic/participation.ts';
import {
  BREAKDOWN_DIMENSIONS, datasetMetadataSchema, electionComparisonSchema, evidenceSchema, parseParticipationFilters,
  participationBreakdownSchema, participationSummarySchema, supportingRecordsSchema,
} from '../application/ports/participation-data.ts';
import type {
  AgeGroup, BreakdownDimension, BreakdownResult, ComparisonResult, EntityCode, Evidence,
  ParticipationDataPort, ParticipationFilters, QueryWarning, SectionType, Sex, SummaryResult,
  SupportingResult, Year,
} from '../application/ports/participation-data.ts';

/** Canonical evidence digest uses the same ordered JSON representation as DATA-02. */
function recordsHash(records: readonly ParticipationRecord[]): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, canonical(child)]));
    return value;
  };
  return createHash('sha256').update(JSON.stringify(canonical(records), null, 2) + '\n').digest('hex');
}
function addSafe(left: number, right: number): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) throw new CivicParticipationError('COUNT_OVERFLOW', 'La suma consultada excede el rango entero seguro.');
  return sum;
}
function countRecords(records: readonly ParticipationRecord[]): Counts {
  const result: Counts = { nominalList: 0, voted: 0, didNotVote: 0, unspecified: 0 };
  for (const record of records) for (const field of ['nominalList', 'voted', 'didNotVote', 'unspecified'] as const) result[field] = addSafe(result[field], record[field]);
  return result;
}
function sortedWarnings(warnings: QueryWarning[]): QueryWarning[] {
  return [...new Map(warnings.map(warning => [warning.code, warning])).values()]
    .sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
}
function normalizedYears(input: readonly Year[]): Year[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > ALLOWED_YEARS.length ||
      new Set(input).size !== input.length || [...input].some(year => !(ALLOWED_YEARS as readonly number[]).includes(year))) {
    throw new CivicParticipationError('INVALID_COMPARISON_YEARS', 'Se requieren entre dos y seis años electorales únicos documentados.');
  }
  return [...input].sort((a, b) => a - b);
}

/** No I/O or model calls: every result depends only on the injected snapshot and arguments. */
export function createParticipationService(data: ParticipationDataPort) {
  const metadata = datasetMetadataSchema.parse(data.metadata);
  function resolveFilters(input: ParticipationFilters) {
    const parsed = parseParticipationFilters(input);
    const defaulted = parsed.year === undefined;
    return { filters: parseParticipationFilters({ ...parsed, year: parsed.year ?? metadata.years.at(-1)! }), defaulted };
  }
  function evidence(records: readonly ParticipationRecord[], sources: readonly ParticipationSource[], years: readonly Year[]): Evidence {
    const grouped = new Map<string, { sourceId: string; records: number; sourceRows: number }>();
    let matchedSourceRows = 0;
    for (const record of records) {
      const contribution = grouped.get(record.sourceId) ?? { sourceId: record.sourceId, records: 0, sourceRows: 0 };
      contribution.records = addSafe(contribution.records, 1);
      contribution.sourceRows = addSafe(contribution.sourceRows, record.sourceRows);
      grouped.set(record.sourceId, contribution);
      matchedSourceRows = addSafe(matchedSourceRows, record.sourceRows);
    }
    return evidenceSchema.parse({
      dataset: metadata, matchedRecords: records.length, matchedSourceRows, recordsSha256: recordsHash(records),
      sources: [...sources].sort((a, b) => a.year - b.year || Number(a.entityCode) - Number(b.entityCode)),
      contributions: [...grouped.values()].sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0),
      catalogSources: [...years].sort((a, b) => a - b).map(year => ({ year, url: officialSourceUrl(year) })),
    });
  }
  function warnings(filters: ParticipationFilters, records: readonly ParticipationRecord[], years: readonly Year[], defaulted = false): QueryWarning[] {
    const output: QueryWarning[] = [];
    const add = (code: string, message: string) => output.push({ code, message });
    if (metadata.kind === 'sample') add('SAMPLE_DATA', 'Muestra reducida de grupos completos; sus sumas no representan el total estatal o nacional.');
    if (defaulted) add('DEFAULT_YEAR_SELECTED', `Se utilizó el último año disponible del dataset: ${years[0]}.`);
    if (years.some(year => !metadata.years.includes(year))) add('YEAR_NOT_AVAILABLE', 'El dataset cargado no contiene todos los años solicitados; no se imputan resultados.');
    if (!records.length) add('NO_MATCHING_RECORDS', 'No hay grupos observados para estos filtros; ausencia de filas no significa participación cero.');
    if (filters.sexes?.includes('no_binario') && years.some(year => year !== 2024)) add('NON_BINARY_UNAVAILABLE', 'La categoría no_binario no está documentada antes de 2024; su ausencia no es una observación de cero.');
    if (records.some(record => record.unspecified > 0)) add('NS_EXCLUDED_FROM_CCPC', 'NS se conserva separado de NV. Los porcentajes nominales usan LN y los oficiales CCPC usan SV+NV.');
    if (records.some(record => record.nominalList > 0 && record.nominalList < 5)) add('SMALL_CELLS', 'La selección contiene grupos con LN entre 1 y 4; la agregación no certifica anonimato absoluto.');
    if (years.length > 1) {
      add('ELECTIONS_NOT_A_PANEL', 'Cada elección tiene su propio universo y contexto; los conteos no representan un panel de las mismas personas ni prueban causas.');
      if (years.includes(2024) && years.some(year => year !== 2024)) {
        add('CARTOGRAPHIC_FRAMES_DIFFER', 'Los ZIP 2009–2021 describen marcos DERFE 2021 y el de 2024 DERFE 2023; entidad no acredita equivalencia de distrito o sección.');
        if (filters.sectionTypes) add('SECTION_TYPES_MAY_CHANGE', 'La clasificación urbana/mixta/rural procede de marcos distintos; el filtro no garantiza las mismas secciones a través del tiempo.');
        if (!filters.sexes || filters.sexes.includes('no_binario')) add('SEX_CATEGORIES_CHANGED', '2024 incorpora no_binario; los cortes anteriores no documentan esa categoría.');
      }
      const names = new Map<string, Set<string>>();
      for (const record of records) { const labels = names.get(record.entityCode) ?? new Set<string>(); labels.add(record.entityName); names.set(record.entityCode, labels); }
      if ([...names.values()].some(labels => labels.size > 1)) add('ENTITY_LABEL_CHANGED', 'Se conservaron nombres históricos distintos para una misma clave de entidad; la unión usa la clave INE.');
    }
    return sortedWarnings(output);
  }
  function summarize(filters: ParticipationFilters, records: readonly ParticipationRecord[], defaulted = false): SummaryResult {
    const counts = records.length ? countRecords(records) : null;
    const year = filters.year!;
    return participationSummarySchema.parse({
      query: 'getParticipationSummary', filters, status: records.length ? 'ok' : 'no_data',
      totals: counts === null ? null : { ...counts, ...calculateMetrics(counts) },
      evidence: evidence(records, data.selectSources(filters), [year]), warnings: warnings(filters, records, [year], defaulted), units: METRIC_DEFINITIONS,
    });
  }
  function getParticipationSummary(input: ParticipationFilters = {}): SummaryResult {
    const { filters, defaulted } = resolveFilters(input);
    return summarize(filters, data.selectRecords(filters), defaulted);
  }
  function getSupportingRecords(input: ParticipationFilters = {}): SupportingResult {
    const { filters, defaulted } = resolveFilters(input), records = data.selectRecords(filters);
    return supportingRecordsSchema.parse({ query: 'getSupportingRecords', filters, status: records.length ? 'ok' : 'no_data', records,
      evidence: evidence(records, data.selectSources(filters), [filters.year!]), warnings: warnings(filters, records, [filters.year!], defaulted), units: METRIC_DEFINITIONS });
  }
  function getParticipationBreakdown(input: ParticipationFilters, dimension: BreakdownDimension): BreakdownResult {
    if (!(BREAKDOWN_DIMENSIONS as readonly string[]).includes(dimension)) throw new CivicParticipationError('INVALID_BREAKDOWN_DIMENSION', 'Dimensión de desglose no permitida.');
    const { filters, defaulted } = resolveFilters(input), records = data.selectRecords(filters);
    const key = (record: ParticipationRecord): string => {
      if (dimension === 'entity') return record.entityCode;
      if (dimension === 'year') return String(record.year);
      return record[dimension];
    };
    const grouped = new Map<string, ParticipationRecord[]>();
    for (const record of records) { const group = grouped.get(key(record)) ?? []; group.push(record); grouped.set(key(record), group); }
    const orderedValues = [...grouped.keys()].sort((a, b) => {
      if (dimension === 'entity' || dimension === 'year') return Number(a) - Number(b);
      const values: readonly string[] = dimension === 'sex' ? SEXES : dimension === 'ageGroup' ? AGE_GROUPS : SECTION_TYPES;
      return values.indexOf(a) - values.indexOf(b);
    });
    const groups = orderedValues.map(value => {
      const rows = grouped.get(value)!;
      const groupFilters: ParticipationFilters = dimension === 'entity' ? { ...filters, entityCodes: [value as EntityCode] }
        : dimension === 'year' ? { ...filters, year: Number(value) as Year }
        : dimension === 'sex' ? { ...filters, sexes: [value as Sex] }
        : dimension === 'ageGroup' ? { ...filters, ageGroups: [value as AgeGroup] }
        : { ...filters, sectionTypes: [value as SectionType] };
      return { value, label: dimension === 'entity' ? rows[0].entityName : value, summary: summarize(groupFilters, rows) };
    });
    return participationBreakdownSchema.parse({ query: 'getParticipationBreakdown', filters, dimension, status: records.length ? 'ok' : 'no_data', groups,
      evidence: evidence(records, data.selectSources(filters), [filters.year!]), warnings: warnings(filters, records, [filters.year!], defaulted), units: METRIC_DEFINITIONS });
  }
  function compareElections(input: ParticipationFilters, requestedYears: readonly Year[]): ComparisonResult {
    const filters = parseParticipationFilters(input);
    if (filters.year !== undefined) throw new CivicParticipationError('CONFLICTING_YEAR_FILTER', 'compareElections recibe los años en years; omita filters.year.');
    const years = normalizedYears(requestedYears), baselineYear = years[0];
    const selected = years.map(year => ({ year, records: data.selectRecords({ ...filters, year }) }));
    const elections = selected.map(({ year, records }) => ({ year, summary: summarize({ ...filters, year }, records) }));
    const baseline = elections[0].summary.totals;
    const changes = elections.slice(1).map(({ year, summary }) => {
      const current = summary.totals;
      const points = (field: 'participationPct' | 'abstentionPct' | 'ccpcParticipationPct' | 'ccpcAbstentionPct'): number | null => {
        const left = current?.[field] ?? null, right = baseline?.[field] ?? null;
        return left === null || right === null ? null : percentagePointDifference(left, right);
      };
      const left = current?.participationPct ?? null, right = baseline?.participationPct ?? null;
      return { year, baselineYear, participationPercentagePoints: points('participationPct'), abstentionPercentagePoints: points('abstentionPct'),
        ccpcParticipationPercentagePoints: points('ccpcParticipationPct'), ccpcAbstentionPercentagePoints: points('ccpcAbstentionPct'),
        participationRelativePercent: left === null || right === null ? null : relativePercentageChange(left, right) };
    });
    const records = selected.flatMap(item => item.records), sourceMap = new Map<string, ParticipationSource>();
    for (const year of years) for (const source of data.selectSources({ ...filters, year })) sourceMap.set(source.id, source);
    const combinedWarnings = warnings(filters, records, years);
    for (const election of elections) combinedWarnings.push(...election.summary.warnings);
    return electionComparisonSchema.parse({ query: 'compareElections', filters, years, baselineYear, elections, changes,
      status: records.length ? 'ok' : 'no_data', evidence: evidence(records, [...sourceMap.values()], years), warnings: sortedWarnings(combinedWarnings), units: METRIC_DEFINITIONS });
  }
  return Object.freeze({ getParticipationSummary, compareElections, getParticipationBreakdown, getSupportingRecords });
}
