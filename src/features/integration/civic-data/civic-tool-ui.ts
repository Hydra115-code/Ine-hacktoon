import { uiSpecificationSchema, type DataRegistryValue, type UINode, type UISpecification } from "@ine/contracts";
import type { CivicToolAdaptation } from "./civic-tool-adapter.ts";

const titles = {
  get_participation_summary: "Resumen de participación",
  compare_elections: "Comparación de participación",
  get_participation_breakdown: "Participación por grupo",
  get_supporting_records: "Registros que sustentan el resultado",
} as const;

export function buildCivicToolUISpecification(adaptation: CivicToolAdaptation): UISpecification {
  const children: UINode[] = [
    { type: "heading", id: "civic-tool-title", content: titles[adaptation.toolName], level: 2, size: "title" },
  ];

  if (adaptation.status !== "complete") {
    children.push({
      type: "alert",
      id: "civic-tool-status",
      title: adaptation.status === "partial" ? "Información parcial" : "Datos no disponibles",
      message: adaptation.citizenMessage,
      semanticState: adaptation.status === "partial" ? "status.warning" : "status.error",
    });
  }

  const data = adaptation.data;
  if (data) {
    addSource(children, data);
    const context = recordAt(data, "context");
    const hasNoData = context?.status === "no_data";
    if (hasNoData) {
      children.push({
        type: "alert",
        id: "civic-no-data",
        title: "Sin datos para estos filtros",
        message: "La fuente no devolvió registros para los filtros elegidos. Esto no significa que la participación sea cero.",
        semanticState: "status.info",
      });
    } else {
      if (adaptation.toolName === "get_participation_summary") addSummary(children, data);
      if (adaptation.toolName === "compare_elections") addComparison(children, data);
      if (adaptation.toolName === "get_participation_breakdown") addBreakdown(children, data);
      if (adaptation.toolName === "get_supporting_records") addSupportingRecords(children, data);
    }
    addMethodology(children, data);
    addCoverage(children, data);
  }

  return uiSpecificationSchema.parse({
    version: "1",
    root: {
      type: "section",
      id: "civic-tool-result",
      ariaLabel: titles[adaptation.toolName],
      surface: "primary",
      padding: "md",
      children,
    },
  });
}

function addSource(children: UINode[], data: DataRegistryValue) {
  if (recordAt(data, "quality")) {
    children.push({
      type: "dataQualityBadge",
      id: "civic-data-quality",
      ariaLabel: "Calidad, cobertura y actualización de los datos",
      title: "Cobertura de la consulta",
      dataBinding: "quality",
      statusField: "status",
      labelField: "label",
      recordCountField: "recordCount",
      updatedAtField: "updatedAt",
    });
  }
  const provenance = recordAt(data, "provenance");
  const source = provenance && recordAt(provenance, "source");
  if (source && typeof source.name === "string") {
    children.push({ type: "metric", id: "civic-source", label: "Fuente", valueBinding: "provenance.source.name", format: "text", importance: "tertiary", semanticState: "evidence.neutral" });
  }
  if (provenance?.isSampleData === true) {
    children.push({ type: "alert", id: "civic-sample-warning", title: "Datos de ejemplo", message: "La fuente marcó esta respuesta como muestra. No debe presentarse como resultado oficial.", semanticState: "status.warning" });
  }
}

function addSummary(children: UINode[], data: DataRegistryValue) {
  if (recordAt(data, "totals")) {
    children.push({
      type: "evidenceSummary",
      id: "summary-evidence",
      ariaLabel: "Cálculo verificable de participación oficial",
      title: "De dónde sale la participación",
      dataBinding: "totals",
      numeratorField: "voted",
      denominatorField: "classified",
      resultField: "participationPct",
      numeratorLabel: "Personas que votaron",
      denominatorLabel: "Votaron + no votaron",
      resultLabel: "Participación oficial",
      format: "number",
      unit: "%",
    });
    children.push({ type: "grid", id: "summary-current-metrics", columns: 3, gap: "md", children: [
      { type: "metric", id: "summary-current-voters", label: "Personas que votaron", valueBinding: "totals.voted", format: "number", semanticState: "evidence.neutral" },
      { type: "metric", id: "summary-current-nominal", label: "Lista nominal", valueBinding: "totals.nominalList", format: "number", semanticState: "evidence.neutral" },
      { type: "metric", id: "summary-current-unspecified", label: "No especificado", valueBinding: "totals.unspecified", format: "number", semanticState: "evidence.caution" },
    ] });
  }
  if (recordAt(data, "participation")) {
    children.push({
      type: "grid", id: "summary-metrics", columns: 3, gap: "md", children: [
        { type: "metric", id: "summary-voters", label: "Personas que votaron", valueBinding: "participation.totalVotes", format: "number", semanticState: "evidence.neutral" },
        { type: "metric", id: "summary-nominal", label: "Lista nominal", valueBinding: "participation.nominalList", format: "number", semanticState: "evidence.neutral" },
        { type: "metric", id: "summary-turnout", label: "Participación (%)", valueBinding: "participation.turnoutPercentage", format: "number", importance: "primary", semanticState: "evidence.neutral" },
      ],
    });
  }
  if (arrayAt(data, "results")) {
    children.push({ type: "table", id: "summary-results", ariaLabel: "Resultados que componen el total", dataBinding: "results", columns: [
      { field: "party", label: "Opción", format: "text" },
      { field: "votes", label: "Votos", format: "number", align: "end", sortable: true },
      { field: "percentage", label: "Distribución (%)", format: "number", align: "end", sortable: true },
    ], sorting: { enabled: true }, pagination: { pageSize: 10 } });
  }
  if (arrayAt(data, "composition")) {
    children.push({ type: "table", id: "summary-composition", ariaLabel: "Composición de la lista nominal", dataBinding: "composition", columns: [
      { field: "category", label: "Categoría", format: "text" },
      { field: "count", label: "Personas", format: "number", align: "end", sortable: true },
      { field: "nominalSharePct", label: "Proporción de la lista (%)", format: "number", align: "end", sortable: true },
    ], sorting: { enabled: true }, pagination: { pageSize: 10 } });
  }
}

function addComparison(children: UINode[], data: DataRegistryValue) {
  if (recordAt(data, "comparison")) {
    children.push({
      type: "electionDelta",
      id: "comparison-delta",
      ariaLabel: "Cambio de participación entre el año base y el último año disponible",
      title: "Cambio entre elecciones",
      dataBinding: "comparison",
      previousLabelField: "previousPeriod",
      currentLabelField: "currentPeriod",
      previousValueField: "previousValue",
      currentValueField: "currentValue",
      differenceField: "difference",
      format: "number",
      unit: "%",
      differenceUnit: "pp",
    });
  }
  if (recordAt(data, "turnoutChange")) {
    children.push({ type: "metric", id: "comparison-change", label: "Diferencia (puntos porcentuales)", valueBinding: "turnoutChange.points", format: "number", importance: "primary", semanticState: "evidence.neutral" });
  }
  if (arrayAt(data, "elections")) {
    const currentContract = (arrayAt(data, "elections") ?? []).some((election) => isRecord(election) && "participationPct" in election);
    const valueField = currentContract ? "participationPct" : "turnoutPercentage";
    children.push({
      type: "participationTimeline",
      id: "comparison-timeline",
      ariaLabel: "Participación a través de las elecciones consultadas",
      title: "Participación a través del tiempo",
      dataBinding: "elections",
      periodField: "year",
      valueField,
      valueLabel: "Usa las flechas izquierda y derecha para recorrer los años",
      format: "number",
      unit: "%",
    });
    children.push({ type: "table", id: "comparison-table", ariaLabel: "Cifras de los procesos comparados", dataBinding: "elections", columns: currentContract ? [
      { field: "year", label: "Año", format: "number", sortable: true },
      { field: "voted", label: "Personas que votaron", format: "number", align: "end" },
      { field: "classified", label: "Votaron + no votaron", format: "number", align: "end" },
      { field: "nominalList", label: "Lista nominal", format: "number", align: "end" },
      { field: "participationPct", label: "Participación oficial (%)", format: "number", align: "end" },
    ] : [
      { field: "year", label: "Año", format: "number", sortable: true },
      { field: "totalVotes", label: "Personas que votaron", format: "number", align: "end" },
      { field: "nominalList", label: "Lista nominal", format: "number", align: "end" },
      { field: "turnoutPercentage", label: "Participación (%)", format: "number", align: "end" },
    ], sorting: { enabled: true, default: { field: "year", direction: "ascending" } }, pagination: { pageSize: 10 } });
  }
}

function addBreakdown(children: UINode[], data: DataRegistryValue) {
  const groups = arrayAt(data, "groups");
  const context = recordAt(data, "context");
  if (!groups) {
    children.push({
      type: "alert",
      id: "breakdown-no-data",
      title: "Sin datos para estos filtros",
      message: "La fuente no devolvió observaciones territoriales. Esto no significa que la participación sea cero.",
      semanticState: "status.info",
    });
    return;
  }

  const isTerritorial = context?.dimension === "entidad"
    && groups.some((group) => isRecord(group) && typeof group.value === "string");
  if (isTerritorial) {
    children.push({
      type: "mexicoChoropleth",
      id: "breakdown-mexico-map",
      ariaLabel: "Mapa interactivo de participación por entidad federativa",
      title: `Participación por entidad${typeof context?.year === "number" ? ` · ${context.year}` : ""}`,
      dataBinding: "groups",
      entityCodeField: "value",
      entityNameField: "group",
      valueField: "participationPct",
      valueLabel: "Participación oficial CCPC. Las entidades sin observaciones se muestran como Sin dato.",
      numeratorField: "voted",
      denominatorField: "classified",
      format: "number",
      unit: "%",
      selectionEvent: "map.entity_selected",
    });
  } else {
    const valueField = groups.some((group) => isRecord(group) && "participationPct" in group)
      ? "participationPct"
      : "turnoutPercentage";
    children.push({
      type: "demographicBreakdown",
      id: "breakdown-segments",
      ariaLabel: "Participación por segmento disponible",
      title: "Cómo cambia entre grupos",
      dataBinding: "groups",
      segmentField: "group",
      valueField,
      valueLabel: "Comparación descriptiva de los grupos observados",
      order: "source",
      format: "number",
      unit: "%",
    });
  }
  const currentContract = groups.some((group) => isRecord(group) && "participationPct" in group);
  children.push({ type: "table", id: "breakdown-table", ariaLabel: "Evidencia por grupo", dataBinding: "groups", columns: currentContract ? [
    { field: "group", label: isTerritorial ? "Entidad" : "Grupo", format: "text", sortable: true },
    { field: "voted", label: "Personas que votaron", format: "number", align: "end" },
    { field: "classified", label: "Votaron + no votaron", format: "number", align: "end" },
    { field: "nominalList", label: "Lista nominal", format: "number", align: "end" },
    { field: "participationPct", label: "Participación oficial (%)", format: "number", align: "end", sortable: true },
  ] : [
    { field: "group", label: "Grupo", format: "text", sortable: true },
    { field: "voters", label: "Personas que votaron", format: "number", align: "end" },
    { field: "nominalList", label: "Lista nominal", format: "number", align: "end" },
    { field: "turnoutPercentage", label: "Participación (%)", format: "number", align: "end", sortable: true },
  ], sorting: { enabled: true }, pagination: { pageSize: 10 } });
}

function addSupportingRecords(children: UINode[], data: DataRegistryValue) {
  if (!arrayAt(data, "records")) return;
  const currentContract = (arrayAt(data, "records") ?? []).some((record) => isRecord(record) && "entityCode" in record);
  children.push({ type: "table", id: "supporting-records-table", ariaLabel: "Registros de evidencia", dataBinding: "records", columns: currentContract ? [
    { field: "entity", label: "Entidad", format: "text", sortable: true },
    { field: "year", label: "Año", format: "number", sortable: true },
    { field: "sex", label: "Sexo", format: "text" },
    { field: "ageGroup", label: "Grupo de edad", format: "text" },
    { field: "sectionType", label: "Tipo de sección", format: "text" },
    { field: "voted", label: "Votaron", format: "number", align: "end" },
    { field: "nominalList", label: "Lista nominal", format: "number", align: "end" },
  ] : [
    { field: "label", label: "Dato", format: "text" },
    { field: "value", label: "Valor", format: "number", align: "end" },
    { field: "kind", label: "Tipo", format: "status" },
    { field: "derivation", label: "Cómo se obtuvo", format: "text" },
  ], filtering: currentContract
    ? { enabled: true, fields: ["entity", "sex", "ageGroup", "sectionType"], placeholder: "Filtrar evidencia" }
    : { enabled: true, fields: ["label", "kind", "derivation"], placeholder: "Filtrar evidencia" }, pagination: { pageSize: 10 } });
}

function addMethodology(children: UINode[], data: DataRegistryValue) {
  const notes = arrayAt(data, "methodologyNotes")?.filter((value): value is string => typeof value === "string" && value.length <= 120);
  if (notes?.length) children.push({ type: "list", id: "methodology-notes", items: notes.map((label) => ({ label })) });
}

function addCoverage(children: UINode[], data: DataRegistryValue) {
  const note = data.coverageNote;
  if (typeof note === "string" && note.length <= 600) {
    children.push({ type: "alert", id: "coverage-note", title: "Cobertura de la fuente", message: note, semanticState: "status.warning" });
  }
}

function recordAt(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function arrayAt(record: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = record[key];
  return Array.isArray(value) && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
