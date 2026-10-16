import { type UiDataSource } from "../../ui/dsl/ui.schema.js";
import { CIVIC_TOOL_NAMES } from "../civic-tool-policy.js";

const CIVIC_TOOLS = new Set<string>(CIVIC_TOOL_NAMES);

export function shapeCivicDataForUi(dataSources: readonly UiDataSource[]): UiDataSource[] {
  const seen = new Set<string>();
  const shaped: UiDataSource[] = [];

  for (const source of dataSources) {
    if (!CIVIC_TOOLS.has(source.toolName) || !isRecord(source.data)) continue;
    const fingerprint = `${source.toolName}:${JSON.stringify(withoutQueryTime(source.data))}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    shaped.push(source);
  }

  return shaped
    .map((source, index) => ({ source, index }))
    .sort((left, right) => (
      levelRank(left.source) - levelRank(right.source) || left.index - right.index
    ))
    .map(({ source }) => source);
}

function levelRank(source: UiDataSource): number {
  const data = source.data as Record<string, unknown>;
  return data.level === "nacional" ? 1 : 0;
}

function withoutQueryTime(data: Record<string, unknown>): Record<string, unknown> {
  const { metadata: _metadata, ...rest } = data;
  return rest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
