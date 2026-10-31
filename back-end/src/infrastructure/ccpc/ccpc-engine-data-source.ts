import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { logger } from "../../config/logger.js";
import {
  type BreakdownData,
  type CcpcBreakdownDimension,
  type CcpcFilters,
  type CcpcYear,
  type CivicDataSource,
  type ComparisonData,
  type DataEvidence,
  type ParticipationTotals,
  type SummaryData,
  type SupportingData,
} from "../../application/ports/civic-data.js";

// El motor de datos CCPC es un módulo aparte (npm, Zod 4): se carga desde CCPC_DATA_DIR con import().
export interface CcpcEngine {
  getParticipationSummary(filters: unknown): unknown;
  compareElections(filters: unknown, years: unknown): unknown;
  getParticipationBreakdown(filters: unknown, dimension: unknown): unknown;
  getSupportingRecords(filters: unknown): unknown;
  getCatalog?(): unknown;
  getDatasetMetadata?(): unknown;
  getRelease?(): unknown;
}

export interface CcpcDatasetDocuments {
  capabilities: unknown;
  dataset: unknown;
  release: unknown;
}

export interface CcpcEngineOptions {
  dataDir: string;
  datasetPath?: string;
}

export const DEFAULT_CCPC_DATASET = "data/ccpc/sample/data02/participation.json";

export async function loadCcpcEngine(options: CcpcEngineOptions): Promise<CcpcEngine> {
  const root = path.resolve(options.dataDir);
  const moduleUrl = (relative: string) => pathToFileURL(path.join(root, relative)).href;
  if (options.datasetPath === "data/ccpc/full/participation.compact.json") {
    const { createFrozenParticipationService } = await import(moduleUrl("src/data/dataset-v1.ts"));
    const service = await createFrozenParticipationService({ root });
    logger.info("Publicación CCPC congelada cargada y verificada", {
      dataset: options.datasetPath,
      version: service.getRelease().datasetVersion,
    });
    return {
      getCatalog: service.getCatalog,
      getDatasetMetadata: service.getDatasetMetadata,
      getRelease: service.getRelease,
      getParticipationSummary: (filters: unknown) => unwrapFrozenResult(
        service.getParticipationSummary(filters),
        { filters, totals: null },
      ),
      compareElections: (filters: unknown, years: unknown) => unwrapFrozenResult(
        service.compareElections(filters, years),
        { filters, elections: [], changes: [] },
      ),
      getParticipationBreakdown: (filters: unknown, dimension: unknown) => unwrapFrozenResult(
        service.getParticipationBreakdown(filters, dimension),
        { filters, dimension, groups: [] },
      ),
      getSupportingRecords: (filters: unknown) => unwrapFrozenResult(
        service.getSupportingRecords(filters),
        { filters, records: [] },
      ),
    };
  }
  const [{ validateFile }, { createParticipationRepository }, { createParticipationService }] = await Promise.all([
    import(moduleUrl("scripts/ccpc/validate-data.ts")),
    import(moduleUrl("src/repositories/participation.repository.ts")),
    import(moduleUrl("src/services/participation.service.ts")),
  ]);
  const datasetFile = path.resolve(root, options.datasetPath ?? DEFAULT_CCPC_DATASET);
  const dataset = await validateFile(datasetFile);
  logger.info("Datos CCPC cargados y validados", { dataset: path.relative(root, datasetFile) });
  return createParticipationService(createParticipationRepository(dataset)) as CcpcEngine;
}

function unwrapFrozenResult(envelope: unknown, emptyResult: Record<string, unknown>): unknown {
  if (!isRecord(envelope)) throw new Error("La publicación CCPC devolvió una respuesta inválida");
  if (isRecord(envelope.result)) return envelope.result;
  if (envelope.status !== "no_data") throw new Error("La publicación CCPC no produjo un resultado válido");

  const release = isRecord(envelope.release) ? envelope.release : {};
  return {
    status: "no_data",
    ...emptyResult,
    warnings: [{
      code: "NO_DATA",
      message: "No hay registros para la combinación de filtros solicitada.",
    }],
    evidence: {
      dataset: { kind: "full" },
      matchedRecords: 0,
      recordsSha256: typeof release.sha256 === "string" ? release.sha256 : "0".repeat(64),
      sources: [],
      catalogSources: [],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class CcpcEngineDataSource implements CivicDataSource {
  private engine: Promise<CcpcEngine> | undefined;

  constructor(private readonly load: () => Promise<CcpcEngine>) {}

  static fromOptions(options: CcpcEngineOptions): CcpcEngineDataSource {
    return new CcpcEngineDataSource(() => loadCcpcEngine(options));
  }

  async initialize(): Promise<CcpcDatasetDocuments> {
    const engine = await this.getEngine();
    if (!engine.getCatalog || !engine.getDatasetMetadata || !engine.getRelease) {
      throw new Error("La fuente CCPC configurada no expone la publicación congelada completa");
    }
    return {
      capabilities: engine.getCatalog(),
      dataset: engine.getDatasetMetadata(),
      release: engine.getRelease(),
    };
  }

  async getParticipationSummary(filters: CcpcFilters): Promise<SummaryData> {
    return mapSummary((await this.getEngine()).getParticipationSummary(filters));
  }

  async compareElections(filters: Omit<CcpcFilters, "year">, years: CcpcYear[]): Promise<ComparisonData> {
    return mapComparison((await this.getEngine()).compareElections(filters, years));
  }

  async getParticipationBreakdown(filters: CcpcFilters, dimension: CcpcBreakdownDimension): Promise<BreakdownData> {
    return mapBreakdown((await this.getEngine()).getParticipationBreakdown(filters, dimension));
  }

  async getSupportingRecords(filters: CcpcFilters): Promise<SupportingData> {
    return mapSupporting((await this.getEngine()).getSupportingRecords(filters));
  }

  private getEngine(): Promise<CcpcEngine> {
    this.engine ??= this.load().catch((error: unknown) => {
      this.engine = undefined;
      throw error;
    });
    return this.engine;
  }
}

const pct = z.number().nullable();
const count = z.number().int().nonnegative();
const RawTotalsSchema = z.object({
  nominalList: count,
  voted: count,
  didNotVote: count,
  unspecified: count,
  classified: count,
  participationPct: pct,
  abstentionPct: pct,
  unspecifiedPct: pct,
  ccpcParticipationPct: pct,
  ccpcAbstentionPct: pct,
});
const RawEvidenceSchema = z.object({
  dataset: z.object({ kind: z.enum(["sample", "full"]) }),
  matchedRecords: count,
  recordsSha256: z.string(),
  sources: z.array(z.object({
    id: z.string(),
    year: z.number().int(),
    entityCode: z.string(),
    url: z.string(),
    archiveSha256: z.string(),
  })),
  catalogSources: z.array(z.object({ year: z.number().int(), url: z.string() })),
});
const RawCommonSchema = z.object({
  status: z.enum(["ok", "no_data"]),
  filters: z.object({ year: z.number().int().optional() }),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
  evidence: RawEvidenceSchema,
});
const RawSummarySchema = RawCommonSchema.extend({ totals: RawTotalsSchema.nullable() });
const RawComparisonSchema = RawCommonSchema.extend({
  elections: z.array(z.object({ year: z.number().int(), summary: RawSummarySchema })),
  changes: z.array(z.object({
    year: z.number().int(),
    baselineYear: z.number().int(),
    participationPercentagePoints: pct,
    abstentionPercentagePoints: pct,
    ccpcParticipationPercentagePoints: pct,
    ccpcAbstentionPercentagePoints: pct,
  })),
});
const RawBreakdownSchema = RawCommonSchema.extend({
  dimension: z.string(),
  groups: z.array(z.object({ value: z.string(), summary: RawSummarySchema })),
});
const RawSupportingSchema = RawCommonSchema.extend({
  records: z.array(RawTotalsSchema.extend({
    entityCode: z.string(),
    year: z.number().int(),
    sex: z.string(),
    ageGroup: z.string(),
    sectionType: z.string(),
    sourceId: z.string(),
    sourceRows: z.number().int().positive(),
  })),
});

export function mapSummary(raw: unknown): SummaryData {
  const result = RawSummarySchema.parse(raw);
  return {
    ...common(result),
    year: result.filters.year as CcpcYear,
    totals: result.totals ? mapTotals(result.totals) : null,
  };
}

export function mapComparison(raw: unknown): ComparisonData {
  const result = RawComparisonSchema.parse(raw);
  return {
    ...common(result),
    elections: result.elections.map((election) => ({
      year: election.year as CcpcYear,
      totals: election.summary.totals ? mapTotals(election.summary.totals) : null,
    })),
    changes: result.changes.map((change) => ({
      year: change.year as CcpcYear,
      baselineYear: change.baselineYear as CcpcYear,
      participationPoints: change.ccpcParticipationPercentagePoints,
      nominalParticipationPoints: change.participationPercentagePoints,
      abstentionPoints: change.ccpcAbstentionPercentagePoints,
    })),
  };
}

export function mapBreakdown(raw: unknown): BreakdownData {
  const result = RawBreakdownSchema.parse(raw);
  return {
    ...common(result),
    year: result.filters.year as CcpcYear,
    dimension: result.dimension as CcpcBreakdownDimension,
    groups: result.groups.flatMap((group) => (
      group.summary.totals ? [{ value: group.value, totals: mapTotals(group.summary.totals) }] : []
    )),
  };
}

export function mapSupporting(raw: unknown): SupportingData {
  const result = RawSupportingSchema.parse(raw);
  return {
    ...common(result),
    year: result.filters.year as CcpcYear,
    records: result.records.map((record) => ({
      ...mapTotals(record),
      entityCode: record.entityCode,
      year: record.year as CcpcYear,
      sex: record.sex as SupportingData["records"][number]["sex"],
      ageGroup: record.ageGroup as SupportingData["records"][number]["ageGroup"],
      sectionType: record.sectionType as SupportingData["records"][number]["sectionType"],
      sourceId: record.sourceId,
      sourceRows: record.sourceRows,
    })),
    sources: result.evidence.sources.map((source) => ({
      id: source.id,
      year: source.year as CcpcYear,
      entityCode: source.entityCode,
      url: source.url,
      archiveSha256: source.archiveSha256,
    })),
  };
}

function mapTotals(totals: z.infer<typeof RawTotalsSchema>): ParticipationTotals {
  return {
    nominalList: totals.nominalList,
    voted: totals.voted,
    didNotVote: totals.didNotVote,
    unspecified: totals.unspecified,
    classified: totals.classified,
    participationPct: totals.ccpcParticipationPct,
    nominalParticipationPct: totals.participationPct,
    abstentionPct: totals.ccpcAbstentionPct,
    unspecifiedPct: totals.unspecifiedPct,
  };
}

function common(result: z.infer<typeof RawCommonSchema>) {
  const evidence: DataEvidence = {
    dataset: result.evidence.dataset.kind,
    sourceUrls: [...new Set(result.evidence.catalogSources.map((source) => source.url))],
    recordsSha256: result.evidence.recordsSha256,
    matchedRecords: result.evidence.matchedRecords,
  };
  return { status: result.status, warnings: result.warnings, evidence };
}
