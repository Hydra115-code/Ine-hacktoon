import type { DataRegistryValue, DataValue } from "../data-binding/schemas/data-registry-schema";
import type { UINode } from "../schemas/layout-node";
import { validateUISpecification, type UISpecification } from "../schemas/ui-specification";

const bindingSegmentPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const excludedFieldPattern = /(?:^|_)(?:id|uuid|token|secret|password|user|owner|created|updated|deleted)(?:_|$)|(?:Id|ID|Uuid|UUID|At)$/u;
const MAX_GENERIC_FIELDS = 12;
const MAX_GENERIC_TABLE_COLUMNS = 8;
const MAX_GENERIC_VISUALIZATIONS = 2;
const knownLabels: Record<string, string> = {
  abstention: "Abstención",
  category: "Categoría",
  count: "Cantidad",
  entity: "Entidad",
  nominalList: "Lista nominal",
  participation: "Participación",
  period: "Periodo",
  rate: "Tasa",
  region: "Región",
  source: "Fuente",
  total: "Total",
  value: "Valor",
  votes: "Personas que votaron",
  year: "Año",
};

const metadataFields = new Set(["methodology", "officialUrl", "source", "sourceUrl"]);

function labelFromKey(key: string) {
  const knownLabel = knownLabels[key];
  if (knownLabel) return knownLabel;
  return key
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[_-]+/gu, " ")
    .replace(/^./u, (character) => character.toUpperCase())
    .slice(0, 120);
}

function nodeId(prefix: string, sequence: number) {
  return `${prefix}-${sequence}`;
}

function isSafeField(field: string) {
  return bindingSegmentPattern.test(field) && !excludedFieldPattern.test(field);
}

function isRecord(value: DataValue): value is { [key: string]: DataValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function scalarFormat(value: DataValue) {
  if (typeof value === "number") return "number" as const;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value)) return "date" as const;
  return "text" as const;
}

function collectMetrics(data: DataRegistryValue) {
  const metrics: UINode[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (!isSafeField(key) || metadataFields.has(key)) continue;
    if (value === null || typeof value !== "object") {
      metrics.push({
        type: "metric",
        id: nodeId("fallback-metric", metrics.length + 1),
        label: labelFromKey(key),
        valueBinding: key,
        format: scalarFormat(value),
      });
    } else if (isRecord(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (!isSafeField(childKey) || (childValue !== null && typeof childValue === "object")) continue;
        metrics.push({
          type: "metric",
          id: nodeId("fallback-metric", metrics.length + 1),
          label: labelFromKey(childKey),
          valueBinding: `${key}.${childKey}`,
          format: scalarFormat(childValue),
        });
        if (metrics.length >= MAX_GENERIC_FIELDS) return metrics;
      }
    }
    if (metrics.length >= MAX_GENERIC_FIELDS) return metrics;
  }

  return metrics;
}

function buildCollectionNodes(data: DataRegistryValue) {
  const nodes: UINode[] = [];
  let visualizationCount = 0;

  for (const [key, value] of Object.entries(data)) {
    if (!isSafeField(key) || !Array.isArray(value) || value.length === 0) continue;
    const records = value.filter(isRecord);
    if (records.length !== value.length) continue;

    const fields = [...new Set(records.slice(0, 20).flatMap((record) => Object.keys(record)))]
      .filter(isSafeField)
      .filter((field) => records.some((record) => {
        const fieldValue = record[field];
        return fieldValue === null || ["string", "number", "boolean"].includes(typeof fieldValue);
      }))
      .slice(0, MAX_GENERIC_TABLE_COLUMNS);
    if (fields.length === 0) continue;

    const firstRecord = records[0]!;
    const quantitativeField = fields.find((field) => typeof firstRecord[field] === "number");
    const categoryField = fields.find((field) => typeof firstRecord[field] === "string");
    if (quantitativeField && categoryField && visualizationCount < MAX_GENERIC_VISUALIZATIONS) {
      visualizationCount += 1;
      nodes.push({
        type: "visualization",
        id: nodeId("fallback-visualization", visualizationCount),
        ariaLabel: `Visualización de ${labelFromKey(key)}`,
        mark: "bar",
        dataBinding: key,
        encoding: {
          x: { field: categoryField, type: "nominal" },
          y: { field: quantitativeField, type: "quantitative", format: "number" },
        },
      });
    }

    nodes.push({
      type: "table",
      id: nodeId("fallback-table", nodes.length + 1),
      ariaLabel: `Datos disponibles de ${labelFromKey(key)}`,
      dataBinding: key,
      columns: fields.map((field) => {
        const format = scalarFormat(firstRecord[field] ?? null);
        return { field, label: labelFromKey(field), format };
      }),
      pagination: { pageSize: 10 },
    });
  }

  return nodes;
}

export function buildGenericUISpecification(data: DataRegistryValue): UISpecification | null {
  const metrics = collectMetrics(data);
  const collectionNodes = buildCollectionNodes(data);
  if (metrics.length === 0 && collectionNodes.length === 0) return null;

  const children: UINode[] = [{
    type: "text",
    id: "fallback-explanation",
    content: "La vista solicitada no está disponible. Conservamos y mostramos los datos recuperados en un formato compatible.",
    tone: "secondary",
  }];
  if (metrics.length > 0) {
    children.push({ type: "grid", id: "fallback-metrics", columns: Math.min(metrics.length, 3) as 1 | 2 | 3, gap: "md", children: metrics });
  }
  children.push(...collectionNodes);

  const candidate = {
    version: "1",
    root: { type: "stack", id: "fallback-root", gap: "lg", children },
  };
  const validation = validateUISpecification(candidate);
  return validation.success ? validation.data : null;
}
