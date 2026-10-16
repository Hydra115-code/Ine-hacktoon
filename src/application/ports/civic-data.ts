export const CCPC_YEARS = [2009, 2012, 2015, 2018, 2021, 2024] as const;
export const CCPC_SEXES = ["hombre", "mujer", "no_binario"] as const;
export const CCPC_SECTION_TYPES = ["urbana", "mixta", "rural"] as const;
export const CCPC_AGE_GROUPS = [
  "18-19", "20-24", "25-29", "30-34", "35-39", "40-44",
  "45-49", "50-54", "55-59", "60-64", "65-69", "70-74",
  "75-79", "80-84", "85-89", "90-94", "95-99", "100+",
] as const;
export const CCPC_BREAKDOWN_DIMENSIONS = ["entity", "sex", "ageGroup", "sectionType"] as const;

export type CcpcYear = typeof CCPC_YEARS[number];
export type CcpcSex = typeof CCPC_SEXES[number];
export type CcpcSectionType = typeof CCPC_SECTION_TYPES[number];
export type CcpcAgeGroup = typeof CCPC_AGE_GROUPS[number];
export type CcpcBreakdownDimension = typeof CCPC_BREAKDOWN_DIMENSIONS[number];

export interface CcpcFilters {
  year?: CcpcYear;
  entityCodes?: string[];
  sexes?: CcpcSex[];
  ageGroups?: CcpcAgeGroup[];
  sectionTypes?: CcpcSectionType[];
}

export interface ParticipationTotals {
  nominalList: number;   // LN: lista nominal
  voted: number;         // SV: sí votó
  didNotVote: number;    // NV: no votó
  unspecified: number;   // NS: no especificado
  classified: number;    // SV + NV (denominador oficial CCPC)
  participationPct: number | null;         // 100 × SV / (SV + NV), oficial CCPC
  nominalParticipationPct: number | null;  // 100 × SV / LN
  abstentionPct: number | null;            // 100 × NV / (SV + NV)
  unspecifiedPct: number | null;           // 100 × NS / LN
}

export interface DataWarning {
  code: string;
  message: string;
}

export interface DataEvidence {
  dataset: "sample" | "full";
  sourceUrls: string[];
  recordsSha256: string;
  matchedRecords: number;
}

interface CommonResult {
  status: "ok" | "no_data";
  warnings: DataWarning[];
  evidence: DataEvidence;
}

export interface SummaryData extends CommonResult {
  year: CcpcYear;
  totals: ParticipationTotals | null;
}

export interface ComparisonData extends CommonResult {
  elections: Array<{ year: CcpcYear; totals: ParticipationTotals | null }>;
  changes: Array<{
    year: CcpcYear;
    baselineYear: CcpcYear;
    participationPoints: number | null;
    nominalParticipationPoints: number | null;
    abstentionPoints: number | null;
  }>;
}

export interface BreakdownData extends CommonResult {
  year: CcpcYear;
  dimension: CcpcBreakdownDimension;
  groups: Array<{ value: string; totals: ParticipationTotals }>;
}

export interface SupportingRecord extends ParticipationTotals {
  entityCode: string;
  year: CcpcYear;
  sex: CcpcSex;
  ageGroup: CcpcAgeGroup;
  sectionType: CcpcSectionType;
  sourceId: string;
  sourceRows: number;
}

export interface SupportingData extends CommonResult {
  year: CcpcYear;
  records: SupportingRecord[];
  sources: Array<{ id: string; year: CcpcYear; entityCode: string; url: string; archiveSha256: string }>;
}

export interface CivicDataSource {
  getParticipationSummary(filters: CcpcFilters): Promise<SummaryData>;
  compareElections(filters: Omit<CcpcFilters, "year">, years: CcpcYear[]): Promise<ComparisonData>;
  getParticipationBreakdown(filters: CcpcFilters, dimension: CcpcBreakdownDimension): Promise<BreakdownData>;
  getSupportingRecords(filters: CcpcFilters): Promise<SupportingData>;
}
