import {
  resolveUiDataReference,
  type UiDataSource,
  type UiDocument,
  type UiNode,
} from "../dsl/ui.schema.js";
import { latestUiRequest, type SemanticUiIssue } from "./semantic-ui-validator.js";

interface CivicUiValidationInput {
  query: string;
  answer: string;
  document: UiDocument;
  dataSources: readonly UiDataSource[];
}

const NATIONAL = "nacional";

const TABLE_EXCLUSION_PATTERN =
  /\bsin\s+tablas?\b|\bno\s+(?:me\s+)?(?:muestres|pongas|incluyas|quiero)\s+(?:la\s+|una\s+|ninguna\s+)?tablas?\b|\b(?:s[oó]lo|solamente|nada m[aá]s)\s+(?:la\s+|una\s+|las\s+)?gr[aá]ficas?\b|\bquita\s+(?:la\s+)?tabla\b/iu;

export function validateCivicUi(input: CivicUiValidationInput): SemanticUiIssue[] {
  const sources = input.dataSources.filter((source) => isRecord(source.data));
  if (sources.length === 0) return [];

  const issues: SemanticUiIssue[] = [];
  const nodes = collectNodes(input.document.root);
  const boundSourceIds = new Set(nodes.flatMap(boundSourceId));
  const boundSources = sources.filter((source) => boundSourceIds.has(source.id));

  const wantsNoTables = TABLE_EXCLUSION_PATTERN.test(latestUiRequest(input.query));
  const hasTable = nodes.some((node) => node.type === "table" && isNonEmptyCollection(node, sources));
  const metricPaths = nodes.flatMap((node) => (node.type === "metric" && node.value.path ? [node.value.path] : []));
  const showsBase = metricPaths.some((path) => /(?:^|\.)voted$/u.test(path))
    && metricPaths.some((path) => /(?:^|\.)(?:classified|nominalList)$/u.test(path));
  if (!hasTable && !showsBase && !wantsNoTables) {
    issues.push({
      code: "civic_evidence_required",
      message: "Incluye evidencia verificable: una tabla con las cifras usadas (o los registros de get_supporting_records), o al menos las métricas de votaron y su total junto al porcentaje.",
    });
  }

  for (const node of nodes) {
    if (node.type !== "chart" && node.type !== "table" && node.type !== "heatmap") continue;
    const rows = resolveRows(node, sources);
    const territories = rows.flatMap((row) => territoryNamesOf(row)).map(normalize);
    if (territories.includes(NATIONAL) && territories.some((name) => name !== NATIONAL)) {
      issues.push({
        code: "civic_mixed_levels",
        nodeId: node.id,
        message: "Esta visualización mezcla el total Nacional con entidades. Muéstralos por separado.",
      });
    }
  }

  const knownTerritories = unique(sources.flatMap((source) => coveredTerritories(source.data)));
  const knownYears = unique(sources.flatMap((source) => coveredYears(source.data)));
  const shownTerritories = new Set(boundSources.flatMap((source) => coveredTerritories(source.data)).map(normalize));
  const shownYears = new Set(boundSources.flatMap((source) => coveredYears(source.data)));
  const uiText = nodes.flatMap(visibleText).join(" ");

  const missingTerritories = knownTerritories.filter((territory) => (
    (mentions(input.answer, territory) || mentions(uiText, territory)) && !shownTerritories.has(normalize(territory))
  ));
  const missingYears = knownYears.filter((year) => (
    (new RegExp(`\\b${year}\\b`, "u").test(input.answer) || new RegExp(`\\b${year}\\b`, "u").test(uiText))
    && !shownYears.has(year)
  ));
  if (missingTerritories.length > 0 || missingYears.length > 0) {
    issues.push({
      code: "civic_subset_mismatch",
      message: `La respuesta o los títulos mencionan ${[...missingTerritories, ...missingYears.map(String)].join(", ")}, pero la interfaz no muestra esos datos. Vincula las fuentes de esos territorios o años, o no los menciones.`,
    });
  }

  return issues;
}

function coveredTerritories(data: unknown): string[] {
  if (!isRecord(data)) return [];
  const names: string[] = [];
  if (data.level === "nacional") names.push("Nacional");
  if (isRecord(data.filters) && Array.isArray(data.filters.entities)) {
    for (const entity of data.filters.entities) {
      if (isRecord(entity) && typeof entity.name === "string") names.push(entity.name);
    }
  }
  if (data.dimension === "entidad" && Array.isArray(data.groups)) {
    for (const group of data.groups) {
      if (isRecord(group) && typeof group.group === "string") names.push(group.group);
    }
  }
  if (Array.isArray(data.records)) {
    for (const record of data.records) {
      if (isRecord(record) && typeof record.entity === "string") names.push(record.entity);
    }
  }
  return unique(names);
}

function coveredYears(data: unknown): number[] {
  if (!isRecord(data)) return [];
  const years: number[] = [];
  if (typeof data.year === "number") years.push(data.year);
  if (Array.isArray(data.elections)) {
    for (const election of data.elections) {
      if (isRecord(election) && typeof election.year === "number") years.push(election.year);
    }
  }
  return years;
}

function territoryNamesOf(row: unknown): string[] {
  if (!isRecord(row)) return [];
  return ["entity", "group", "scope"]
    .map((key) => row[key])
    .filter((value): value is string => typeof value === "string");
}

function collectNodes(root: UiNode): UiNode[] {
  const children = root.type === "tabs"
    ? root.tabs.flatMap((tab) => tab.children)
    : "children" in root ? root.children : [];
  return [root, ...children.flatMap(collectNodes)];
}

function boundSourceId(node: UiNode): string[] {
  if (node.type === "metric") return [node.value.sourceId];
  if (node.type === "chart" || node.type === "table" || node.type === "heatmap") return [node.data.sourceId];
  return [];
}

function visibleText(node: UiNode): string[] {
  switch (node.type) {
    case "text":
    case "alert":
      return [node.text];
    case "metric":
      return [node.label];
    case "chart":
    case "table":
    case "heatmap":
      return [node.title];
    case "card":
      return node.title ? [node.title] : [];
    case "dashboard":
      return [node.title];
    default:
      return [];
  }
}

function resolveRows(
  node: Extract<UiNode, { type: "chart" | "table" | "heatmap" }>,
  sources: readonly UiDataSource[],
): unknown[] {
  try {
    const value = resolveUiDataReference(node.data, [...sources]);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function isNonEmptyCollection(
  node: Extract<UiNode, { type: "table" }>,
  sources: readonly UiDataSource[],
): boolean {
  return resolveRows(node, sources).length > 0;
}

function mentions(text: string, name: string): boolean {
  const escaped = normalize(name).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "u").test(normalize(text));
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-MX").trim();
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
