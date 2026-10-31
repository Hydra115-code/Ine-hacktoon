import { AGE_SEX_SOURCE } from "../../agent/reasoning/civic-data-shaper.js";
import { interpretCivicQuery } from "../../agent/planning/civic-query-interpreter.js";
import {
  parseUiDocument,
  type UiDataReference,
  type UiDataSource,
  type UiDocument,
  type UiNode,
} from "../dsl/ui.schema.js";
import { validateCivicUi } from "./civic-semantic-ui-validator.js";
import { latestUiRequest, readUiPreferences, validateUiSemantics } from "./semantic-ui-validator.js";
import { type UiGenerationInput } from "./ui-generator.js";
import { planCivicComponents } from "./civic-component-catalog.js";

export const CIVIC_COMPOSITIONS = {
  ranking: { trigger: "territorio + porcentaje", components: ["mapa (si el runtime lo soporta)", "ranking", "tabla"] },
  timeline: { trigger: "tres o más años", components: ["línea de tiempo", "tabla"] },
  "age-sex": { trigger: "edad + sexo", components: ["pirámide (barras agrupadas)", "tabla de evidencia"] },
  "two-elections": { trigger: "dos elecciones", components: ["barras", "delta en puntos porcentuales", "tabla"] },
  methodology: { trigger: "consulta metodológica", components: ["fuente", "metodología"] },
  "insufficient-data": { trigger: "datos insuficientes", components: ["explicación ciudadana"] },
  summary: { trigger: "un territorio y un año", components: ["métricas con numerador y denominador", "tabla"] },
  "group-comparison": { trigger: "sexo, edad o tipo de sección", components: ["barras", "tabla"] },
  evidence: { trigger: "registros de respaldo", components: ["tabla de registros", "fuente"] },
} as const;

export type CivicCompositionId = keyof typeof CIVIC_COMPOSITIONS;

export const CIVIC_RUNTIME_CAPABILITIES = { map: true } as const;

interface Draft {
  composition: CivicCompositionId;
  charts: UiNode[];
  tables: UiNode[];
  metrics: UiNode[];
  notes: UiNode[];
}

const ONLY_TABLE = /\b(?:s[oó]lo|solamente|nada m[aá]s)\s+(?:con\s+)?(?:la\s+|una\s+|las\s+)?tablas?\b/iu;
const ONLY_CHART = /\b(?:s[oó]lo|solamente|nada m[aá]s)\s+(?:con\s+)?(?:la\s+|una\s+|las\s+)?gr[aá]ficas?\b/iu;
const METHODOLOGY_POINTS = [
  "Participación oficial CCPC = votaron ÷ (votaron + no votaron).",
  "Participación nominal = votaron ÷ lista nominal.",
  "Los cambios entre elecciones se expresan en puntos porcentuales.",
  "Son datos agregados por entidad, sexo, grupo de edad y tipo de sección; no describen a personas concretas.",
];

export function composeCivicUi(input: UiGenerationInput): UiDocument | undefined {
  const sources = input.dataSources.filter((source) => isRecord(source.data));
  const draft = sources.length === 0 ? undefined : draftFor(sources);
  const document = draft
    ? assemble(draft, input, sources)
    : textComposition(input.query, input.answer);
  try {
    const parsed = parseUiDocument(document, input.dataSources);
    if (!validateUiSemantics(input.query, parsed, input.dataSources).success) return undefined;
    const bindsData = draft !== undefined && draft.composition !== "insufficient-data";
    if (bindsData && validateCivicUi({ query: input.query, answer: input.answer, document: parsed, dataSources: input.dataSources }).length > 0) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function compositionOf(document: UiDocument): CivicCompositionId | undefined {
  const id = document.root.id.replace(/^composicion-/u, "");
  return id in CIVIC_COMPOSITIONS ? id as CivicCompositionId : undefined;
}

function draftFor(sources: readonly UiDataSource[]): Draft | undefined {
  const usable = sources.filter((source) => data(source).status === "ok");
  if (usable.length === 0) return insufficient(sources);

  const ageSex = usable.find((source) => source.toolName === AGE_SEX_SOURCE);
  if (ageSex) return ageSexDraft(ageSex);
  const comparison = usable.find((source) => source.toolName === "compare_elections");
  if (comparison) return comparisonDraft(comparison);
  const breakdown = usable.find((source) => source.toolName === "get_participation_breakdown");
  if (breakdown) return breakdownDraft(breakdown);
  const records = usable.find((source) => source.toolName === "get_supporting_records");
  if (records) return evidenceDraft(records);
  const summary = usable.find((source) => source.toolName === "get_participation_summary");
  if (summary) return summaryDraft(summary);
  return insufficient(sources);
}

function breakdownDraft(source: UiDataSource): Draft | undefined {
  const value = data(source);
  const groups = rowsOf(value.groups).filter((row) => typeof row.participationPct === "number");
  if (groups.length === 0) return insufficient([source]);
  const byEntity = value.dimension === "entidad";
  const label = dimensionLabel(String(value.dimension));
  const title = `Participación oficial por ${label}, ${String(value.year)} — ${String(value.scope)}`;
  return {
    composition: byEntity ? "ranking" : "group-comparison",
    charts: [chart(source, byEntity ? "ranking" : "grupos", title, "groups", "group", [["participationPct", "Participación oficial (%)"]], byEntity ? "descending" : undefined)],
    tables: [table(source, "tabla", `Detalle por ${label}`, "groups", [
      ["group", capitalize(label)],
      ["voted", "Votaron"],
      ["classified", "Votaron + no votaron"],
      ["participationPct", "Participación oficial (%)"],
      ["nominalParticipationPct", "Participación nominal (%)"],
    ], groups.length)],
    metrics: [],
    notes: warningNotes(source),
  };
}

function comparisonDraft(source: UiDataSource): Draft | undefined {
  const value = data(source);
  const elections = rowsOf(value.elections).filter((row) => row.hasData === true && typeof row.participationPct === "number");
  if (elections.length === 0) return insufficient([source]);
  const scope = String(value.scope);
  const years = elections.map((row) => String(row.year));
  const electionTable = table(source, "tabla", `Detalle por elección — ${scope}`, "elections", [
    ["year", "Año"],
    ["voted", "Votaron"],
    ["classified", "Votaron + no votaron"],
    ["participationPct", "Participación oficial (%)"],
    ["nominalList", "Lista nominal"],
    ["nominalParticipationPct", "Participación nominal (%)"],
  ], 6);
  if (rowsOf(value.elections).length === 2) {
    const change = rowsOf(value.changes)[0];
    return {
      composition: "two-elections",
      charts: [chart(source, "barras", `Participación oficial ${years.join(" y ")} — ${scope}`, "elections", "year", [["participationPct", "Participación oficial (%)"]], undefined, "bar")],
      tables: [electionTable],
      metrics: typeof change?.participationPoints === "number"
        ? [{ id: "delta", type: "metric", label: "Cambio en puntos porcentuales", value: ref(source, "changes.0.participationPoints"), format: "number" }]
        : [],
      notes: warningNotes(source),
    };
  }
  return {
    composition: "timeline",
    charts: [chart(source, "linea-tiempo", `Participación oficial por elección — ${scope}`, "elections", "year", [["participationPct", "Participación oficial (%)"]], undefined, "line")],
    tables: [electionTable],
    metrics: [],
    notes: warningNotes(source),
  };
}

function ageSexDraft(source: UiDataSource): Draft | undefined {
  const value = data(source);
  const rows = rowsOf(value.rows).filter((row) => typeof row.menParticipationPct === "number" || typeof row.womenParticipationPct === "number");
  if (rows.length === 0) return insufficient([source]);
  return {
    composition: "age-sex",
    charts: [chart(source, "piramide", `Participación por edad y sexo, ${String(value.year)} — ${String(value.scope)}`, "rows", "ageGroup", [
      ["menParticipationPct", "Hombres (%)"],
      ["womenParticipationPct", "Mujeres (%)"],
    ], undefined, "bar")],
    tables: [table(source, "evidencia", "Evidencia por grupo de edad", "rows", [
      ["ageGroup", "Grupo de edad"],
      ["menVoted", "Hombres que votaron"],
      ["menClassified", "Hombres clasificados"],
      ["menParticipationPct", "Hombres (%)"],
      ["womenVoted", "Mujeres que votaron"],
      ["womenClassified", "Mujeres clasificadas"],
      ["womenParticipationPct", "Mujeres (%)"],
    ], rows.length)],
    metrics: [],
    notes: [],
  };
}

function evidenceDraft(source: UiDataSource): Draft | undefined {
  const value = data(source);
  const records = rowsOf(value.records);
  if (records.length === 0) return insufficient([source]);
  return {
    composition: "evidence",
    charts: [],
    tables: [table(source, "registros", `Registros de respaldo, ${String(value.year)} — ${String(value.scope)}`, "records", [
      ["entity", "Entidad"],
      ["sex", "Sexo"],
      ["ageGroup", "Grupo de edad"],
      ["sectionType", "Tipo de sección"],
      ["voted", "Votaron"],
      ["classified", "Votaron + no votaron"],
      ["participationPct", "Participación oficial (%)"],
    ], Math.min(records.length, 60))],
    metrics: [],
    notes: warningNotes(source),
  };
}

function summaryDraft(source: UiDataSource): Draft | undefined {
  const value = data(source);
  if (!isRecord(value.totals) || typeof value.totals.participationPct !== "number") return insufficient([source]);
  return {
    composition: "summary",
    charts: [],
    tables: [table(source, "composicion", `Cómo se reparte la lista nominal, ${String(value.year)} — ${String(value.scope)}`, "composition", [
      ["category", "Categoría"],
      ["count", "Personas"],
      ["nominalSharePct", "% de la lista nominal"],
    ], 3)],
    metrics: [
      { id: "participacion", type: "metric", label: "Participación oficial CCPC", value: ref(source, "totals.participationPct"), format: "percentage" },
      { id: "votaron", type: "metric", label: "Votaron", value: ref(source, "totals.voted"), format: "number" },
      { id: "clasificados", type: "metric", label: "Votaron + no votaron", value: ref(source, "totals.classified"), format: "number" },
    ],
    notes: warningNotes(source),
  };
}

function insufficient(sources: readonly UiDataSource[]): Draft {
  const scopes = unique(sources.map((source) => String(data(source).scope ?? "")).filter(Boolean));
  return {
    composition: "insufficient-data",
    charts: [],
    tables: [],
    metrics: [],
    notes: [
      {
        id: "sin-datos",
        type: "alert",
        severity: "info",
        text: `No hay datos de participación para ${scopes.join(", ") || "esos filtros"}. La falta de registros no indica la participación real.`,
      },
      {
        id: "sugerencias",
        type: "text",
        variant: "body",
        text: "Prueba con otro año de elección (2009, 2012, 2015, 2018, 2021 o 2024), con otra entidad o con menos filtros.",
      },
    ],
  };
}

function assemble(draft: Draft, input: UiGenerationInput, sources: readonly UiDataSource[]): UiDocument {
  const request = latestUiRequest(input.query);
  const preferences = readUiPreferences(input.query);
  const presentation = safePresentation(input.query);
  const forbidTables = preferences.forbidTables || ONLY_CHART.test(request);
  const forbidCharts = preferences.forbidCharts || ONLY_TABLE.test(request);
  const tableFirst = presentation.includes("table") && !presentation.includes("chart");
  const componentPlan = planCivicComponents({
    composition: draft.composition,
    presentation,
    forbidCharts,
  });

  const charts = forbidCharts ? [] : draft.charts.map((node) => (
    draft.composition === "ranking"
      && presentation.includes("chart")
      && node.type === "chart"
      ? { ...node, id: "grafica-comparacion-territorial" }
      : node
  ));
  const requestedMatrix: UiNode[] = componentPlan.includes("comparisonMatrix") && draft.tables[0]
    ? [{ ...draft.tables[0], id: "matriz-comparativa" }]
    : [];
  const tables = forbidTables || requestedMatrix.length > 0 ? [] : draft.tables;
  const requestedMap: UiNode[] = componentPlan.includes("mexicoChoropleth")
    && draft.composition === "ranking"
    && charts[0]?.type === "chart"
    ? [{ ...charts[0], id: "mapa" }]
    : [];
  const evidence = tableFirst
    ? [...tables, ...requestedMatrix, ...requestedMap, ...charts]
    : [...requestedMap, ...requestedMatrix, ...charts, ...tables];
  const children: UiNode[] = [];
  if (presentation.includes("map") && !CIVIC_RUNTIME_CAPABILITIES.map) {
    children.push({
      id: "mapa-no-disponible",
      type: "alert",
      severity: "info",
      text: draft.composition === "ranking"
        ? "El mapa por entidad todavía no está disponible; te muestro el ranking con las mismas cifras."
        : "El mapa por entidad todavía no está disponible para esta consulta.",
    });
  }
  if (componentPlan.includes("civicInsight")) {
    children.push({ id: "relato", type: "text", variant: "body", text: input.answer.slice(0, 2_000) });
  }
  if (sources.some((source) => data(source).isSampleData === true)) {
    children.push({ id: "aviso-muestra", type: "alert", severity: "warning", text: "Datos de muestra: estas cifras no son totales estatales ni nacionales." });
  }
  if (draft.metrics.length > 0) {
    children.push({ id: "metricas", type: "grid", columnCount: Math.min(3, draft.metrics.length), children: draft.metrics });
  }
  children.push(...evidence, ...draft.notes);
  const sourceNames = unique(sources.flatMap((source) => {
    const info = data(source).source;
    return isRecord(info) && typeof info.name === "string" ? [info.name] : [];
  }));
  if (sourceNames.length > 0) {
    children.push({ id: "fuente", type: "text", variant: "caption", text: `Fuente: ${sourceNames.join("; ")}.` });
  }
  return { version: "1.0", root: { id: `composicion-${draft.composition}`, type: "stack", direction: "vertical", children } };
}

function textComposition(query: string, answer: string): UiDocument {
  const methodology = safeAnalysis(query) === "methodology";
  const children: UiNode[] = [{ id: "respuesta", type: "text", variant: "body", text: answer.slice(0, 2_000) }];
  if (methodology) {
    children.push(
      ...METHODOLOGY_POINTS.map((text, index): UiNode => ({ id: `metodologia-${index + 1}`, type: "text", variant: "body", text })),
      { id: "fuente", type: "text", variant: "caption", text: "Fuente: Conteos Censales de Participación Ciudadana (CCPC), INE." },
    );
  }
  return {
    version: "1.0",
    root: {
      id: methodology ? "composicion-methodology" : "composicion-guidance",
      type: "card",
      title: methodology ? "Cómo se calcula la participación" : "Participación ciudadana",
      children,
    },
  };
}

function chart(
  source: UiDataSource,
  suffix: string,
  title: string,
  path: string,
  categoryKey: string,
  series: Array<[string, string]>,
  sort?: "ascending" | "descending",
  chartType: "bar" | "line" = "bar",
): UiNode {
  return {
    id: `grafica-${suffix}`,
    type: "chart",
    title: title.slice(0, 160),
    chartType,
    data: ref(source, path),
    categoryKey,
    series: series.map(([key, label]) => ({ key, label })),
    ...(sort ? { sort } : {}),
  };
}

function table(source: UiDataSource, suffix: string, title: string, path: string, columns: Array<[string, string]>, maxRows: number): UiNode {
  const rows = rowsOf(readPath(data(source), path));
  const available = columns.filter(([key]) => rows.some((row) => row[key] !== undefined));
  return {
    id: `tabla-${suffix}`,
    type: "table",
    title: title.slice(0, 160),
    data: ref(source, path),
    columns: available.map(([key, label]) => ({ key, label })),
    maxRows: Math.max(1, Math.min(maxRows, 100)),
  };
}

function warningNotes(source: UiDataSource): UiNode[] {
  const warnings = rowsOf(data(source).warnings)
    .flatMap((warning) => (typeof warning.message === "string" && warning.code !== "SAMPLE_DATA" ? [warning.message] : []))
    .slice(0, 3);
  return warnings.map((text, index) => ({ id: `nota-${index + 1}`, type: "alert", severity: "info", text: text.slice(0, 500) }));
}

function ref(source: UiDataSource, path: string): UiDataReference {
  return { sourceId: source.id, path };
}

function safePresentation(query: string): readonly string[] {
  try {
    return interpretCivicQuery(latestUiRequest(query)).presentation;
  } catch {
    return [];
  }
}

function safeAnalysis(query: string): string | undefined {
  try {
    return interpretCivicQuery(query).analysis;
  } catch {
    return undefined;
  }
}

function dimensionLabel(dimension: string): string {
  if (dimension === "grupo_edad") return "grupo de edad";
  if (dimension === "tipo_seccion") return "tipo de sección";
  return dimension;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function data(source: UiDataSource): Record<string, unknown> {
  return source.data as Record<string, unknown>;
}

function rowsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
