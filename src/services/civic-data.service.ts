import { logger } from "../config/logger.js";
import {
  type CcpcBreakdownDimension,
  type CcpcFilters,
  type CcpcYear,
  type CivicDataSource,
  type DataEvidence,
  type DataWarning,
  type ParticipationTotals,
} from "../application/ports/civic-data.js";
import { withTimeout } from "../application/with-timeout.js";
import { ENTITIES, entityName, resolveEntityCode } from "../domain/civic-entities.js";
import { FixtureCivicDataSource } from "../fixtures/civic-data.fixture.js";
import {
  CompareElectionsOutputSchema,
  GetParticipationBreakdownOutputSchema,
  GetParticipationSummaryOutputSchema,
  GetSupportingRecordsOutputSchema,
  MAX_SUPPORTING_RECORDS,
  type BreakdownDimension,
  type CompareElectionsInput,
  type CompareElectionsOutput,
  type GetParticipationBreakdownInput,
  type GetParticipationBreakdownOutput,
  type GetParticipationSummaryInput,
  type GetParticipationSummaryOutput,
  type GetSupportingRecordsInput,
  type GetSupportingRecordsOutput,
} from "../schemas/civic.schema.js";

const SOURCE_NAME = "Conteos Censales de Participación Ciudadana (CCPC), INE";
const SAMPLE_NOTE = "Muestra de desarrollo: sus sumas no son totales estatales ni nacionales.";

const DIMENSIONS: Record<BreakdownDimension, CcpcBreakdownDimension> = {
  entidad: "entity",
  sexo: "sex",
  grupo_edad: "ageGroup",
  tipo_seccion: "sectionType",
};

const SEX_LABELS: Record<string, string> = { hombre: "Hombres", mujer: "Mujeres", no_binario: "No binario" };
const SECTION_LABELS: Record<string, string> = { urbana: "Urbana", mixta: "Mixta", rural: "Rural" };

export class CivicDataNotFoundError extends Error {
  constructor(message = "No hay datos para esos filtros.") {
    super(message);
    this.name = "CivicDataNotFoundError";
  }
}

export class CivicInvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CivicInvalidRequestError";
  }
}

interface CivicDataServiceOptions {
  dataSource?: CivicDataSource;
  now?: () => Date;
  timeoutMs?: number;
}

type FilterInput = Pick<GetParticipationSummaryInput, "entities" | "sexes" | "ageGroups" | "sectionTypes">;

export class CivicDataService {
  private readonly dataSource: CivicDataSource;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(options: CivicDataServiceOptions = {}) {
    this.dataSource = options.dataSource ?? new FixtureCivicDataSource();
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async getParticipationSummary(input: GetParticipationSummaryInput): Promise<GetParticipationSummaryOutput> {
    const filters = this.toFilters(input, input.year);
    const data = await this.query(this.dataSource.getParticipationSummary(filters));
    logger.info("Resumen de participación consultado", { year: data.year, status: data.status });
    return GetParticipationSummaryOutputSchema.parse({
      ...this.base(filters, data, data.year),
      year: data.year,
      totals: data.totals ? roundTotals(data.totals) : null,
      composition: data.totals ? composition(data.totals) : [],
    });
  }

  async compareElections(input: CompareElectionsInput): Promise<CompareElectionsOutput> {
    const years = [...new Set(input.years)].sort((left, right) => left - right) as CcpcYear[];
    if (years.length < 2) throw new CivicInvalidRequestError("Para comparar se necesitan al menos dos años distintos.");
    const filters = this.toFilters(input, undefined);
    const data = await this.query(this.dataSource.compareElections(filters, years));
    logger.info("Comparación de elecciones consultada", { years, status: data.status });
    return CompareElectionsOutputSchema.parse({
      ...this.base(filters, data),
      years,
      baselineYear: years[0],
      elections: data.elections.map((election) => ({
        year: election.year,
        hasData: election.totals !== null,
        ...(election.totals ? roundTotals(election.totals) : EMPTY_TOTALS),
      })),
      changes: data.changes.map((change) => ({
        year: change.year,
        baselineYear: change.baselineYear,
        participationPoints: round(change.participationPoints),
        nominalParticipationPoints: round(change.nominalParticipationPoints),
        abstentionPoints: round(change.abstentionPoints),
      })),
      methodologyNotes: [
        "Los cambios están en puntos porcentuales, no en porcentaje de cambio.",
        ...data.warnings
          .filter((warning) => ["ELECTIONS_NOT_A_PANEL", "CARTOGRAPHIC_FRAMES_DIFFER", "SECTION_TYPES_MAY_CHANGE", "SEX_CATEGORIES_CHANGED", "ENTITY_LABEL_CHANGED"].includes(warning.code))
          .map((warning) => warning.message),
      ],
    });
  }

  async getParticipationBreakdown(input: GetParticipationBreakdownInput): Promise<GetParticipationBreakdownOutput> {
    const filters = this.toFilters(input, input.year);
    const data = await this.query(this.dataSource.getParticipationBreakdown(filters, DIMENSIONS[input.dimension]));
    const entityCount = data.groups.length;
    return GetParticipationBreakdownOutputSchema.parse({
      ...this.base(filters, data, data.year),
      year: data.year,
      dimension: input.dimension,
      groups: data.groups.map((group) => ({
        group: groupLabel(input.dimension, group.value),
        value: group.value,
        ...roundTotals(group.totals),
      })),
      coverageNote: input.dimension === "entidad" && entityCount < ENTITIES.length
        ? `Incluye ${entityCount} de ${ENTITIES.length} entidades disponibles en los datos cargados.`
        : undefined,
    });
  }

  async getSupportingRecords(input: GetSupportingRecordsInput): Promise<GetSupportingRecordsOutput> {
    const filters = this.toFilters(input, input.year);
    const data = await this.query(this.dataSource.getSupportingRecords(filters));
    return GetSupportingRecordsOutputSchema.parse({
      ...this.base(filters, data, data.year),
      year: data.year,
      records: data.records.slice(0, MAX_SUPPORTING_RECORDS).map((record) => ({
        entity: entityName(record.entityCode),
        entityCode: record.entityCode,
        year: record.year,
        sex: record.sex,
        ageGroup: record.ageGroup,
        sectionType: record.sectionType,
        ...roundTotals(record),
        sourceId: record.sourceId,
        sourceRows: record.sourceRows,
      })),
      totalRecords: data.records.length,
      truncated: data.records.length > MAX_SUPPORTING_RECORDS,
      sources: data.sources.map((source) => ({
        id: source.id,
        year: source.year,
        entity: entityName(source.entityCode),
        url: source.url,
        archiveSha256: source.archiveSha256,
      })),
    });
  }

  private toFilters(input: FilterInput, year: CcpcYear | undefined): CcpcFilters {
    const entityCodes = input.entities?.map((value) => {
      if (/^nacional$|^todas?(?: las entidades)?$|^mexico \(pais\)$/iu.test(value.trim())) return undefined;
      const code = resolveEntityCode(value);
      if (!code) throw new CivicInvalidRequestError(`No reconozco la entidad "${value}". Usa el nombre de una de las 32 entidades o su clave INE.`);
      return code;
    }).filter((code): code is NonNullable<typeof code> => code !== undefined);
    return {
      ...(year === undefined ? {} : { year }),
      ...(entityCodes && entityCodes.length > 0 ? { entityCodes: [...new Set(entityCodes)].sort() } : {}),
      ...(input.sexes ? { sexes: [...new Set(input.sexes)] } : {}),
      ...(input.ageGroups ? { ageGroups: [...new Set(input.ageGroups)] } : {}),
      ...(input.sectionTypes ? { sectionTypes: [...new Set(input.sectionTypes)] } : {}),
    };
  }

  private base(
    filters: CcpcFilters,
    data: { status: "ok" | "no_data"; warnings: DataWarning[]; evidence: DataEvidence },
    year?: CcpcYear,
  ) {
    const entities = (filters.entityCodes ?? []).map((code) => ({ code, name: entityName(code) }));
    const isSample = data.evidence.dataset === "sample";
    return {
      dataType: "OBSERVED" as const,
      isSampleData: isSample,
      status: data.status,
      level: entities.length > 0 ? "estatal" as const : "nacional" as const,
      scope: entities.length > 0 ? entities.map((entity) => entity.name).join(", ") : "Nacional",
      filters: {
        ...(year === undefined ? {} : { year }),
        entities,
        ...(filters.sexes ? { sexes: filters.sexes } : {}),
        ...(filters.ageGroups ? { ageGroups: filters.ageGroups } : {}),
        ...(filters.sectionTypes ? { sectionTypes: filters.sectionTypes } : {}),
      },
      source: {
        name: isSample ? `${SOURCE_NAME} — muestra de desarrollo` : SOURCE_NAME,
        urls: data.evidence.sourceUrls,
        ...(isSample ? { note: SAMPLE_NOTE } : {}),
      },
      warnings: data.warnings,
      metadata: {
        queriedAt: this.now().toISOString(),
        recordsSha256: data.evidence.recordsSha256,
        matchedRecords: data.evidence.matchedRecords,
      },
    };
  }

  private query<T>(promise: Promise<T>): Promise<T> {
    return withTimeout(promise, this.timeoutMs, "La consulta de datos CCPC");
  }
}

const EMPTY_TOTALS = {
  nominalList: null,
  voted: null,
  didNotVote: null,
  unspecified: null,
  classified: null,
  participationPct: null,
  nominalParticipationPct: null,
  abstentionPct: null,
  unspecifiedPct: null,
};

function roundTotals(totals: ParticipationTotals) {
  return {
    nominalList: totals.nominalList,
    voted: totals.voted,
    didNotVote: totals.didNotVote,
    unspecified: totals.unspecified,
    classified: totals.classified,
    participationPct: round(totals.participationPct),
    nominalParticipationPct: round(totals.nominalParticipationPct),
    abstentionPct: round(totals.abstentionPct),
    unspecifiedPct: round(totals.unspecifiedPct),
  };
}

function composition(totals: ParticipationTotals) {
  const share = (value: number) => (totals.nominalList === 0 ? null : round((value / totals.nominalList) * 100));
  return [
    { category: "Votaron" as const, count: totals.voted, nominalSharePct: share(totals.voted) },
    { category: "No votaron" as const, count: totals.didNotVote, nominalSharePct: share(totals.didNotVote) },
    { category: "No especificado" as const, count: totals.unspecified, nominalSharePct: share(totals.unspecified) },
  ];
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function groupLabel(dimension: BreakdownDimension, value: string): string {
  if (dimension === "entidad") return entityName(value);
  if (dimension === "sexo") return SEX_LABELS[value] ?? value;
  if (dimension === "tipo_seccion") return SECTION_LABELS[value] ?? value;
  return value === "100+" ? "100 años o más" : `${value} años`;
}
