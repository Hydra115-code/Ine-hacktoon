import { type UiDataSource } from "../../ui/dsl/ui.schema.js";
import { CIVIC_TOOL_NAMES } from "../civic-tool-policy.js";

const CIVIC_TOOLS = new Set<string>(CIVIC_TOOL_NAMES);
export const AGE_SEX_SOURCE = "derived_age_sex_participation";

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

  const ordered = shaped
    .map((source, index) => ({ source, index }))
    .sort((left, right) => (
      levelRank(left.source) - levelRank(right.source) || left.index - right.index
    ))
    .map(({ source }) => source);
  const ageSex = deriveAgeSexSource(ordered);
  return ageSex ? [...ordered, ageSex] : ordered;
}

function deriveAgeSexSource(sources: readonly UiDataSource[]): UiDataSource | undefined {
  const bySex = (sex: string) => sources.find((source) => {
    const data = source.data as Record<string, unknown>;
    const filters = isRecord(data.filters) ? data.filters : {};
    return source.toolName === "get_participation_breakdown"
      && data.dimension === "grupo_edad"
      && data.status === "ok"
      && Array.isArray(filters.sexes) && filters.sexes.length === 1 && filters.sexes[0] === sex;
  });
  const men = bySex("hombre");
  const women = bySex("mujer");
  if (!men || !women) return undefined;
  const menData = men.data as Record<string, unknown>;
  const womenData = women.data as Record<string, unknown>;
  if (menData.year !== womenData.year || menData.scope !== womenData.scope) return undefined;

  const groups = (data: Record<string, unknown>) => new Map(
    (Array.isArray(data.groups) ? data.groups : []).filter(isRecord).map((group) => [String(group.value), group]),
  );
  const menGroups = groups(menData);
  const womenGroups = groups(womenData);
  const rows = [...menGroups.keys()].filter((age) => womenGroups.has(age)).map((age) => {
    const man = menGroups.get(age)!;
    const woman = womenGroups.get(age)!;
    return {
      ageGroup: age,
      menParticipationPct: man.participationPct ?? null,
      womenParticipationPct: woman.participationPct ?? null,
      menVoted: man.voted,
      menClassified: man.classified,
      womenVoted: woman.voted,
      womenClassified: woman.classified,
    };
  });
  if (rows.length === 0) return undefined;

  const highest = Math.max(0, ...sources.map((source) => Number(/^source-(\d+)$/u.exec(source.id)?.[1] ?? 0)));
  return {
    id: `source-${highest + 1}`,
    toolName: AGE_SEX_SOURCE,
    data: {
      dataType: "OBSERVED",
      isSampleData: menData.isSampleData === true || womenData.isSampleData === true,
      status: "ok",
      level: menData.level,
      scope: menData.scope,
      year: menData.year,
      filters: { entities: isRecord(menData.filters) && Array.isArray(menData.filters.entities) ? menData.filters.entities : [] },
      source: menData.source,
      warnings: [],
      rows,
    },
  };
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
