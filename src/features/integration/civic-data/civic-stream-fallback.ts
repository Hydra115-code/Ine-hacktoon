import type { DataPatch, DataRegistryValue, UISpecification } from "@ine/contracts";
import { adaptCivicToolOutput, type CivicToolAdaptation } from "./civic-tool-adapter.ts";
import { buildCivicToolUISpecification } from "./civic-tool-ui.ts";
import type { CivicToolName } from "./civic-tool-wire.ts";

export interface CivicStreamFallback {
  adaptation: CivicToolAdaptation;
  data: DataRegistryValue;
  specification: UISpecification;
  sourceKey: string;
}

/**
 * Turns the backend's shared `source_n` representation back into the civic
 * wire semantics consumed by INT-04. This is a representation bridge only:
 * it never creates electoral values or fills missing evidence.
 */
export function createCivicStreamFallback(patch: DataPatch): CivicStreamFallback | null {
  if ((patch.op !== "add" && patch.op !== "update") || !/^source_\d+$/u.test(patch.key)) return null;
  const toolName = identifyCivicTool(patch.value);
  if (!toolName) return null;

  const adaptation = adaptCivicToolOutput(toolName, restoreSharedCivicPercentages(toolName, patch.value));
  if (!adaptation.data) return null;

  return {
    adaptation,
    data: adaptation.data,
    specification: buildCivicToolUISpecification(adaptation),
    sourceKey: patch.key,
  };
}

export function identifyCivicTool(value: unknown): CivicToolName | null {
  if (!isRecord(value)) return null;
  if (Array.isArray(value.results) && isRecord(value.participation)) return "get_participation_summary";
  if (Array.isArray(value.elections) && isRecord(value.turnoutChange)) return "compare_elections";
  if (Array.isArray(value.groups) && typeof value.dimension === "string") return "get_participation_breakdown";
  if (Array.isArray(value.records)) return "get_supporting_records";
  return null;
}

function restoreSharedCivicPercentages(toolName: CivicToolName, value: unknown): unknown {
  if (!isRecord(value)) return value;
  const restored = structuredClone(value);

  if (toolName === "get_participation_summary") {
    restoreFields(recordAt(restored, "participation"), ["turnoutPercentage", "abstentionPercentage"]);
    restoreRows(restored.results, ["percentage"]);
  } else if (toolName === "compare_elections") {
    restoreRows(restored.elections, ["turnoutPercentage"]);
    for (const election of Array.isArray(restored.elections) ? restored.elections : []) {
      if (isRecord(election)) restoreRows(election.results, ["percentage"]);
    }
  } else if (toolName === "get_participation_breakdown") {
    restoreRows(restored.groups, ["turnoutPercentage"]);
  }

  return restored;
}

function restoreRows(value: unknown, fields: readonly string[]) {
  if (!Array.isArray(value)) return;
  for (const row of value) restoreFields(isRecord(row) ? row : undefined, fields);
}

function restoreFields(record: Record<string, unknown> | undefined, fields: readonly string[]) {
  if (!record) return;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "number" && Number.isFinite(value)) record[field] = value * 100;
  }
}

function recordAt(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
