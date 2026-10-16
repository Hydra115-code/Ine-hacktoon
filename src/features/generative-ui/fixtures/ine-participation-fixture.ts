import { uiSpecificationSchema, type DataRegistryValue } from "@ine/contracts";

/**
 * Contract-only INE fixture. It intentionally contains no electoral figures:
 * callers must inject verified data from the Data Engine or an explicitly
 * labelled synthetic dataset in a development harness.
 */
export const ineParticipationSpecification = uiSpecificationSchema.parse({
  version: "1",
  root: {
    type: "section",
    id: "ine-participation-root",
    ariaLabel: "Comparación de participación ciudadana",
    surface: "primary",
    padding: "md",
    children: [
      { type: "heading", id: "participation-title", content: "Cómo cambió la participación", level: 2, size: "title" },
      { type: "text", id: "participation-summary", content: "Compara periodos equivalentes y revisa la evidencia que sustenta el resultado.", tone: "secondary" },
      {
        type: "grid",
        id: "participation-metrics",
        columns: 3,
        gap: "md",
        children: [
          { type: "metric", id: "participation-first", labelBinding: "summary.firstPeriodLabel", valueBinding: "summary.firstParticipation", format: "number", importance: "secondary", semanticState: "evidence.neutral" },
          { type: "metric", id: "participation-last", labelBinding: "summary.lastPeriodLabel", valueBinding: "summary.lastParticipation", format: "number", importance: "primary", semanticState: "evidence.neutral" },
          { type: "metric", id: "participation-change", label: "Diferencia (puntos porcentuales)", valueBinding: "summary.differencePoints", format: "number", importance: "secondary", semanticState: "trend.increase" },
        ],
      },
      {
        type: "visualization",
        id: "participation-chart",
        ariaLabel: "Participación por periodo",
        description: "Comparación de participación ciudadana expresada como porcentaje.",
        mark: "bar",
        dataBinding: "periods",
        encoding: {
          x: { field: "period", type: "ordinal", label: "Periodo" },
          y: { field: "participation", type: "quantitative", label: "Participación (%)", format: "number" },
        },
        legend: { show: false },
        height: "md",
      },
      {
        type: "table",
        id: "participation-evidence",
        ariaLabel: "Evidencia de participación por periodo",
        caption: "Numerador, denominador y porcentaje reportados por la fuente conectada",
        dataBinding: "periods",
        columns: [
          { field: "period", label: "Periodo", format: "text", sortable: true },
          { field: "votes", label: "Personas que votaron", format: "number", align: "end", sortable: true },
          { field: "nominalList", label: "Lista nominal", format: "number", align: "end", sortable: true },
          { field: "participation", label: "Participación (%)", format: "number", align: "end", sortable: true },
        ],
        sorting: { enabled: true, default: { field: "period", direction: "ascending" } },
        pagination: { pageSize: 10 },
        density: "comfortable",
      },
      { type: "alert", id: "participation-warning", title: "Lectura responsable", message: "Antes de comparar, confirma que los periodos, ámbitos y universos sean equivalentes.", semanticState: "status.info" },
    ],
  },
});

export interface INEParticipationFixture {
  data: DataRegistryValue;
  specification: typeof ineParticipationSpecification;
}

export function createINEParticipationFixture(data: DataRegistryValue): INEParticipationFixture {
  return { data, specification: ineParticipationSpecification };
}
