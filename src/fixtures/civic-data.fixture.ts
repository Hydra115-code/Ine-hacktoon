import { createHash } from "node:crypto";
import {
  CCPC_AGE_GROUPS,
  CCPC_SECTION_TYPES,
  CCPC_SEXES,
  type BreakdownData,
  type CcpcBreakdownDimension,
  type CcpcFilters,
  type CcpcYear,
  type CivicDataSource,
  type ComparisonData,
  type DataEvidence,
  type DataWarning,
  type ParticipationTotals,
  type SummaryData,
  type SupportingData,
  type SupportingRecord,
} from "../application/ports/civic-data.js";
import { CCPC_SAMPLE_ROWS, CCPC_SAMPLE_SOURCES } from "./ccpc-sample-records.js";

interface SampleRecord {
  year: CcpcYear;
  entityCode: string;
  entityName: string;
  sex: SupportingRecord["sex"];
  ageGroup: SupportingRecord["ageGroup"];
  sectionType: SupportingRecord["sectionType"];
  nominalList: number;
  voted: number;
  didNotVote: number;
  unspecified: number;
  sourceId: string;
  sourceRows: number;
}

const SAMPLE_RECORDS: readonly SampleRecord[] = CCPC_SAMPLE_ROWS.map((row) => ({
  year: row[0] as CcpcYear,
  entityCode: row[1],
  entityName: row[2],
  sex: row[3] as SampleRecord["sex"],
  ageGroup: row[4] as SampleRecord["ageGroup"],
  sectionType: row[5] as SampleRecord["sectionType"],
  nominalList: row[6],
  voted: row[7],
  didNotVote: row[8],
  unspecified: row[9],
  sourceId: row[10],
  sourceRows: row[11],
}));

const WARNINGS = {
  SAMPLE_DATA: "Muestra reducida de grupos completos; sus sumas no representan el total estatal o nacional.",
  NO_MATCHING_RECORDS: "No hay grupos observados para estos filtros; ausencia de filas no significa participación cero.",
  NON_BINARY_UNAVAILABLE: "La categoría no_binario no está documentada antes de 2024; su ausencia no es una observación de cero.",
  NS_EXCLUDED_FROM_CCPC: "NS se conserva separado de NV. Los porcentajes nominales usan LN y los oficiales CCPC usan SV+NV.",
  SMALL_CELLS: "La selección contiene grupos con LN entre 1 y 4; la agregación no certifica anonimato absoluto.",
  ELECTIONS_NOT_A_PANEL: "Cada elección tiene su propio universo y contexto; los conteos no representan un panel de las mismas personas ni prueban causas.",
  CARTOGRAPHIC_FRAMES_DIFFER: "Los ZIP 2009–2021 describen marcos DERFE 2021 y el de 2024 DERFE 2023; entidad no acredita equivalencia de distrito o sección.",
  SECTION_TYPES_MAY_CHANGE: "La clasificación urbana/mixta/rural procede de marcos distintos; el filtro no garantiza las mismas secciones a través del tiempo.",
  SEX_CATEGORIES_CHANGED: "2024 incorpora no_binario; los cortes anteriores no documentan esa categoría.",
  ENTITY_LABEL_CHANGED: "Se conservaron nombres históricos distintos para una misma clave de entidad; la unión usa la clave INE.",
  DEFAULT_YEAR_SELECTED: "Se utilizó el último año disponible del dataset",
} as const;

export class FixtureCivicDataSource implements CivicDataSource {
  constructor(private readonly records: readonly SampleRecord[] = SAMPLE_RECORDS) {}

  async getParticipationSummary(input: CcpcFilters): Promise<SummaryData> {
    const { filters, defaulted } = this.withYear(input);
    const records = this.select(filters);
    return {
      status: records.length ? "ok" : "no_data",
      year: filters.year!,
      totals: records.length ? sumTotals(records) : null,
      warnings: this.warnings(filters, records, [filters.year!], defaulted),
      evidence: this.evidence(records, [filters.year!]),
    };
  }

  async compareElections(input: Omit<CcpcFilters, "year">, years: CcpcYear[]): Promise<ComparisonData> {
    const ordered = [...new Set(years)].sort((left, right) => left - right);
    const elections = ordered.map((year) => {
      const records = this.select({ ...input, year });
      return { year, records, totals: records.length ? sumTotals(records) : null };
    });
    const all = elections.flatMap((election) => election.records);
    const baseline = elections[0]!;
    const points = (current: number | null | undefined, base: number | null | undefined) => (
      current === null || current === undefined || base === null || base === undefined ? null : current - base
    );
    return {
      status: all.length ? "ok" : "no_data",
      elections: elections.map(({ year, totals }) => ({ year, totals })),
      changes: elections.slice(1).map((election) => ({
        year: election.year,
        baselineYear: baseline.year,
        participationPoints: points(election.totals?.participationPct, baseline.totals?.participationPct),
        nominalParticipationPoints: points(election.totals?.nominalParticipationPct, baseline.totals?.nominalParticipationPct),
        abstentionPoints: points(election.totals?.abstentionPct, baseline.totals?.abstentionPct),
      })),
      warnings: this.warnings(input, all, ordered),
      evidence: this.evidence(all, ordered),
    };
  }

  async getParticipationBreakdown(input: CcpcFilters, dimension: CcpcBreakdownDimension): Promise<BreakdownData> {
    const { filters, defaulted } = this.withYear(input);
    const records = this.select(filters);
    const keyOf = (record: SampleRecord) => (dimension === "entity" ? record.entityCode : record[dimension]);
    const order: readonly string[] = dimension === "sex" ? CCPC_SEXES
      : dimension === "ageGroup" ? CCPC_AGE_GROUPS
      : dimension === "sectionType" ? CCPC_SECTION_TYPES
      : [...new Set(records.map(keyOf))].sort((left, right) => Number(left) - Number(right));
    const groups = order.flatMap((value) => {
      const members = records.filter((record) => keyOf(record) === value);
      return members.length ? [{ value, totals: sumTotals(members) }] : [];
    });
    return {
      status: records.length ? "ok" : "no_data",
      year: filters.year!,
      dimension,
      groups,
      warnings: this.warnings(filters, records, [filters.year!], defaulted),
      evidence: this.evidence(records, [filters.year!]),
    };
  }

  async getSupportingRecords(input: CcpcFilters): Promise<SupportingData> {
    const { filters, defaulted } = this.withYear(input);
    const records = this.select(filters);
    const sourceIds = new Set(records.map((record) => record.sourceId));
    return {
      status: records.length ? "ok" : "no_data",
      year: filters.year!,
      records: records.map((record) => ({ ...record, ...metrics(record) })),
      sources: CCPC_SAMPLE_SOURCES
        .filter((source) => sourceIds.has(source.id))
        .map((source) => ({ ...source, year: source.year as CcpcYear })),
      warnings: this.warnings(filters, records, [filters.year!], defaulted),
      evidence: this.evidence(records, [filters.year!]),
    };
  }

  private withYear(filters: CcpcFilters): { filters: CcpcFilters; defaulted: boolean } {
    if (filters.year !== undefined) return { filters, defaulted: false };
    const latest = Math.max(...this.records.map((record) => record.year)) as CcpcYear;
    return { filters: { ...filters, year: latest }, defaulted: true };
  }

  private select(filters: CcpcFilters): SampleRecord[] {
    return this.records.filter((record) => (
      (filters.year === undefined || record.year === filters.year)
      && (!filters.entityCodes || filters.entityCodes.includes(record.entityCode))
      && (!filters.sexes || filters.sexes.includes(record.sex))
      && (!filters.ageGroups || filters.ageGroups.includes(record.ageGroup))
      && (!filters.sectionTypes || filters.sectionTypes.includes(record.sectionType))
    ));
  }

  private warnings(filters: CcpcFilters, records: readonly SampleRecord[], years: readonly CcpcYear[], defaulted = false): DataWarning[] {
    const output: DataWarning[] = [];
    const add = (code: keyof typeof WARNINGS, suffix = "") => output.push({ code, message: `${WARNINGS[code]}${suffix}` });
    add("SAMPLE_DATA");
    if (defaulted) add("DEFAULT_YEAR_SELECTED", `: ${years[0]}.`);
    if (!records.length) add("NO_MATCHING_RECORDS");
    if (filters.sexes?.includes("no_binario") && years.some((year) => year !== 2024)) add("NON_BINARY_UNAVAILABLE");
    if (records.some((record) => record.unspecified > 0)) add("NS_EXCLUDED_FROM_CCPC");
    if (records.some((record) => record.nominalList > 0 && record.nominalList < 5)) add("SMALL_CELLS");
    if (years.length > 1) {
      add("ELECTIONS_NOT_A_PANEL");
      if (years.includes(2024) && years.some((year) => year !== 2024)) {
        add("CARTOGRAPHIC_FRAMES_DIFFER");
        if (filters.sectionTypes) add("SECTION_TYPES_MAY_CHANGE");
        if (!filters.sexes || filters.sexes.includes("no_binario")) add("SEX_CATEGORIES_CHANGED");
      }
      const labels = new Map<string, Set<string>>();
      for (const record of records) labels.set(record.entityCode, (labels.get(record.entityCode) ?? new Set()).add(record.entityName));
      if ([...labels.values()].some((names) => names.size > 1)) add("ENTITY_LABEL_CHANGED");
    }
    return output.sort((left, right) => left.code.localeCompare(right.code));
  }

  private evidence(records: readonly SampleRecord[], years: readonly CcpcYear[]): DataEvidence {
    const urls = years.flatMap((year) => CCPC_SAMPLE_SOURCES.filter((source) => source.year === year).map((source) => source.url));
    return {
      dataset: "sample",
      sourceUrls: [...new Set(urls)],
      recordsSha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
      matchedRecords: records.length,
    };
  }
}

function sumTotals(records: readonly SampleRecord[]): ParticipationTotals {
  const counts = records.reduce((sum, record) => ({
    nominalList: sum.nominalList + record.nominalList,
    voted: sum.voted + record.voted,
    didNotVote: sum.didNotVote + record.didNotVote,
    unspecified: sum.unspecified + record.unspecified,
  }), { nominalList: 0, voted: 0, didNotVote: 0, unspecified: 0 });
  return metrics(counts);
}

function metrics(counts: Pick<ParticipationTotals, "nominalList" | "voted" | "didNotVote" | "unspecified">): ParticipationTotals {
  const classified = counts.voted + counts.didNotVote;
  return {
    nominalList: counts.nominalList,
    voted: counts.voted,
    didNotVote: counts.didNotVote,
    unspecified: counts.unspecified,
    classified,
    participationPct: classified === 0 ? null : (counts.voted / classified) * 100,
    nominalParticipationPct: counts.nominalList === 0 ? null : (counts.voted / counts.nominalList) * 100,
    abstentionPct: classified === 0 ? null : (counts.didNotVote / classified) * 100,
    unspecifiedPct: counts.nominalList === 0 ? null : (counts.unspecified / counts.nominalList) * 100,
  };
}

