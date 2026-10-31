import {
  CONTRACT_VERSION,
  dataRegistryContractSchema,
  uiSpecificationSchema,
  type DataRegistry,
  type UISpecification,
  type UINode,
} from "@banorte/contracts";
import {
  type UiDataReference,
  type UiDataSource,
  type UiDocument,
  type UiNode,
} from "../ui/dsl/ui.schema.js";

interface AdapterContext {
  data: Record<string, unknown>;
  nodeIds: Map<string, string>;
  sourceData: Map<string, unknown>;
  usedNodeIds: Set<string>;
  sourceIds: Map<string, string>;
}

export interface SharedUiPayload {
  specification: UISpecification;
  dataRegistry: DataRegistry;
}

export function adaptUiDataSource(source: UiDataSource, sourceOffset = 0): { key: string; value: unknown } {
  return {
    key: toSharedSourceId(source.id, sourceOffset),
    value: normalizeSourceData(source),
  };
}

export function adaptUiPayload(
  document: UiDocument,
  dataSources: UiDataSource[],
  revision = 0,
  sourceOffset = 0,
): SharedUiPayload {
  const sourceIds = new Map(dataSources.map((source) => [source.id, toSharedSourceId(source.id, sourceOffset)]));
  const context: AdapterContext = {
    data: Object.fromEntries(dataSources.map((source) => [
      requireMappedSourceId(source.id, sourceIds),
      normalizeSourceData(source),
    ])),
    nodeIds: new Map(),
    sourceData: new Map(dataSources.map((source) => [source.id, source.data])),
    usedNodeIds: new Set(),
    sourceIds,
  };
  const specification = uiSpecificationSchema.parse({
    version: CONTRACT_VERSION,
    root: adaptNode(document.root, context),
  });
  const dataRegistry = dataRegistryContractSchema.parse({
    version: CONTRACT_VERSION,
    revision,
    data: context.data,
  });

  return { specification, dataRegistry };
}

function toSharedSourceId(sourceId: string, sourceOffset: number): string {
  const match = /^source-(\d+)$/.exec(sourceId);
  if (!match) throw new SharedContractAdapterError("La fuente no tiene un identificador compatible");
  return `source_${Number(match[1]) + sourceOffset}`;
}

const countFields = new Set([
  "classified",
  "count",
  "didNotVote",
  "matchedRecords",
  "nominalList",
  "sourceRows",
  "totalRecords",
  "unspecified",
  "voted",
]);
const percentageFieldPattern = /^(?:percentage|\w*Percentage|\w*Pct)$/u;
const privateFieldPattern = /(?:^|_)(?:id|uuid|token|secret|password|user|owner|idempotency)(?:_|$)|(?:Id|ID|Uuid|UUID)$|^idempotencyKey$/u;

function visualizationFormat(field: string): "percent" | undefined {
  const leaf = field.split(".").at(-1) ?? field;
  return percentageFieldPattern.test(leaf) ? "percent" : undefined;
}

function normalizeSourceData(source: UiDataSource): unknown {
  const normalized = normalizeValues(source.data);
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    const record = normalized as Record<string, unknown>;
    const metadata = isRecord(record.metadata) ? record.metadata : {};
    return {
      ...record,
      dataType: "OBSERVED",
      quality: isRecord(record.quality) ? record.quality : {
        status: record.isSampleData === true ? "sample" : "full",
        label: record.isSampleData === true ? "Datos de muestra" : "Fuente oficial disponible",
        ...(firstFiniteNumber(metadata.matchedRecords, metadata.sourceRows, record.matchedRecords) !== undefined
          ? { recordCount: firstFiniteNumber(metadata.matchedRecords, metadata.sourceRows, record.matchedRecords) }
          : {}),
        ...(typeof metadata.queriedAt === "string" ? { updatedAt: metadata.queriedAt } : {}),
      },
    };
  }
  return { dataType: "OBSERVED", value: normalized };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstFiniteNumber(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function isPrivateField(key: string, container?: string): boolean {
  if (key === "sourceId" || (key === "id" && container === "sources")) return false;
  return privateFieldPattern.test(key);
}

function normalizeValues(value: unknown, field?: string, container?: string): unknown {
  if ((typeof value === "string" || typeof value === "number") && percentageFieldPattern.test(field ?? "")) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number((numeric / 100).toFixed(6)) : value;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeValues(item, undefined, field));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !isPrivateField(key, container))
      .map(([key, item]) => [key, normalizeValues(item, key)]));
  }
  return value;
}

function adaptTableColumn(column: { key: string; label: string }) {
  const field = column.key.split(".").at(-1) ?? column.key;
  if (percentageFieldPattern.test(field)) {
    return { field: column.key, label: column.label, format: "percentage" as const, align: "end" as const };
  }
  if (countFields.has(field) || /(?:Count|count|Points)$/u.test(field)) {
    return { field: column.key, label: column.label, format: "number" as const, align: "end" as const };
  }
  if (/(?:Date|date|At|periodStart|periodEnd)$/u.test(field)) {
    return { field: column.key, label: column.label, format: "date" as const };
  }
  return { field: column.key, label: column.label };
}

function adaptNode(node: UiNode, context: AdapterContext): UINode {
  const id = getNodeId(node.id, context);

  switch (node.type) {
    case "dashboard":
      return { type: "section", id, ariaLabel: node.title, surface: "primary", children: node.children.map((child) => adaptNode(child, context)) };
    case "stack":
      return {
        type: "flex",
        id,
        direction: node.direction === "horizontal" ? "row" : "column",
        gap: "md",
        children: addDataQualityBadge(node.id, node.children.map((child) => adaptNode(child, context)), context),
      };
    case "grid":
      return { type: "grid", id, columns: normalizeColumnCount(node.columnCount), gap: "md", children: node.children.map((child) => adaptNode(child, context)) };
    case "card":
      return { type: "section", id, ariaLabel: node.title ?? "Contenido electoral", surface: "elevated", padding: "md", children: node.children.map((child) => adaptNode(child, context)) };
    case "text":
      if (node.id === "relato") return adaptCivicInsight(node, id, context);
      return node.variant === "title" || node.variant === "subtitle"
        ? { type: "heading", id, content: node.text, level: node.variant === "title" ? 2 : 3 }
        : { type: "text", id, content: node.text, variant: node.variant === "caption" ? "caption" : "body" };
    case "metric":
      if (node.id === "delta") return adaptElectionDelta(node, id, context);
      if (node.id === "participacion") return adaptEvidenceSummary(node, id, context);
      return { type: "metric", id, label: node.label, valueBinding: adaptReference(node.value, context), format: node.format === "percentage" ? "percent" : node.format };
    case "chart":
      if (node.id === "mapa") return adaptMexicoMap(node, id, context);
      if (node.id === "grafica-ranking") return adaptTerritoryRanking(node, id, context);
      if (node.id === "grafica-linea-tiempo") return adaptParticipationTimeline(node, id, context);
      if (node.id === "grafica-grupos") return adaptDemographicBreakdown(node, id, context);
      return adaptChart(node, id, context);
    case "heatmap":
      return {
        type: "visualization",
        id,
        ariaLabel: node.title,
        mark: "heatmap",
        dataBinding: adaptReference(node.data, context),
        encoding: {
          x: { field: node.xKey, type: "nominal", label: node.xLabel },
          y: { field: node.yKey, type: "ordinal", label: node.yLabel },
          value: {
            field: node.valueKey,
            type: "quantitative",
            label: node.valueLabel,
            ...(visualizationFormat(node.valueKey) ? { format: visualizationFormat(node.valueKey) } : {}),
          },
        },
        legend: { show: true, position: "top" },
      };
    case "table":
      if (node.id === "matriz-comparativa") return adaptComparisonMatrix(node, id, context);
      return adaptTable(node, id, context);
    case "form":
      return {
        type: "stack",
        id,
        gap: "md",
        children: [
          { type: "heading", content: node.title, level: 3 },
          ...node.fields.map((field) => adaptField(field, context)),
          { type: "button", id: getNodeId(`${node.id}-submit`, context), label: node.submitLabel, event: "form.submit" },
        ],
      };
    case "filters":
      return {
        type: "stack",
        id,
        gap: "md",
        children: node.fields.map((field) => adaptFilter(field, context)),
      };
    case "tabs":
      return {
        type: "tabs",
        id,
        ariaLabel: "Secciones",
        ...(node.tabs[0] ? { defaultValue: node.tabs[0].id } : {}),
        items: node.tabs.map((tab) => ({ value: tab.id, label: tab.label, children: tab.children.map((child) => adaptNode(child, context)) })),
      };
    case "alert":
      return { type: "alert", id, message: node.text, semanticState: `status.${node.severity}` };
    case "button":
      return { type: "button", id, label: node.label, event: adaptActionName(node.action.type) };
    case "slider":
      return {
        type: "slider",
        id,
        label: node.label,
        event: "simulation.changed",
        min: node.min,
        max: node.max,
        step: node.step,
        initialValue: node.initialValue,
        showValue: node.showValue,
      };
  }
}

function adaptComparisonMatrix(
  node: Extract<UiNode, { type: "table" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const rawSource = context.sourceData.get(node.data.sourceId);
  const source = isRecord(rawSource) ? rawSource : {};
  const rows = rowsAtPath(source, node.data.path);
  const matrixRows = buildComparisonMatrixRows(rows, source);
  if (matrixRows.length === 0) {
    throw new SharedContractAdapterError("La matriz comparativa no contiene dimensiones compatibles");
  }
  const dataBinding = `derived_${id.replaceAll("-", "_")}`;
  context.data[dataBinding] = matrixRows;
  return {
    type: "comparisonMatrix",
    id,
    ariaLabel: `Matriz comparativa. ${node.title}`,
    title: node.title,
    dataBinding,
    rowField: "row",
    columnField: "column",
    valueField: "value",
    valueLabel: "Participación oficial (%)",
    maximumColumns: 8,
    format: "percent",
  };
}

function rowsAtPath(source: Record<string, unknown>, path: string | undefined): Array<Record<string, unknown>> {
  const value = path ? path.split(".").reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, source) : source;
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function buildComparisonMatrixRows(
  rows: Array<Record<string, unknown>>,
  source: Record<string, unknown>,
): Array<{ row: string; column: string; value: number }> {
  if (rows.some((row) => typeof row.ageGroup === "string")) {
    return rows.flatMap((row) => [
      ...(typeof row.menParticipationPct === "number" ? [{ row: String(row.ageGroup), column: "Hombres", value: percentageFraction(row.menParticipationPct) }] : []),
      ...(typeof row.womenParticipationPct === "number" ? [{ row: String(row.ageGroup), column: "Mujeres", value: percentageFraction(row.womenParticipationPct) }] : []),
    ]);
  }
  if (rows.some((row) => typeof row.year === "number" && typeof row.participationPct === "number")) {
    const scope = typeof source.scope === "string" ? source.scope : "Selección";
    return rows.flatMap((row) => typeof row.participationPct === "number"
      ? [{ row: scope, column: String(row.year), value: percentageFraction(row.participationPct) }]
      : []);
  }
  if (rows.some((row) => typeof row.group === "string" && typeof row.participationPct === "number")) {
    const period = typeof source.year === "number" ? String(source.year) : "Participación";
    return rows.flatMap((row) => typeof row.participationPct === "number"
      ? [{ row: String(row.group), column: period, value: percentageFraction(row.participationPct) }]
      : []);
  }
  return [];
}

function percentageFraction(value: number): number {
  return Number((value / 100).toFixed(6));
}

function addDataQualityBadge(rootId: string, children: UINode[], context: AdapterContext): UINode[] {
  if (!rootId.startsWith("composicion-") || context.sourceIds.size === 0) return children;
  const firstSourceId = context.sourceIds.values().next().value as string | undefined;
  if (!firstSourceId) return children;
  return [{
    type: "dataQualityBadge",
    id: getNodeId(`${rootId}-calidad`, context),
    ariaLabel: "Calidad y cobertura de los datos consultados",
    dataBinding: `${firstSourceId}.quality`,
    title: "Cobertura de la consulta",
    statusField: "status",
    labelField: "label",
    recordCountField: "recordCount",
    updatedAtField: "updatedAt",
  }, ...children];
}

function adaptMexicoMap(
  node: Extract<UiNode, { type: "chart" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const dataBinding = adaptReference(node.data, context);
  const valueField = node.series[0]?.key;
  if (!valueField) throw new SharedContractAdapterError("El mapa no contiene una medida");
  return {
    type: "mexicoChoropleth",
    id,
    ariaLabel: `Mapa de México. ${node.title}`,
    title: node.title,
    dataBinding,
    entityCodeField: "value",
    entityNameField: node.categoryKey,
    valueField,
    ...(node.series[0]?.label ? { valueLabel: node.series[0].label } : {}),
    numeratorField: "voted",
    denominatorField: "classified",
    format: "percent",
    selectionEvent: "map.entity_selected",
  };
}

function adaptTerritoryRanking(
  node: Extract<UiNode, { type: "chart" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const valueField = node.series[0]?.key;
  if (!valueField) throw new SharedContractAdapterError("El ranking no contiene una medida");
  return {
    type: "territoryRanking",
    id,
    ariaLabel: `Ranking territorial. ${node.title}`,
    title: node.title,
    dataBinding: adaptReference(node.data, context),
    territoryField: node.categoryKey,
    valueField,
    ...(node.series[0]?.label ? { valueLabel: node.series[0].label } : {}),
    limit: 32,
    order: node.sort === "ascending" ? "ascending" : "descending",
    format: "percent",
  };
}

function adaptParticipationTimeline(
  node: Extract<UiNode, { type: "chart" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const valueField = node.series[0]?.key;
  if (!valueField) throw new SharedContractAdapterError("La serie temporal no contiene una medida");
  return {
    type: "participationTimeline",
    id,
    ariaLabel: node.title,
    title: node.title,
    dataBinding: adaptReference(node.data, context),
    periodField: node.categoryKey,
    valueField,
    ...(node.series[0]?.label ? { valueLabel: node.series[0].label } : {}),
    format: "percent",
    selectionEvent: "timeline.period_selected",
  };
}

function adaptDemographicBreakdown(
  node: Extract<UiNode, { type: "chart" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const valueField = node.series[0]?.key;
  if (!valueField) throw new SharedContractAdapterError("El desglose demográfico no contiene una medida");
  return {
    type: "demographicBreakdown",
    id,
    ariaLabel: node.title,
    title: node.title,
    dataBinding: adaptReference(node.data, context),
    segmentField: node.categoryKey,
    valueField,
    ...(node.series[0]?.label ? { valueLabel: node.series[0].label } : {}),
    order: node.sort === "ascending" ? "ascending" : node.sort === "descending" ? "descending" : "source",
    format: "percent",
  };
}

function adaptElectionDelta(
  node: Extract<UiNode, { type: "metric" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const raw = context.sourceData.get(node.value.sourceId);
  const sourceId = requireSourceId(node.value.sourceId, context);
  const elections = isRecord(raw) && Array.isArray(raw.elections) ? raw.elections.filter(isRecord) : [];
  const changes = isRecord(raw) && Array.isArray(raw.changes) ? raw.changes.filter(isRecord) : [];
  const first = elections.at(0);
  const last = elections.at(-1);
  if (!first || !last) throw new SharedContractAdapterError("El delta electoral requiere dos elecciones");
  const dataBinding = `${sourceId}_${id.replaceAll("-", "_")}`;
  context.data[dataBinding] = normalizeValues({
    previousLabel: String(first.year ?? "Anterior"),
    currentLabel: String(last.year ?? "Actual"),
    previousValue: typeof first.participationPct === "number" ? percentageFraction(first.participationPct) : first.participationPct,
    currentValue: typeof last.participationPct === "number" ? percentageFraction(last.participationPct) : last.participationPct,
    difference: changes.at(-1)?.participationPoints,
  });
  return {
    type: "electionDelta",
    id,
    ariaLabel: "Cambio de participación entre elecciones",
    title: node.label,
    dataBinding,
    previousLabelField: "previousLabel",
    currentLabelField: "currentLabel",
    previousValueField: "previousValue",
    currentValueField: "currentValue",
    differenceField: "difference",
    differenceUnit: "pp",
    format: "percent",
  };
}

function adaptEvidenceSummary(
  node: Extract<UiNode, { type: "metric" }>,
  id: string,
  context: AdapterContext,
): UINode {
  return {
    type: "evidenceSummary",
    id,
    ariaLabel: "Evidencia de la participación calculada",
    title: node.label,
    dataBinding: `${requireSourceId(node.value.sourceId, context)}.totals`,
    numeratorField: "voted",
    denominatorField: "classified",
    resultField: "participationPct",
    numeratorLabel: "Votaron",
    denominatorLabel: "Votaron + no votaron",
    resultLabel: "Participación oficial",
    format: "percent",
  };
}

function adaptCivicInsight(
  node: Extract<UiNode, { type: "text" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const dataBinding = `derived_${id.replaceAll("-", "_")}`;
  context.data[dataBinding] = {
    title: "Lectura ciudadana",
    explanation: node.text,
    source: "CCPC · Instituto Nacional Electoral",
  };
  return {
    type: "civicInsight",
    id,
    ariaLabel: "Explicación ciudadana de los datos",
    dataBinding,
    titleField: "title",
    explanationField: "explanation",
    sourceField: "source",
    tone: "highlight",
  };
}

function adaptTable(
  node: Extract<UiNode, { type: "table" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const rows = resolveSourceRows(node.data, context);
  const dataBinding = node.maxRows < 10
    ? createLimitedCollectionBinding(node.data, node.maxRows, id, context)
    : adaptReference(node.data, context);
  const columns = node.columns.map(adaptTableColumn);

  return {
    type: "table",
    id,
    ariaLabel: node.title,
    dataBinding,
    columns,
    ...(rows.length > 1 ? {
      sorting: { enabled: true },
      filtering: { enabled: true, fields: columns.map((column) => column.field) },
    } : {}),
    pagination: { pageSize: normalizePageSize(node.maxRows) },
  };
}

function createLimitedCollectionBinding(
  reference: UiDataReference,
  maxRows: number,
  nodeId: string,
  context: AdapterContext,
): string {
  const rows = resolveSourceRows(reference, context);
  const dataBinding = `${requireSourceId(reference.sourceId, context)}_${nodeId.replaceAll("-", "_")}_rows`;
  context.data[dataBinding] = normalizeValues(rows.slice(0, maxRows));
  return dataBinding;
}

function adaptChart(
  node: Extract<UiNode, { type: "chart" }>,
  id: string,
  context: AdapterContext,
): UINode {
  const series = node.series[0];
  if (!series) throw new SharedContractAdapterError("La gráfica no contiene series");
  if (node.series.length > 1) {
    return adaptMultiSeriesChart(node, id, context);
  }

  if (node.chartType === "pie") {
    return {
      type: "visualization",
      id,
      ariaLabel: node.title,
      mark: "donut",
      dataBinding: adaptReference(node.data, context),
      encoding: {
        group: { field: node.categoryKey, type: "nominal", label: node.title },
        value: {
          field: series.key,
          type: "quantitative",
          label: series.label,
          ...(visualizationFormat(series.key) ? { format: visualizationFormat(series.key) } : {}),
        },
      },
    };
  }

  return {
    type: "visualization",
    id,
    ariaLabel: node.title,
    mark: node.chartType,
    dataBinding: adaptReference(node.data, context),
    encoding: {
      x: { field: node.categoryKey, type: "nominal" },
      y: {
        field: series.key,
        type: "quantitative",
        label: series.label,
        ...(visualizationFormat(series.key) ? { format: visualizationFormat(series.key) } : {}),
      },
    },
    ...(node.sort ? { sort: { by: "y" as const, direction: node.sort } } : {}),
  };
}

function adaptMultiSeriesChart(
  node: Extract<UiNode, { type: "chart" }>,
  id: string,
  context: AdapterContext,
): UINode {
  if (node.chartType === "pie") {
    throw new SharedContractAdapterError("Una gráfica circular no admite múltiples series");
  }
  const rows = resolveSourceRows(node.data, context);
  const dataBinding = `${requireSourceId(node.data.sourceId, context)}_${id.replaceAll("-", "_")}`;
  context.data[dataBinding] = rows.flatMap((row) => node.series.map((series) => ({
    category: normalizeValues(row[node.categoryKey] ?? "—", node.categoryKey),
    series: series.label,
    value: normalizeValues(row[series.key], series.key),
  })));

  return {
    type: "visualization",
    id,
    ariaLabel: node.title,
    mark: node.chartType === "bar" ? "grouped-bar" : "line",
    dataBinding,
    encoding: {
      x: { field: "category", type: "nominal" },
      y: {
        field: "value",
        type: "quantitative",
        ...(node.series.every((candidate) => visualizationFormat(candidate.key) === "percent") ? { format: "percent" as const } : {}),
      },
      group: { field: "series", type: "nominal" },
    },
    legend: { show: true, position: "top" },
  };
}

function resolveSourceRows(reference: UiDataReference, context: AdapterContext): Array<Record<string, unknown>> {
  let value = context.sourceData.get(reference.sourceId);
  for (const segment of reference.path?.split(".") ?? []) {
    if (Array.isArray(value)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= value.length) {
        throw new SharedContractAdapterError("La interfaz referencia datos incompatibles");
      }
      value = value[index];
      continue;
    }
    if (!value || typeof value !== "object") {
      throw new SharedContractAdapterError("La interfaz referencia datos incompatibles");
    }
    value = (value as Record<string, unknown>)[segment];
  }
  if (!Array.isArray(value) || value.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new SharedContractAdapterError("La interfaz requiere una colección de registros");
  }
  return value as Array<Record<string, unknown>>;
}

function adaptField(
  field: Extract<UiNode, { type: "form" }>["fields"][number],
  context: AdapterContext,
): UINode {
  const id = getNodeId(field.id, context);
  if (field.type === "date") return { type: "datePicker", id, label: field.label, event: "form.value.changed" };
  if (field.type === "select") return { type: "select", id, label: field.label, event: "form.value.changed", options: field.options, required: true, placeholder: "Selecciona una opción", ...(field.initialValue ? { initialValue: field.initialValue } : {}) };
  return { type: "input", id, label: field.label, event: "form.value.changed", placeholder: field.placeholder, validation: { maxLength: field.maxLength }, ...(field.initialValue ? { initialValue: field.initialValue } : {}) };
}

function adaptFilter(
  field: Extract<UiNode, { type: "filters" }>["fields"][number],
  context: AdapterContext,
): UINode {
  const id = getNodeId(field.id, context);
  return field.type === "date-range"
    ? { type: "dateRange", id, label: field.label, event: "filters.value.changed", initialValue: field.initialValue }
    : { type: "select", id, label: field.label, event: "filters.value.changed", options: field.options };
}

function adaptReference(reference: UiDataReference, context: AdapterContext): string {
  const sourceId = requireSourceId(reference.sourceId, context);
  return reference.path ? `${sourceId}.${reference.path}` : sourceId;
}

function requireSourceId(sourceId: string, context: AdapterContext): string {
  return requireMappedSourceId(sourceId, context.sourceIds);
}

function requireMappedSourceId(sourceId: string, sourceIds: Map<string, string>): string {
  const mapped = sourceIds.get(sourceId);
  if (!mapped) throw new SharedContractAdapterError("La interfaz referencia una fuente inexistente");
  return mapped;
}

function getNodeId(originalId: string, context: AdapterContext): string {
  const existing = context.nodeIds.get(originalId);
  if (existing) return existing;
  const normalized = normalizeNodeId(originalId);
  let candidate = normalized;
  let suffix = 2;
  while (context.usedNodeIds.has(candidate)) {
    candidate = `${normalized.slice(0, 61)}-${suffix}`;
    suffix += 1;
  }
  context.nodeIds.set(originalId, candidate);
  context.usedNodeIds.add(candidate);
  return candidate;
}

function normalizeNodeId(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const prefixed = /^[a-z]/.test(normalized) ? normalized : `node-${normalized}`;
  return (prefixed || "node").slice(0, 64).replace(/-+$/g, "");
}

function normalizePageSize(maxRows: number): 10 | 25 | 50 | 100 {
  if (maxRows <= 10) return 10;
  if (maxRows <= 25) return 25;
  if (maxRows <= 50) return 50;
  return 100;
}

function normalizeColumnCount(columnCount: number): 1 | 2 | 3 | 4 {
  if (columnCount === 1 || columnCount === 2 || columnCount === 3) return columnCount;
  return 4;
}

function adaptActionName(action: "refresh" | "apply-filters" | "submit-form" | "select-tab"): string {
  if (action === "refresh") return "ui.refresh";
  return action.replaceAll("-", ".");
}

export class SharedContractAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedContractAdapterError";
  }
}
