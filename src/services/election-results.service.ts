import { logger } from "../config/logger.js";
import {
  ELECTION_RESULTS_FIXTURE,
  SAMPLE_SOURCE_NAME,
  type ElectionResultsFixture,
} from "../fixtures/election-results.fixture.js";
import {
  GetElectionResultsOutputSchema,
  type GetElectionResultsInput,
  type GetElectionResultsOutput,
} from "../schemas/election-results.schema.js";

export class ElectionDataNotFoundError extends Error {
  constructor() {
    super("No hay datos para el proceso, cargo o entidad solicitados");
    this.name = "ElectionDataNotFoundError";
  }
}

export class ElectionResultsService {
  constructor(
    private readonly records: readonly ElectionResultsFixture[] = ELECTION_RESULTS_FIXTURE,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getResults(input: GetElectionResultsInput): GetElectionResultsOutput {
    const entity = normalize(input.entity);
    const record = this.records.find((candidate) => (
      candidate.year === input.year
      && candidate.office === input.office
      && normalize(candidate.entity) === entity
    ));
    if (!record) throw new ElectionDataNotFoundError();

    const totalVotes = record.results.reduce((sum, result) => sum + result.votes, 0);
    logger.info("Resultados electorales consultados", {
      year: record.year,
      office: record.office,
      entity: record.entity,
    });
    return GetElectionResultsOutputSchema.parse({
      dataType: "OBSERVED",
      isSampleData: true,
      process: { year: record.year, office: record.office },
      level: entity === "nacional" ? "nacional" : "estatal",
      entity: record.entity,
      results: record.results.map((result) => ({
        party: result.party,
        votes: result.votes,
        percentage: percentage(result.votes, totalVotes),
      })),
      participation: {
        nominalList: record.nominalList,
        totalVotes,
        turnoutPercentage: percentage(totalVotes, record.nominalList),
      },
      source: {
        name: SAMPLE_SOURCE_NAME,
        note: "Cifras ficticias para pruebas; se reemplazarán por los datos oficiales.",
      },
      metadata: { queriedAt: this.now().toISOString() },
    });
  }
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 10_000) / 100;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-MX").trim();
}
