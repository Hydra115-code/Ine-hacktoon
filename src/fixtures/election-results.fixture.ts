/**
 * Datos de ejemplo para desarrollar y probar get_election_results mientras
 * llega el Data Engine con los datos oficiales. Los partidos y las cifras son
 * ficticios a propósito: nunca deben presentarse como resultados reales.
 */
export interface ElectionResultsFixture {
  year: number;
  office: "presidencia" | "senadurias" | "diputaciones";
  entity: string;
  results: Array<{ party: string; votes: number }>;
  nominalList: number;
}

export const SAMPLE_SOURCE_NAME = "Datos de ejemplo (no oficiales)";

export const ELECTION_RESULTS_FIXTURE: readonly ElectionResultsFixture[] = [
  {
    year: 2024,
    office: "presidencia",
    entity: "Nacional",
    results: [
      { party: "Partido A", votes: 30_000_000 },
      { party: "Partido B", votes: 18_000_000 },
      { party: "Partido C", votes: 12_000_000 },
    ],
    nominalList: 98_000_000,
  },
  {
    year: 2024,
    office: "presidencia",
    entity: "Jalisco",
    results: [
      { party: "Partido A", votes: 1_600_000 },
      { party: "Partido B", votes: 1_400_000 },
      { party: "Partido C", votes: 1_000_000 },
    ],
    nominalList: 6_500_000,
  },
  {
    year: 2024,
    office: "presidencia",
    entity: "Nuevo León",
    results: [
      { party: "Partido A", votes: 1_000_000 },
      { party: "Partido B", votes: 750_000 },
      { party: "Partido C", votes: 750_000 },
    ],
    nominalList: 4_300_000,
  },
  {
    year: 2024,
    office: "presidencia",
    entity: "Oaxaca",
    results: [
      { party: "Partido A", votes: 1_080_000 },
      { party: "Partido B", votes: 450_000 },
      { party: "Partido C", votes: 270_000 },
    ],
    nominalList: 3_100_000,
  },
];
