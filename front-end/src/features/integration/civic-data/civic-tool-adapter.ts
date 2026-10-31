import type { DataRegistryValue } from "@ine/contracts";
import { z } from "zod";
import {
  civicMetadataSchema,
  civicProcessSchema,
  civicSourceSchema,
  civicToolOutputSchemas,
  compareElectionsOutputSchema,
  electionSnapshotSchema,
  legacyParticipationGroupSchema,
  participationBreakdownOutputSchema,
  participationGroupSchema,
  participationSchema,
  participationSummaryOutputSchema,
  participationIsCoherent,
  partyResultSchema,
  supportingRecordSchema,
  supportingRecordsOutputSchema,
  type CivicToolName,
} from "./civic-tool-wire.ts";

export interface CivicToolAdaptation {
  status: "complete" | "partial" | "invalid";
  toolName: CivicToolName;
  data: DataRegistryValue | null;
  issues: readonly string[];
  citizenMessage: string;
}

const MAX_ISSUES = 8;

export function adaptCivicToolOutput(toolName: CivicToolName, input: unknown): CivicToolAdaptation {
  const result = civicToolOutputSchemas[toolName].safeParse(input);
  if (result.success) {
    return {
      status: "complete",
      toolName,
      data: normalizeComplete(toolName, result.data),
      issues: [],
      citizenMessage: "Los datos están listos para construir una vista verificable.",
    };
  }

  const recovered = recoverPartial(toolName, input);
  const issues = result.error.issues.slice(0, MAX_ISSUES).map(formatIssue);
  if (recovered) {
    return {
      status: "partial",
      toolName,
      data: recovered,
      issues,
      citizenMessage: "La fuente respondió parcialmente. Mostramos sólo los campos válidos y señalamos lo que falta.",
    };
  }

  return {
    status: "invalid",
    toolName,
    data: null,
    issues,
    citizenMessage: "No pudimos validar la respuesta de datos. No mostraremos cifras incompletas o fuera de contrato.",
  };
}

function normalizeComplete(toolName: CivicToolName, value: z.infer<(typeof civicToolOutputSchemas)[CivicToolName]>): DataRegistryValue {
  const common = commonData(toolName, value);
  switch (toolName) {
    case "get_participation_summary": {
      const parsed = participationSummaryOutputSchema.parse(value);
      if ("process" in parsed) {
        return { ...common, context: { ...parsed.process, entity: parsed.entity, level: parsed.level }, participation: parsed.participation, results: parsed.results };
      }
      return compactData({
        ...common,
        context: { year: parsed.year, level: parsed.level, scope: parsed.scope, status: parsed.status, filters: parsed.filters },
        totals: parsed.totals ?? undefined,
        composition: parsed.composition,
      });
    }
    case "compare_elections": {
      const parsed = compareElectionsOutputSchema.parse(value);
      if ("office" in parsed) {
        return { ...common, context: { office: parsed.office, entity: parsed.entity, level: parsed.level }, elections: parsed.elections, turnoutChange: parsed.turnoutChange, methodologyNotes: parsed.methodologyNotes };
      }
      const baseline = parsed.elections.find((election) => election.year === parsed.baselineYear);
      const current = [...parsed.elections].reverse().find((election) => election.hasData);
      const currentChange = current
        ? parsed.changes.find((change) => change.year === current.year && change.baselineYear === parsed.baselineYear)
        : undefined;
      return {
        ...common,
        context: { years: parsed.years, baselineYear: parsed.baselineYear, level: parsed.level, scope: parsed.scope, status: parsed.status, filters: parsed.filters },
        elections: parsed.elections,
        changes: parsed.changes,
        ...(baseline && current ? {
          comparison: {
            previousPeriod: baseline.year,
            currentPeriod: current.year,
            previousValue: baseline.participationPct,
            currentValue: current.participationPct,
            difference: currentChange?.participationPoints ?? null,
          },
        } : {}),
        methodologyNotes: parsed.methodologyNotes,
      };
    }
    case "get_participation_breakdown": {
      const parsed = participationBreakdownOutputSchema.parse(value);
      if ("process" in parsed) {
        return compactData({ ...common, context: { ...parsed.process, dimension: parsed.dimension, scope: parsed.scope }, groups: parsed.groups, coverageNote: parsed.coverageNote });
      }
      return compactData({
        ...common,
        context: {
          year: parsed.year,
          dimension: parsed.dimension,
          scope: parsed.scope,
          level: parsed.level,
          status: parsed.status,
          filters: parsed.filters,
        },
        groups: parsed.groups,
        coverageNote: parsed.coverageNote,
      });
    }
    case "get_supporting_records": {
      const parsed = supportingRecordsOutputSchema.parse(value);
      if ("process" in parsed) {
        return { ...common, context: { ...parsed.process, entity: parsed.entity, level: parsed.level }, records: parsed.records };
      }
      return {
        ...common,
        context: { year: parsed.year, level: parsed.level, scope: parsed.scope, status: parsed.status, filters: parsed.filters },
        records: parsed.records,
        recordSummary: { totalRecords: parsed.totalRecords, truncated: parsed.truncated },
        sources: parsed.sources,
      };
    }
  }
  throw new Error("Tool cívica no soportada");
}

function commonData(toolName: CivicToolName, value: { dataType: "OBSERVED"; isSampleData: boolean; source: z.infer<typeof civicSourceSchema>; metadata: z.infer<typeof civicMetadataSchema>; warnings?: Array<{ code: string; message: string }> }): DataRegistryValue {
  const sourceWarnings = value.warnings?.map((warning) => warning.message) ?? [];
  const sampleWarning = "La fuente marcó esta respuesta como datos de ejemplo; no debe presentarse como resultado oficial.";
  return {
    provenance: {
      toolName,
      dataType: value.dataType,
      isSampleData: value.isSampleData,
      queriedAt: value.metadata.queriedAt,
      source: value.source,
      ...(value.metadata.recordsSha256 ? { recordsSha256: value.metadata.recordsSha256 } : {}),
      ...(value.metadata.matchedRecords !== undefined ? { matchedRecords: value.metadata.matchedRecords } : {}),
    },
    warnings: [...new Set(value.isSampleData ? [sampleWarning, ...sourceWarnings] : sourceWarnings)],
    quality: {
      status: value.isSampleData ? "sample" : "complete",
      label: value.isSampleData ? "Muestra de desarrollo; revisa la cobertura antes de interpretar" : "Datos observados de la fuente declarada",
      ...(value.metadata.matchedRecords !== undefined ? { recordCount: value.metadata.matchedRecords } : {}),
      updatedAt: value.metadata.queriedAt,
    },
  };
}

function recoverPartial(toolName: CivicToolName, input: unknown): DataRegistryValue | null {
  if (!isRecord(input)) return null;
  const base = recoverCommon(toolName, input);

  switch (toolName) {
    case "get_participation_summary": {
      const participation = optionalParse(participationSchema, input.participation);
      const results = validArray(input.results, partyResultSchema);
      const process = optionalParse(civicProcessSchema, input.process);
      if (!participation && results.length === 0) return null;
      return compactData({ ...base, context: compactData({ ...(process ?? {}), entity: validString(input.entity), level: validLevel(input.level) }), participation, results: results.length ? results : undefined });
    }
    case "compare_elections": {
      const elections = validArray(input.elections, electionSnapshotSchema);
      const methodologyNotes = validStringArray(input.methodologyNotes, 10);
      if (elections.length === 0) return null;
      return compactData({ ...base, context: compactData({ office: validOffice(input.office), entity: validString(input.entity), level: validLevel(input.level) }), elections, turnoutChange: recoverTurnoutChange(input.turnoutChange), methodologyNotes });
    }
    case "get_participation_breakdown": {
      const groups = [
        ...validArray(input.groups, participationGroupSchema),
        ...validArray(input.groups, legacyParticipationGroupSchema),
      ];
      if (groups.length === 0) return null;
      const year = typeof input.year === "number" && Number.isInteger(input.year) ? input.year : undefined;
      return compactData({
        ...base,
        context: compactData({
          ...(optionalParse(civicProcessSchema, input.process) ?? {}),
          year,
          dimension: validDimension(input.dimension),
          scope: validString(input.scope),
          level: validLevel(input.level),
          status: input.status === "ok" || input.status === "no_data" ? input.status : undefined,
        }),
        groups,
        coverageNote: validString(input.coverageNote),
      });
    }
    case "get_supporting_records": {
      const records = recoverSupportingRecords(input.records);
      if (records.length === 0 || !supportingRecordsAreCoherent(records)) return null;
      return compactData({ ...base, context: compactData({ ...(optionalParse(civicProcessSchema, input.process) ?? {}), entity: validString(input.entity), level: validLevel(input.level) }), records });
    }
  }
  throw new Error("Tool cívica no soportada");
}

const recoverableSupportingRecordSchema = supportingRecordSchema.omit({ recordId: true });

function recoverSupportingRecords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const complete = supportingRecordSchema.safeParse(item);
    if (complete.success) return [complete.data];
    const recoverable = recoverableSupportingRecordSchema.safeParse(item);
    return recoverable.success ? [recoverable.data] : [];
  });
}

function recoverCommon(toolName: CivicToolName, input: Record<string, unknown>): DataRegistryValue {
  const source = optionalParse(civicSourceSchema, input.source);
  const metadata = optionalParse(civicMetadataSchema, input.metadata);
  const isSampleData = typeof input.isSampleData === "boolean" ? input.isSampleData : undefined;
  return compactData({
    provenance: compactData({ toolName, dataType: input.dataType === "OBSERVED" ? input.dataType : undefined, isSampleData, queriedAt: metadata?.queriedAt, source }),
    warnings: isSampleData === true
      ? ["La fuente marcó esta respuesta como datos de ejemplo; no debe presentarse como resultado oficial."]
      : [],
  });
}

function recoverTurnoutChange(value: unknown) {
  if (!isRecord(value)) return undefined;
  const schema = z.object({ fromYear: z.number().int(), toYear: z.number().int(), points: z.number().min(-100).max(100) }).strict();
  return optionalParse(schema, value);
}

function supportingRecordsAreCoherent(records: Array<z.infer<typeof recoverableSupportingRecordSchema>>) {
  const nominalList = records.find((record) => record.field === "nominalList")?.value;
  const totalVotes = records.find((record) => record.field === "totalVotes")?.value;
  const turnout = records.find((record) => record.field === "turnoutPercentage")?.value;
  if (nominalList === undefined || totalVotes === undefined || turnout === undefined) return true;
  return participationIsCoherent(totalVotes, nominalList, turnout);
}

function validArray<T>(value: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

function validStringArray(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, max);
}

function optionalParse<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function validString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function validOffice(value: unknown) {
  return ["presidencia", "senadurias", "diputaciones"].includes(String(value)) ? String(value) : undefined;
}

function validLevel(value: unknown) {
  return value === "nacional" || value === "estatal" ? value : undefined;
}

function validDimension(value: unknown) {
  return value === "entidad" || value === "sexo" || value === "grupo_edad" || value === "tipo_seccion" ? value : undefined;
}

function compactData(input: Record<string, unknown>): DataRegistryValue {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as DataRegistryValue;
}

function formatIssue(issue: z.ZodIssue) {
  const path = issue.path.length > 0 ? issue.path.join(".") : "respuesta";
  return `${path}: ${issue.message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
