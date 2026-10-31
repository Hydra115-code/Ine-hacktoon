import type { CivicToolName } from "../civic-tool-wire.ts";

const common = {
  dataType: "OBSERVED" as const,
  isSampleData: true,
  source: {
    name: "Fixture sintético de contrato",
    note: "Datos mínimos para probar la forma del payload; no son resultados oficiales.",
  },
  metadata: { queriedAt: "2026-10-15T12:00:00.000Z" },
};

const firstPartyResult = { party: "Opción Alfa", votes: 45, percentage: 100 };

export const participationSummaryContractFixture = {
  ...common,
  process: { year: 2024, office: "presidencia" as const },
  level: "nacional" as const,
  entity: "Escenario nacional",
  results: [firstPartyResult],
  participation: {
    nominalList: 100,
    totalVotes: 45,
    turnoutPercentage: 45,
    abstentionPercentage: 55,
  },
};

export const compareElectionsContractFixture = {
  ...common,
  office: "presidencia" as const,
  level: "nacional" as const,
  entity: "Escenario nacional",
  elections: [
    { year: 2018, nominalList: 100, totalVotes: 45, turnoutPercentage: 45, results: [firstPartyResult] },
    { year: 2024, nominalList: 100, totalVotes: 61, turnoutPercentage: 61, results: [{ party: "Opción Alfa", votes: 61, percentage: 100 }] },
  ],
  turnoutChange: { fromYear: 2018, toYear: 2024, points: 16 },
  methodologyNotes: ["Fixture: diferencia expresada en puntos porcentuales."],
};

export const participationBreakdownContractFixture = {
  ...common,
  process: { year: 2024, office: "presidencia" as const },
  dimension: "entidad" as const,
  scope: "Escenario nacional",
  groups: [
    { group: "Entidad Alfa", nominalList: 100, voters: 67, turnoutPercentage: 67 },
    { group: "Entidad Beta", nominalList: 100, voters: 57, turnoutPercentage: 57 },
  ],
  coverageNote: "Fixture con dos entidades ficticias; no representa cobertura oficial.",
};

export const supportingRecordsContractFixture = {
  ...common,
  process: { year: 2024, office: "presidencia" as const },
  level: "nacional" as const,
  entity: "Escenario nacional",
  records: [
    { recordId: "SYNTHETIC-2024-001", field: "nominalList", label: "Lista nominal", value: 100, kind: "dato_fuente" as const, derivation: "Valor sintético de contrato." },
    { recordId: "SYNTHETIC-2024-001", field: "totalVotes", label: "Personas que votaron", value: 61, kind: "calculado" as const, derivation: "Suma sintética para validar el contrato." },
    { recordId: "SYNTHETIC-2024-001", field: "turnoutPercentage", label: "Participación (%)", value: 61, kind: "calculado" as const, derivation: "61 ÷ 100 × 100." },
  ],
};

export const civicToolContractFixtures = {
  get_participation_summary: participationSummaryContractFixture,
  compare_elections: compareElectionsContractFixture,
  get_participation_breakdown: participationBreakdownContractFixture,
  get_supporting_records: supportingRecordsContractFixture,
} as const satisfies Readonly<Record<CivicToolName, unknown>>;
