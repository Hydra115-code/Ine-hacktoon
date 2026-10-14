import {
  type CivicDataSource,
  type CivicDataSourceInfo,
  type DemographicTurnoutRecord,
  type ProcessResultRecord,
} from "../application/ports/civic-data.js";

/**
 * Datos de ejemplo para desarrollar y probar las tools cívicas mientras llega
 * el Data Engine con los datos oficiales. Los partidos y las cifras son
 * ficticios a propósito: nunca deben presentarse como resultados reales.
 * Las cifras son coherentes entre sí (los grupos suman el total nacional).
 */

export const SAMPLE_SOURCE: CivicDataSourceInfo = {
  name: "Datos de ejemplo (no oficiales)",
  note: "Cifras ficticias para pruebas; se reemplazarán por los datos oficiales.",
};

type ResultSeed = Omit<ProcessResultRecord, "recordId" | "source" | "isSampleData">;
type TurnoutSeed = Omit<DemographicTurnoutRecord, "recordId" | "source" | "isSampleData">;

const RESULT_SEEDS: ResultSeed[] = [
  // Presidencia 2018
  { year: 2018, office: "presidencia", entity: "Nacional", nominalList: 89_000_000, results: [
    { party: "Partido A", votes: 22_000_000 },
    { party: "Partido B", votes: 20_000_000 },
    { party: "Partido C", votes: 14_000_000 },
  ] },
  { year: 2018, office: "presidencia", entity: "Jalisco", nominalList: 5_900_000, results: [
    { party: "Partido A", votes: 1_300_000 },
    { party: "Partido B", votes: 1_500_000 },
    { party: "Partido C", votes: 900_000 },
  ] },
  { year: 2018, office: "presidencia", entity: "Nuevo León", nominalList: 3_900_000, results: [
    { party: "Partido A", votes: 900_000 },
    { party: "Partido B", votes: 800_000 },
    { party: "Partido C", votes: 700_000 },
  ] },
  { year: 2018, office: "presidencia", entity: "Oaxaca", nominalList: 2_850_000, results: [
    { party: "Partido A", votes: 1_000_000 },
    { party: "Partido B", votes: 500_000 },
    { party: "Partido C", votes: 300_000 },
  ] },
  // Presidencia 2024
  { year: 2024, office: "presidencia", entity: "Nacional", nominalList: 98_000_000, results: [
    { party: "Partido A", votes: 30_000_000 },
    { party: "Partido B", votes: 18_000_000 },
    { party: "Partido C", votes: 12_000_000 },
  ] },
  { year: 2024, office: "presidencia", entity: "Jalisco", nominalList: 6_500_000, results: [
    { party: "Partido A", votes: 1_600_000 },
    { party: "Partido B", votes: 1_400_000 },
    { party: "Partido C", votes: 1_000_000 },
  ] },
  { year: 2024, office: "presidencia", entity: "Nuevo León", nominalList: 4_300_000, results: [
    { party: "Partido A", votes: 1_000_000 },
    { party: "Partido B", votes: 750_000 },
    { party: "Partido C", votes: 750_000 },
  ] },
  { year: 2024, office: "presidencia", entity: "Oaxaca", nominalList: 3_100_000, results: [
    { party: "Partido A", votes: 1_080_000 },
    { party: "Partido B", votes: 450_000 },
    { party: "Partido C", votes: 270_000 },
  ] },
];

const TURNOUT_SEEDS: TurnoutSeed[] = [
  // Presidencia 2024, nacional. Cada dimensión suma 98 M de lista nominal y 60 M de votantes.
  { year: 2024, office: "presidencia", entity: "Nacional", dimension: "sexo", group: "Mujeres", nominalList: 50_500_000, voters: 32_300_000 },
  { year: 2024, office: "presidencia", entity: "Nacional", dimension: "sexo", group: "Hombres", nominalList: 47_500_000, voters: 27_700_000 },
  { year: 2024, office: "presidencia", entity: "Nacional", dimension: "grupo_edad", group: "18 a 29 años", nominalList: 26_000_000, voters: 13_000_000 },
  { year: 2024, office: "presidencia", entity: "Nacional", dimension: "grupo_edad", group: "30 a 49 años", nominalList: 38_000_000, voters: 23_500_000 },
  { year: 2024, office: "presidencia", entity: "Nacional", dimension: "grupo_edad", group: "50 a 64 años", nominalList: 21_000_000, voters: 14_700_000 },
  { year: 2024, office: "presidencia", entity: "Nacional", dimension: "grupo_edad", group: "65 años o más", nominalList: 13_000_000, voters: 8_800_000 },
];

export const SAMPLE_PROCESS_RESULTS: readonly ProcessResultRecord[] = RESULT_SEEDS.map((seed) => ({
  ...seed,
  recordId: `EJEMPLO-${seed.year}-${seed.office.toUpperCase()}-${slug(seed.entity)}`,
  source: SAMPLE_SOURCE,
  isSampleData: true,
}));

export const SAMPLE_DEMOGRAPHIC_TURNOUT: readonly DemographicTurnoutRecord[] = TURNOUT_SEEDS.map((seed) => ({
  ...seed,
  recordId: `EJEMPLO-${seed.year}-${seed.office.toUpperCase()}-${slug(seed.entity)}-${slug(seed.group)}`,
  source: SAMPLE_SOURCE,
  isSampleData: true,
}));

/** Implementación del puerto de datos que lee los datos de ejemplo en memoria. */
export class FixtureCivicDataSource implements CivicDataSource {
  constructor(
    private readonly results: readonly ProcessResultRecord[] = SAMPLE_PROCESS_RESULTS,
    private readonly turnout: readonly DemographicTurnoutRecord[] = SAMPLE_DEMOGRAPHIC_TURNOUT,
  ) {}

  async findProcessResult(query: { year: number; office: string; entity: string }) {
    const entity = normalizeName(query.entity);
    return this.results.find((record) => (
      record.year === query.year
      && record.office === query.office
      && normalizeName(record.entity) === entity
    ));
  }

  async listProcessResults(query: { year: number; office: string }) {
    return this.results.filter((record) => record.year === query.year && record.office === query.office);
  }

  async listDemographicTurnout(query: { year: number; office: string; entity: string; dimension: string }) {
    const entity = normalizeName(query.entity);
    return this.turnout.filter((record) => (
      record.year === query.year
      && record.office === query.office
      && record.dimension === query.dimension
      && normalizeName(record.entity) === entity
    ));
  }
}

/** Compara nombres sin importar acentos ni mayúsculas ("nuevo leon" = "Nuevo León"). */
export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-MX").trim();
}

function slug(value: string): string {
  return normalizeName(value).replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "").toUpperCase();
}
