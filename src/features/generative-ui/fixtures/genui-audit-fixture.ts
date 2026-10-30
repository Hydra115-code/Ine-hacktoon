import { dataRegistrySchema, uiSpecificationSchema } from "@ine/contracts";

export const genUIAuditData = dataRegistrySchema.parse({
  metrics: { participation: 61.4, change: 16.2, coverage: 87, decrease: -4.8 },
  series: [
    { period: "2009", value: 45.2, group: "Nacional", xValue: 45.2, yValue: 58.1 },
    { period: "2012", value: 52.7, group: "Nacional", xValue: 52.7, yValue: 61.3 },
    { period: "2015", value: 48.9, group: "Nacional", xValue: 48.9, yValue: 55.4 },
    { period: "2018", value: 58.4, group: "Nacional", xValue: 58.4, yValue: 64.2 },
    { period: "2021", value: 52.1, group: "Nacional", xValue: 52.1, yValue: 57.8 },
    { period: "2024", value: 61.4, group: "Nacional", xValue: 61.4, yValue: 68.9 },
  ],
  grouped: [
    { period: "2018", value: 58.4, group: "Nacional" }, { period: "2018", value: 62.1, group: "Entidad Alfa" },
    { period: "2021", value: 52.1, group: "Nacional" }, { period: "2021", value: 59.8, group: "Entidad Alfa" },
    { period: "2024", value: 61.4, group: "Nacional" }, { period: "2024", value: 67.4, group: "Entidad Alfa" },
  ],
  distribution: [
    { category: "18 a 24", value: 18.2 }, { category: "25 a 34", value: 24.8 },
    { category: "35 a 49", value: 29.6 }, { category: "50 o más", value: 27.4 },
  ],
  heatmap: [
    { entity: "Alfa", period: "2018", value: 57.2 }, { entity: "Alfa", period: "2021", value: 60.3 }, { entity: "Alfa", period: "2024", value: 63.1 },
    { entity: "Beta", period: "2018", value: 51.8 }, { entity: "Beta", period: "2021", value: 53.2 }, { entity: "Beta", period: "2024", value: 54.6 },
    { entity: "Gamma", period: "2018", value: 46.5 }, { entity: "Gamma", period: "2021", value: 47.9 }, { entity: "Gamma", period: "2024", value: 49.3 },
  ],
  tableRows: Array.from({ length: 28 }, (_, index) => ({
    id: `entity-${index + 1}`, entity: `Entidad ${String.fromCharCode(65 + index % 26)}`,
    period: `202${index % 5}`, participation: Number((46.2 + (index * 3.7) % 23).toFixed(1)),
    observations: 120000 + index * 8750, updatedAt: `2026-10-${String((index % 17) + 1).padStart(2, "0")}`,
    status: index % 3 === 0 ? "Revisado" : index % 3 === 1 ? "Disponible" : "Precaución",
  })),
  repeatItems: [{ label: "Fuente oficial" }, { label: "Metodología visible" }, { label: "Datos verificables" }],
  showConditional: true,
});

const chart = (id: string, mark: "line" | "area" | "bar" | "grouped-bar" | "stacked-bar" | "scatter" | "donut" | "heatmap", title: string) => {
  const common = { type: "visualization" as const, id, ariaLabel: title, description: `${title}. Datos sintéticos para auditoría visual.`, mark, height: "md" as const };
  if (mark === "donut") return { ...common, dataBinding: "distribution", encoding: { group: { field: "category", type: "nominal" as const, label: "Grupo" }, value: { field: "value", type: "quantitative" as const, label: "Participación" } }, legend: { show: true, position: "bottom" as const } };
  if (mark === "heatmap") return { ...common, dataBinding: "heatmap", encoding: { x: { field: "period", type: "ordinal" as const }, y: { field: "entity", type: "nominal" as const }, value: { field: "value", type: "quantitative" as const } }, legend: { show: true, position: "bottom" as const } };
  if (mark === "scatter") return { ...common, dataBinding: "series", encoding: { x: { field: "xValue", type: "quantitative" as const, label: "Indicador A" }, y: { field: "yValue", type: "quantitative" as const, label: "Indicador B" } }, legend: { show: false } };
  const hasGroup = mark === "grouped-bar" || mark === "stacked-bar";
  return { ...common, dataBinding: hasGroup ? "grouped" : "series", encoding: { x: { field: "period", type: "ordinal" as const, label: "Elección" }, y: { field: "value", type: "quantitative" as const, label: "Participación" }, ...(hasGroup ? { group: { field: "group", type: "nominal" as const, label: "Ámbito" } } : {}) }, legend: { show: hasGroup, position: "bottom" as const } };
};

export const auditVisualizationSpecification = uiSpecificationSchema.parse({ version: "1", root: {
  type: "section", id: "audit-visualizations", ariaLabel: "Todas las gráficas", surface: "primary", padding: "md", children: [
    { type: "heading", id: "charts-title", content: "Las ocho visualizaciones disponibles", level: 2, size: "title" },
    { type: "text", id: "charts-copy", content: "Cada gráfica incluye descripción accesible y una tabla alternativa para consultar los mismos datos.", tone: "secondary" },
    { type: "grid", id: "charts-grid", columns: 2, gap: "lg", children: [
      chart("chart-line", "line", "Línea temporal"), chart("chart-area", "area", "Área temporal"),
      chart("chart-bar", "bar", "Barras"), chart("chart-grouped", "grouped-bar", "Barras agrupadas"),
      chart("chart-stacked", "stacked-bar", "Barras apiladas"), chart("chart-scatter", "scatter", "Dispersión"),
      chart("chart-donut", "donut", "Distribución circular"), chart("chart-heatmap", "heatmap", "Mapa de calor"),
    ] },
  ],
} });

export const auditContentSpecification = uiSpecificationSchema.parse({ version: "1", root: {
  type: "section", id: "audit-content", ariaLabel: "Contenido y estados", surface: "primary", padding: "md", children: [
    { type: "heading", id: "content-title", content: "Contenido, jerarquía y estados", level: 2, size: "title" },
    { type: "grid", id: "heading-grid", columns: 3, gap: "md", children: [
      { type: "heading", id: "display-heading", content: "Display", level: 2, size: "display" },
      { type: "heading", id: "title-heading", content: "Título", level: 3, size: "title" },
      { type: "heading", id: "section-heading", content: "Sección", level: 4, size: "section" },
    ] },
    { type: "grid", id: "text-grid", columns: 3, gap: "md", children: [
      { type: "text", id: "body-text", content: "Texto principal para explicar un hallazgo ciudadano.", variant: "body", tone: "primary" },
      { type: "text", id: "label-text", content: "Etiqueta secundaria", variant: "label", tone: "secondary" },
      { type: "text", id: "caption-text", content: "Nota y contexto metodológico", variant: "caption", tone: "muted" },
    ] },
    { type: "grid", id: "metric-grid", columns: 4, gap: "md", children: [
      { type: "metric", id: "metric-primary", label: "Participación", valueBinding: "metrics.participation", format: "number", importance: "primary", semanticState: "trend.increase" },
      { type: "metric", id: "metric-secondary", label: "Cambio", valueBinding: "metrics.change", format: "number", importance: "secondary", semanticState: "evidence.neutral" },
      { type: "metric", id: "metric-tertiary", label: "Cobertura", valueBinding: "metrics.coverage", format: "number", importance: "tertiary", semanticState: "evidence.caution" },
      { type: "metric", id: "metric-decrease", label: "Descenso", valueBinding: "metrics.decrease", format: "number", semanticState: "trend.decrease" },
    ] },
    { type: "flex", id: "badge-row", wrap: "wrap", gap: "sm", children: [
      { type: "badge", id: "badge-success", label: "Disponible", semanticState: "status.success", emphasis: "soft" },
      { type: "badge", id: "badge-info", label: "Informativo", semanticState: "status.info", emphasis: "strong" },
      { type: "badge", id: "badge-warning", label: "Precaución", semanticState: "status.warning" },
      { type: "badge", id: "badge-error", label: "No disponible", semanticState: "status.error", emphasis: "strong" },
      { type: "badge", id: "badge-neutral", label: "Evidencia neutral", semanticState: "evidence.neutral" },
    ] },
    { type: "grid", id: "alerts-grid", columns: 2, gap: "md", children: [
      { type: "alert", id: "alert-success", title: "Datos listos", message: "La consulta terminó correctamente.", semanticState: "status.success" },
      { type: "alert", id: "alert-info", title: "Contexto", message: "Estos valores describen un escenario de laboratorio.", semanticState: "status.info" },
      { type: "alert", id: "alert-warning", title: "Lectura cuidadosa", message: "Revisa el universo y el periodo antes de comparar.", semanticState: "status.warning" },
      { type: "alert", id: "alert-error", title: "Sin evidencia suficiente", message: "Paper necesita una consulta más específica.", semanticState: "status.error" },
    ] },
    { type: "progress", id: "progress-success", label: "Cobertura de registros", valueBinding: "metrics.coverage", showValue: true, semanticState: "status.success" },
    { type: "flex", id: "icon-row", wrap: "wrap", gap: "lg", children: [
      { type: "icon", id: "icon-info", name: "info", label: "Información", size: "lg", semanticState: "status.info" },
      { type: "icon", id: "icon-success", name: "success", label: "Correcto", size: "lg", semanticState: "status.success" },
      { type: "icon", id: "icon-warning", name: "warning", label: "Precaución", size: "lg", semanticState: "status.warning" },
      { type: "icon", id: "icon-error", name: "error", label: "Error", size: "lg", semanticState: "status.error" },
      { type: "icon", id: "icon-up", name: "trend-up", label: "Aumenta", size: "lg", semanticState: "trend.increase" },
      { type: "icon", id: "icon-down", name: "trend-down", label: "Disminuye", size: "lg", semanticState: "trend.decrease" },
      { type: "icon", id: "icon-neutral", name: "neutral", label: "Estable", size: "lg", semanticState: "evidence.neutral" },
    ] },
    { type: "list", id: "audit-list", ordered: true, items: [
      { label: "Dato", supportingText: "Valor observado" }, { label: "Fuente", supportingText: "Origen verificable" }, { label: "Método", supportingText: "Cómo se calculó" },
    ] },
  ],
} });

export const auditTableSpecification = uiSpecificationSchema.parse({ version: "1", root: {
  type: "section", id: "audit-tables", ariaLabel: "Variantes de tablas", surface: "primary", padding: "md", children: [
    { type: "heading", id: "tables-title", content: "Tablas densas, cómodas e interactivas", level: 2, size: "title" },
    { type: "table", id: "table-comfortable", ariaLabel: "Tabla electoral cómoda", caption: "Orden, filtro, selección y paginación", dataBinding: "tableRows", columns: [
      { field: "entity", label: "Entidad", format: "text", sortable: true }, { field: "period", label: "Periodo", format: "text", align: "center", sortable: true },
      { field: "participation", label: "Participación", format: "percentage", align: "end", sortable: true }, { field: "observations", label: "Observaciones", format: "number", align: "end", sortable: true },
      { field: "updatedAt", label: "Actualización", format: "date", sortable: true }, { field: "status", label: "Estado", format: "status" },
    ], sorting: { enabled: true, default: { field: "participation", direction: "descending" } }, filtering: { enabled: true, fields: ["entity", "period", "status"], placeholder: "Buscar entidad, periodo o estado" }, pagination: { pageSize: 10 }, selection: { mode: "multiple", rowIdField: "id", event: "audit.table_selection_changed" }, density: "comfortable", stickyHeader: true },
    { type: "table", id: "table-compact", ariaLabel: "Tabla electoral compacta", caption: "Densidad compacta para comparar rápidamente", dataBinding: "tableRows", columns: [
      { field: "entity", label: "Entidad", format: "text", sortable: true }, { field: "participation", label: "Participación", format: "percentage", align: "end", sortable: true }, { field: "status", label: "Estado", format: "status" },
    ], sorting: { enabled: true }, filtering: { enabled: true, fields: ["entity"], placeholder: "Filtrar entidades" }, pagination: { pageSize: 10 }, density: "compact" },
  ],
} });

export const auditInteractionSpecification = uiSpecificationSchema.parse({ version: "1", root: {
  type: "section", id: "audit-interactions", ariaLabel: "Controles y layouts", surface: "primary", padding: "md", children: [
    { type: "heading", id: "controls-title", content: "Controles, navegación y composición", level: 2, size: "title" },
    { type: "tabs", id: "audit-tabs", ariaLabel: "Familias de controles", defaultValue: "filters", items: [
      { value: "filters", label: "Filtros", children: [{ type: "grid", id: "filter-grid", columns: 2, gap: "md", children: [
        { type: "input", id: "audit-search", label: "Buscar", event: "audit.search_changed", placeholder: "Escribe una entidad", validation: { kind: "search", maxLength: 120 } },
        { type: "numberInput", id: "audit-number", label: "Umbral", event: "audit.number_changed", min: 0, max: 100, step: 1, initialValue: 50 },
        { type: "select", id: "audit-select", label: "Entidad", event: "audit.entity_changed", placeholder: "Selecciona una entidad", options: [{ value: "ags", label: "Aguascalientes" }, { value: "cdmx", label: "Ciudad de México" }, { value: "jal", label: "Jalisco" }] },
        { type: "multiSelect", id: "audit-multiselect", label: "Periodos", event: "audit.periods_changed", options: [{ value: "2018", label: "2018" }, { value: "2021", label: "2021" }, { value: "2024", label: "2024" }], initialValue: ["2021", "2024"], maxSelections: 3 },
        { type: "datePicker", id: "audit-date", label: "Fecha de corte", event: "audit.date_changed", min: "2000-01-01", max: "2026-12-31", initialValue: "2024-06-02" },
        { type: "dateRange", id: "audit-range", label: "Rango", event: "audit.range_changed", min: "2000-01-01", max: "2026-12-31", initialValue: { start: "2018-01-01", end: "2024-12-31" } },
      ] }] },
      { value: "choices", label: "Selección", children: [{ type: "stack", id: "choice-stack", gap: "lg", children: [
        { type: "slider", id: "audit-slider", label: "Participación mínima", event: "audit.slider_changed", min: 0, max: 100, step: 1, initialValue: 55, showValue: true },
        { type: "radioGroup", id: "audit-radio", label: "Vista", event: "audit.view_changed", orientation: "horizontal", initialValue: "chart", options: [{ value: "chart", label: "Gráfica" }, { value: "table", label: "Tabla" }, { value: "map", label: "Mapa" }] },
        { type: "checkbox", id: "audit-checkbox", label: "Incluir metodología", event: "audit.methodology_changed", initialChecked: true },
        { type: "switch", id: "audit-switch", label: "Mostrar fuente", event: "audit.source_changed", initialChecked: true },
      ] }] },
      { value: "actions", label: "Acciones", children: [{ type: "flex", id: "button-row", wrap: "wrap", gap: "md", children: [
        { type: "button", id: "button-primary", label: "Aplicar", event: "audit.apply_requested", variant: "primary" }, { type: "button", id: "button-secondary", label: "Comparar", event: "audit.compare_requested", variant: "secondary" },
        { type: "button", id: "button-ghost", label: "Limpiar", event: "audit.clear_requested", variant: "ghost" }, { type: "button", id: "button-danger", label: "Descartar", event: "audit.discard_requested", variant: "danger" },
        { type: "button", id: "button-loading", label: "Consultando", event: "audit.loading_requested", variant: "primary", state: "loading" }, { type: "button", id: "button-disabled", label: "No disponible", event: "audit.disabled_requested", state: "disabled" },
      ] }] },
    ] },
    { type: "divider", id: "audit-divider", strength: "strong" },
    { type: "split", id: "audit-split", ratio: "sidebar-start", collapseAt: "md", gap: "lg", children: [
      { type: "accordion", id: "audit-accordion", mode: "multiple", defaultOpen: ["source"], items: [
        { value: "source", label: "Fuente", children: [{ type: "text", id: "source-copy", content: "Datos sintéticos para auditar el sistema visual.", tone: "secondary" }] },
        { value: "method", label: "Metodología", children: [{ type: "text", id: "method-copy", content: "Cada salida conserva su contexto y evidencia.", tone: "secondary" }] },
      ] },
      { type: "scrollable", id: "audit-scrollable", ariaLabel: "Contenido desplazable", axis: "horizontal", maxSize: "sm", children: [{ type: "flex", id: "scroll-row", wrap: "nowrap", gap: "md", children: [
        { type: "badge", id: "scroll-1", label: "Participación" }, { type: "badge", id: "scroll-2", label: "Territorio" }, { type: "badge", id: "scroll-3", label: "Elección" }, { type: "badge", id: "scroll-4", label: "Metodología" }, { type: "badge", id: "scroll-5", label: "Evidencia" },
      ] }] },
    ] },
    { type: "conditional", id: "audit-conditional", condition: { binding: "showConditional", operator: "==", value: true }, then: { type: "alert", id: "conditional-visible", title: "Lógica condicional", message: "Este bloque aparece porque la condición enlazada es verdadera.", semanticState: "status.info" }, else: { type: "text", id: "conditional-hidden", content: "Condición desactivada." } },
    { type: "repeat", id: "audit-repeat", dataBinding: "repeatItems", template: { type: "metric", id: "repeat-metric", labelBinding: "$item.label", valueBinding: "$index", format: "number", fallback: 0 }, empty: { type: "text", id: "repeat-empty", content: "No hay elementos." } },
  ],
} });

export const auditCoveredNodeTypes = [
  "container", "section", "stack", "grid", "flex", "split", "scrollable", "divider", "tabs", "accordion", "text", "heading", "metric", "badge", "alert", "progress", "icon", "list",
  "electionDelta", "territoryRanking", "participationTimeline", "dataQualityBadge", "demographicBreakdown", "comparisonMatrix", "evidenceSummary", "civicInsight", "mexicoChoropleth", "visualization", "table",
  "button", "input", "numberInput", "select", "multiSelect", "slider", "datePicker", "dateRange", "checkbox", "switch", "radioGroup", "repeat", "conditional",
] as const;
export const auditVisualizationMarks = ["line", "area", "bar", "grouped-bar", "stacked-bar", "scatter", "donut", "heatmap"] as const;
