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
    if (adaptation.toolName === "get_participation_summary") addSummary(children, data);
    if (adaptation.toolName === "compare_elections") addComparison(children, data);
    if (adaptation.toolName === "get_participation_breakdown") addBreakdown(children, data);
    if (adaptation.toolName === "get_supporting_records") addSupportingRecords(children, data);
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
}

function addComparison(children: UINode[], data: DataRegistryValue) {
  if (recordAt(data, "turnoutChange")) {
    children.push({ type: "metric", id: "comparison-change", label: "Diferencia (puntos porcentuales)", valueBinding: "turnoutChange.points", format: "number", importance: "primary", semanticState: "evidence.neutral" });
  }
  if (arrayAt(data, "elections")) {
    children.push({ type: "visualization", id: "comparison-chart", ariaLabel: "Participación por proceso", description: "Comparación de los porcentajes entregados por la fuente.", mark: "bar", dataBinding: "elections", encoding: {
      x: { field: "year", type: "ordinal", label: "Año", format: "number" },
      y: { field: "turnoutPercentage", type: "quantitative", label: "Participación (%)", format: "number" },
    }, legend: { show: false }, height: "md" });
    children.push({ type: "table", id: "comparison-table", ariaLabel: "Cifras de los procesos comparados", dataBinding: "elections", columns: [
      { field: "year", label: "Año", format: "number", sortable: true },
      { field: "totalVotes", label: "Personas que votaron", format: "number", align: "end" },
      { field: "nominalList", label: "Lista nominal", format: "number", align: "end" },
      { field: "turnoutPercentage", label: "Participación (%)", format: "number", align: "end" },
    ], sorting: { enabled: true, default: { field: "year", direction: "ascending" } }, pagination: { pageSize: 10 } });
  }
}

function addBreakdown(children: UINode[], data: DataRegistryValue) {
  if (!arrayAt(data, "groups")) return;
  children.push({ type: "visualization", id: "breakdown-chart", ariaLabel: "Participación por grupo", description: "Comparación de participación entre los grupos disponibles.", mark: "bar", dataBinding: "groups", encoding: {
    x: { field: "group", type: "nominal", label: "Grupo" },
    y: { field: "turnoutPercentage", type: "quantitative", label: "Participación (%)", format: "number" },
  }, legend: { show: false }, height: "md" });
  children.push({ type: "table", id: "breakdown-table", ariaLabel: "Evidencia por grupo", dataBinding: "groups", columns: [
    { field: "group", label: "Grupo", format: "text", sortable: true },
    { field: "voters", label: "Personas que votaron", format: "number", align: "end" },
    { field: "nominalList", label: "Lista nominal", format: "number", align: "end" },
    { field: "turnoutPercentage", label: "Participación (%)", format: "number", align: "end", sortable: true },
  ], sorting: { enabled: true }, pagination: { pageSize: 10 } });
}

function addSupportingRecords(children: UINode[], data: DataRegistryValue) {
  if (!arrayAt(data, "records")) return;
  children.push({ type: "table", id: "supporting-records-table", ariaLabel: "Registros de evidencia", dataBinding: "records", columns: [
    { field: "label", label: "Dato", format: "text" },
    { field: "value", label: "Valor", format: "number", align: "end" },
    { field: "kind", label: "Tipo", format: "status" },
    { field: "derivation", label: "Cómo se obtuvo", format: "text" },
  ], filtering: { enabled: true, fields: ["label", "kind", "derivation"], placeholder: "Filtrar evidencia" }, pagination: { pageSize: 10 } });
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
