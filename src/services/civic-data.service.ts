import { logger } from "../config/logger.js";
import {
  type CivicDataSource,
  type ProcessResultRecord,
} from "../application/ports/civic-data.js";
import { withTimeout } from "../application/with-timeout.js";
import { FixtureCivicDataSource, normalizeName } from "../fixtures/civic-data.fixture.js";
import {
  CompareElectionsOutputSchema,
  GetParticipationBreakdownOutputSchema,
  GetParticipationSummaryOutputSchema,
  GetSupportingRecordsOutputSchema,
  type CompareElectionsInput,
  type CompareElectionsOutput,
  type GetParticipationBreakdownInput,
  type GetParticipationBreakdownOutput,
  type GetParticipationSummaryInput,
  type GetParticipationSummaryOutput,
  type GetSupportingRecordsInput,
  type GetSupportingRecordsOutput,
} from "../schemas/civic.schema.js";

const TOTAL_ENTITIES = 32;

/** No hay datos para lo que se pidió (error recuperable: se puede pedir otra cosa). */
export class CivicDataNotFoundError extends Error {
  constructor(message = "No hay datos para el proceso, cargo o entidad solicitados") {
    super(message);
    this.name = "CivicDataNotFoundError";
  }
}

/** La petición tiene sentido de forma, pero no de fondo (por ejemplo, comparar un año consigo mismo). */
export class CivicInvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CivicInvalidRequestError";
  }
}

interface CivicDataServiceOptions {
  dataSource?: CivicDataSource;
  now?: () => Date;
  /** Tiempo máximo de cada consulta a la fuente de datos. */
  timeoutMs?: number;
}

/**
 * Lógica de las 4 tools cívicas: consulta el puerto de datos, calcula
 * porcentajes y arma salidas validadas con Zod. No sabe si los datos vienen
 * de ejemplo o del Data Engine.
 */
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
    const record = await this.requireProcess(input.year, input.office, input.entity);
    const totalVotes = sumVotes(record);
    logger.info("Resumen de participación consultado", { year: record.year, office: record.office, entity: record.entity });

    return GetParticipationSummaryOutputSchema.parse({
      ...this.base(record),
      process: { year: record.year, office: record.office },
      level: levelOf(record.entity),
      entity: record.entity,
      results: partyResults(record),
      participation: {
        nominalList: record.nominalList,
        totalVotes,
        turnoutPercentage: percentage(totalVotes, record.nominalList),
        abstentionPercentage: round2(100 - percentage(totalVotes, record.nominalList)),
      },
    });
  }

  async compareElections(input: CompareElectionsInput): Promise<CompareElectionsOutput> {
    if (input.baseYear === input.compareYear) {
      throw new CivicInvalidRequestError("Para comparar se necesitan dos años distintos.");
    }
    const [first, second] = [input.baseYear, input.compareYear].sort((a, b) => a - b) as [number, number];
    const base = await this.requireProcess(first, input.office, input.entity);
    const compared = await this.requireProcess(second, input.office, input.entity);
    const elections = [base, compared].map((record) => {
      const totalVotes = sumVotes(record);
      return {
        year: record.year,
        nominalList: record.nominalList,
        totalVotes,
        turnoutPercentage: percentage(totalVotes, record.nominalList),
        results: partyResults(record),
      };
    });

    const notes = ["El cambio de participación se expresa en puntos porcentuales, no como porcentaje de cambio."];
    if (base.nominalList !== compared.nominalList) {
      notes.push(
        `La lista nominal cambió de ${base.nominalList} (${base.year}) a ${compared.nominalList} (${compared.year}); `
        + "compara porcentajes, no votos absolutos.",
      );
    }
    if (base.isSampleData || compared.isSampleData) {
      notes.push("Son datos de ejemplo: no deben presentarse como resultados oficiales.");
    }
    logger.info("Comparación de procesos consultada", { office: input.office, entity: base.entity, years: [first, second] });

    return CompareElectionsOutputSchema.parse({
      ...this.base(base, compared.isSampleData),
      office: input.office,
      level: levelOf(base.entity),
      entity: base.entity,
      elections,
      turnoutChange: {
        fromYear: first,
        toYear: second,
        points: round2(elections[1]!.turnoutPercentage - elections[0]!.turnoutPercentage),
      },
      methodologyNotes: notes,
    });
  }

  async getParticipationBreakdown(input: GetParticipationBreakdownInput): Promise<GetParticipationBreakdownOutput> {
    const process = { year: input.year, office: input.office };

    if (input.dimension === "entidad") {
      const records = (await this.query(this.dataSource.listProcessResults(process)))
        .filter((record) => levelOf(record.entity) === "estatal");
      if (records.length === 0) throw new CivicDataNotFoundError();
      const isSample = records.some((record) => record.isSampleData);
      return GetParticipationBreakdownOutputSchema.parse({
        ...this.base(records[0]!, isSample),
        process,
        dimension: "entidad",
        scope: "Nacional",
        groups: records.map((record) => {
          const voters = sumVotes(record);
          return {
            group: record.entity,
            nominalList: record.nominalList,
            voters,
            turnoutPercentage: percentage(voters, record.nominalList),
          };
        }),
        coverageNote: records.length < TOTAL_ENTITIES
          ? `Incluye ${records.length} de ${TOTAL_ENTITIES} entidades disponibles en la fuente.`
          : undefined,
      });
    }

    const records = await this.query(this.dataSource.listDemographicTurnout({
      ...process,
      entity: input.entity,
      dimension: input.dimension,
    }));
    if (records.length === 0) throw new CivicDataNotFoundError();
    logger.info("Desglose de participación consultado", { ...process, dimension: input.dimension, entity: records[0]!.entity });

    return GetParticipationBreakdownOutputSchema.parse({
      ...this.base(records[0]!, records.some((record) => record.isSampleData)),
      process,
      dimension: input.dimension,
      scope: records[0]!.entity,
      groups: records.map((record) => ({
        group: record.group,
        nominalList: record.nominalList,
        voters: record.voters,
        turnoutPercentage: percentage(record.voters, record.nominalList),
      })),
    });
  }

  async getSupportingRecords(input: GetSupportingRecordsInput): Promise<GetSupportingRecordsOutput> {
    const record = await this.requireProcess(input.year, input.office, input.entity);
    const totalVotes = sumVotes(record);

    return GetSupportingRecordsOutputSchema.parse({
      ...this.base(record),
      process: { year: record.year, office: record.office },
      level: levelOf(record.entity),
      entity: record.entity,
      records: [
        ...record.results.map((result) => ({
          recordId: record.recordId,
          field: `votes.${result.party}`,
          label: `Votos de ${result.party}`,
          value: result.votes,
          kind: "dato_fuente" as const,
          derivation: "Dato de la fuente.",
        })),
        {
          recordId: record.recordId,
          field: "nominalList",
          label: "Lista nominal",
          value: record.nominalList,
          kind: "dato_fuente" as const,
          derivation: "Dato de la fuente.",
        },
        {
          recordId: record.recordId,
          field: "totalVotes",
          label: "Votos totales",
          value: totalVotes,
          kind: "calculado" as const,
          derivation: "Suma de los votos de cada partido.",
        },
        {
          recordId: record.recordId,
          field: "turnoutPercentage",
          label: "Participación (%)",
          value: percentage(totalVotes, record.nominalList),
          kind: "calculado" as const,
          derivation: "Votos totales ÷ lista nominal × 100.",
        },
      ],
    });
  }

  private async requireProcess(year: number, office: GetParticipationSummaryInput["office"], entity: string) {
    const record = await this.query(this.dataSource.findProcessResult({ year, office, entity }));
    if (!record) {
      throw new CivicDataNotFoundError(`No hay datos de ${office} ${year} para ${entity}.`);
    }
    return record;
  }

  private query<T>(promise: Promise<T>): Promise<T> {
    return withTimeout(promise, this.timeoutMs, "La consulta de datos cívicos");
  }

  private base(record: { source: ProcessResultRecord["source"]; isSampleData: boolean }, extraSample = false) {
    return {
      dataType: "OBSERVED" as const,
      isSampleData: record.isSampleData || extraSample,
      source: record.source,
      metadata: { queriedAt: this.now().toISOString() },
    };
  }
}

function sumVotes(record: ProcessResultRecord): number {
  return record.results.reduce((sum, result) => sum + result.votes, 0);
}

function partyResults(record: ProcessResultRecord) {
  const total = sumVotes(record);
  return record.results.map((result) => ({
    party: result.party,
    votes: result.votes,
    percentage: percentage(result.votes, total),
  }));
}

function levelOf(entity: string): "nacional" | "estatal" {
  return normalizeName(entity) === "nacional" ? "nacional" : "estatal";
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : round2((part / total) * 100);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
