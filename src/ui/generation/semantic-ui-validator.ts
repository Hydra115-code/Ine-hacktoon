import {
  resolveUiDataReference,
  type UiDataSource,
  type UiDocument,
  type UiNode,
} from "../dsl/ui.schema.js";

export interface SemanticUiIssue {
  code: string;
  message: string;
  nodeId?: string;
}

export type SemanticUiValidationResult =
  | { success: true; issues: [] }
  | { success: false; issues: SemanticUiIssue[] };

interface ExplicitUiRequirements {
  exactCharts?: number;
  exactMetrics?: number;
  forbidCharts: boolean;
  forbidDashboard: boolean;
  forbidTables: boolean;
  maxCollectionItems?: number;
  requireChart: boolean;
  requireDateRange: boolean;
  requireInteraction: boolean;
  requireSlider: boolean;
  requireNotesField: boolean;
  requireTable: boolean;
}

export function validateUiSemantics(
  query: string,
  document: UiDocument,
  dataSources: UiDataSource[],
): SemanticUiValidationResult {
  const latestRequest = latestUiRequest(query);
  const requirements = extractExplicitUiRequirements(latestRequest);
  const nodes = collectNodes(document.root);
  const issues: SemanticUiIssue[] = [];
  const charts = nodes.filter((node) => node.type === "chart");
  const heatmaps = nodes.filter((node) => node.type === "heatmap");
  const visualizations = [...charts, ...heatmaps];
  const metrics = nodes.filter((node) => node.type === "metric");
  const tables = nodes.filter((node) => node.type === "table");
  if (requirements.forbidDashboard) rejectNodes(nodes, "dashboard", "dashboard_forbidden", "La solicitud excluye dashboards", issues);
  if (requirements.forbidTables) rejectNodes(nodes, "table", "table_forbidden", "La solicitud excluye tablas", issues);
  if (requirements.forbidCharts) {
    rejectNodes(nodes, "chart", "chart_forbidden", "La solicitud excluye gráficas", issues);
    rejectNodes(nodes, "heatmap", "chart_forbidden", "La solicitud excluye gráficas", issues);
  }
  if (requirements.requireTable && tables.length === 0) {
    issues.push({ code: "table_required", message: "La solicitud requiere una tabla" });
  }
  if (requirements.requireChart && visualizations.length === 0) {
    issues.push({ code: "chart_required", message: "La solicitud requiere una visualización de tendencia" });
  }
  if (requirements.requireDateRange && !hasDateRange(nodes)) {
    issues.push({ code: "date_range_required", message: "La solicitud requiere un control para cambiar el periodo" });
  }
  if (requirements.requireSlider && !nodes.some((node) => node.type === "slider")) {
    issues.push({ code: "slider_required", message: "La solicitud requiere un slider" });
  }
  if (requirements.requireNotesField && !nodes.some((node) => node.type === "form"
    && node.fields.some((field) => field.type === "text"
      && /(?:nota|comentario|observacion)/u.test(normalizeText(`${node.title} ${field.label}`))))) {
    issues.push({ code: "notes_field_required", message: "La solicitud requiere un campo editable para notas" });
  }
  if (requirements.requireInteraction && !nodes.some(isInteractionNode)) {
    issues.push({ code: "interaction_required", message: "La solicitud requiere una interfaz interactiva" });
  }
  if (
    requirements.forbidDashboard
    && !nodes.some((node) => node.type === "tabs")
    && isDashboardLike(metrics.length, visualizations.length, tables.length)
  ) {
    issues.push({ code: "dashboard_composition_forbidden", message: "La composición sigue teniendo estructura de dashboard" });
  }
  validateExactCount("chart", visualizations, requirements.exactCharts, "chart_count_mismatch", issues);
  validateExactCount("metric", metrics, requirements.exactMetrics, "metric_count_mismatch", issues);
  for (const node of [...visualizations, ...tables]) {
    const rows = resolveUiDataReference(node.data, dataSources);
    if (!Array.isArray(rows) || rows.length === 0) {
      issues.push({ code: "empty_collection", message: "La visualización no contiene filas visibles", nodeId: node.id });
      continue;
    }
    if (requirements.maxCollectionItems !== undefined) {
      const visibleRows = node.type === "table" ? Math.min(rows.length, node.maxRows) : rows.length;
      if (visibleRows > requirements.maxCollectionItems) {
        issues.push({
          code: "collection_limit_exceeded",
          message: `La solicitud limita el resultado a ${requirements.maxCollectionItems} elementos`,
          nodeId: node.id,
        });
      }
    }
    if (
      (node.type === "chart" && !hasVisibleChartValue(node, rows))
      || (node.type === "heatmap" && !hasVisibleHeatmapValue(node, rows))
    ) {
      issues.push({ code: "empty_chart", message: "La gráfica no contiene valores visibles", nodeId: node.id });
    }
  }

  for (const metric of metrics) {
    const value = resolveUiDataReference(metric.value, dataSources);
    if (value === null || value === undefined || value === "") {
      issues.push({ code: "empty_metric", message: "La métrica no contiene un valor visible", nodeId: metric.id });
    }
  }

  return issues.length === 0 ? { success: true, issues: [] } : { success: false, issues };
}

export interface UiPreferences {
  forbidTables: boolean;
  forbidCharts: boolean;
  requireTable: boolean;
  requireChart: boolean;
}

export function readUiPreferences(query: string): UiPreferences {
  const requirements = extractExplicitUiRequirements(latestUiRequest(query));
  return {
    forbidTables: requirements.forbidTables,
    forbidCharts: requirements.forbidCharts,
    requireTable: requirements.requireTable,
    requireChart: requirements.requireChart,
  };
}

function extractExplicitUiRequirements(query: string): ExplicitUiRequirements {
  const normalized = normalizeText(query);
  const forbidTables = explicitlyForbids(normalized, "tabla");
  const forbidCharts = explicitlyForbids(normalized, "grafica");
  const exactMetrics = extractExactCount(normalized, "metricas");
  const onlySingleFigure = /\b(?:solo|solamente) (?:dame|muestra(?:me)?) (?:una|1) cifra\b/u.test(normalized);
  const requestedChartCount = /\buna sola grafica\b/u.test(normalized)
    ? 1
    : extractExactCount(normalized, "graficas");
  const tableRequested = /\b(?:(?:como|en) (?:una )?tabla|una tabla|tabla de evolucion)\b/u.test(normalized);
  const explicitChart = /\b(?:una?|la|con|en|como) (?:grafica|grafico|chart)\b/u.test(normalized)
    || requestedChartCount !== undefined;

  return {
    forbidTables: forbidTables || onlySingleFigure,
    forbidCharts: forbidCharts || onlySingleFigure,
    forbidDashboard: explicitlyForbids(normalized, "dashboard"),
    requireTable: !forbidTables && !onlySingleFigure && tableRequested,
    requireChart: !forbidCharts && !onlySingleFigure && explicitChart,
    requireDateRange: /\b(?:cambiar|modificar|elegir|ajustar) (?:el |las |un )?(?:periodo|fechas|rango)\b/u.test(normalized),
    requireInteraction: /\b(?:interactiv[ao]|interfaz para explorar)\b/u.test(normalized),
    requireSlider: /\b(?:slider|deslizador)\b/u.test(normalized),
    requireNotesField: /\bcampo (?:de |para (?:mis |las )?)?(?:notas|comentarios|observaciones)\b/u.test(normalized),
    ...(forbidCharts || requestedChartCount === undefined ? {} : { exactCharts: requestedChartCount }),
    ...(exactMetrics === undefined && onlySingleFigure
      ? { exactMetrics: 1 }
      : exactMetrics === undefined ? {} : { exactMetrics }),
    ...extractTopCollectionLimit(normalized),
  };
}

function explicitlyForbids(query: string, noun: "tabla" | "grafica" | "dashboard") {
  const plural = noun === "dashboard" ? "dashboards?" : `${noun}s?`;
  return new RegExp(`\\bsin(?: usar)?(?: una| un)? ${plural}\\b`, "u").test(query)
    || new RegExp(`\\b(?:quita|elimina|retira|suprime)(?: (?:todas?|todos?|las?|los?|el|una?|unos?)){0,3} ${plural}\\b`, "u").test(query)
    || new RegExp(`\\bno (?:quiero|uses?|utilices?|incluyas?|muestres?|agregues?|necesito)(?: [a-z]+){0,4} ${plural}\\b`, "u").test(query);
}

function extractExactCount(query: string, noun: "graficas" | "metricas"): number | undefined {
  const singular = noun === "graficas" ? "grafica" : "metrica";
  const match = new RegExp(`\\b(?:exactamente|solo|solamente) (\\d+|una?|dos|tres|cuatro) ${singular}s?\\b`, "u").exec(query);
  return match?.[1] ? parseCount(match[1]) : undefined;
}

function extractTopCollectionLimit(query: string): Pick<ExplicitUiRequirements, "maxCollectionItems"> {
  const match = /\b(?:top|los|las|solo|solamente)? ?(\d+|una?|dos|tres|cuatro|cinco) (?:estados|entidades|grupos|categorias) (?:con (?:mas|mayor|menos|menor)|mas altos|mas altas|principales|mayores|menores)\b/u.exec(query);
  const count = match?.[1] ? parseCount(match[1]) : undefined;
  return count === undefined ? {} : { maxCollectionItems: count };
}

function parseCount(value: string): number | undefined {
  const words: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
  const count = words[value] ?? Number(value);
  return Number.isInteger(count) && count > 0 && count <= 12 ? count : undefined;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-MX");
}

export function latestUiRequest(query: string): string {
  const marker = "Nueva solicitud del usuario:";
  const index = query.lastIndexOf(marker);
  return index < 0 ? query : query.slice(index + marker.length).trim();
}

function collectNodes(root: UiNode): UiNode[] {
  const children = root.type === "tabs"
    ? root.tabs.flatMap((tab) => tab.children)
    : "children" in root ? root.children : [];
  return [root, ...children.flatMap(collectNodes)];
}

function rejectNodes(
  nodes: UiNode[],
  type: UiNode["type"],
  code: string,
  message: string,
  issues: SemanticUiIssue[],
) {
  for (const node of nodes) {
    if (node.type === type) issues.push({ code, message, nodeId: node.id });
  }
}

function hasDateRange(nodes: UiNode[]) {
  return nodes.some((node) => node.type === "filters" && node.fields.some((field) => field.type === "date-range"));
}

function isInteractionNode(node: UiNode) {
  return node.type === "filters"
    || node.type === "form"
    || node.type === "button"
    || node.type === "slider"
    || node.type === "tabs";
}

function isDashboardLike(metricCount: number, chartCount: number, tableCount: number) {
  return metricCount >= 2
    || (chartCount > 0 && tableCount > 0)
    || metricCount + chartCount + tableCount >= 3;
}

function validateExactCount(
  type: "chart" | "metric",
  nodes: UiNode[],
  expected: number | undefined,
  code: string,
  issues: SemanticUiIssue[],
) {
  if (expected !== undefined && nodes.length !== expected) {
    issues.push({ code, message: `La solicitud requiere exactamente ${expected} ${type === "chart" ? "gráfica(s)" : "métrica(s)"}` });
  }
}

function hasVisibleChartValue(node: Extract<UiNode, { type: "chart" }>, rows: unknown[]) {
  return rows.some((row) => node.series.some((series) => {
    const value = readPath(row, series.key);
    return value !== null && value !== undefined && value !== "";
  }));
}

function hasVisibleHeatmapValue(node: Extract<UiNode, { type: "heatmap" }>, rows: unknown[]) {
  return rows.some((row) => {
    const value = readPath(row, node.valueKey);
    return value !== null && value !== undefined && value !== "";
  });
}

function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
