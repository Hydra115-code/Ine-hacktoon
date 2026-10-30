import { type UiDataSource, type UiDocument, type UiNode } from "../dsl/ui.schema.js";

const MAX_SOURCES = 4;

export function createCivicUiFallback(dataSources: readonly UiDataSource[]): UiDocument | undefined {
  const sources = dataSources.filter((source) => isRecord(source.data)).slice(0, MAX_SOURCES);
  const cards = sources.flatMap((source, index) => {
    const card = cardFor(source, index);
    return card ? [card] : [];
  });
  if (cards.length === 0) return undefined;

  const children: UiNode[] = [];
  if (sources.some((source) => (source.data as Record<string, unknown>).isSampleData === true)) {
    children.push({
      id: "aviso-datos-ejemplo",
      type: "alert",
      severity: "warning",
      text: "Datos de muestra: estas cifras no son totales estatales ni nacionales.",
    });
  }
  children.push(...cards);
  const sourceNames = unique(sources.flatMap((source) => {
    const sourceInfo = (source.data as Record<string, unknown>).source;
    return isRecord(sourceInfo) && typeof sourceInfo.name === "string" ? [sourceInfo.name] : [];
  }));
  if (sourceNames.length > 0) {
    children.push({ id: "fuente", type: "text", variant: "caption", text: `Fuente: ${sourceNames.join("; ")}.` });
  }

  return { version: "1.0", root: { id: "respuesta-civica", type: "stack", direction: "vertical", children } };
}

function cardFor(source: UiDataSource, index: number): UiNode | undefined {
  const data = source.data as Record<string, unknown>;
  const id = (suffix: string) => `fuente-${index + 1}-${suffix}`;
  const ref = (path: string) => ({ sourceId: source.id, path });
  const scope = String(data.scope ?? "");
  const notes = warningNotes(data, id);

  if (data.status === "no_data") {
    return {
      id: id("tarjeta"),
      type: "card",
      title: `Sin datos — ${scope}`,
      children: [{ id: id("sin-datos"), type: "alert", severity: "info", text: "No hay datos para estos filtros. La ausencia de datos no significa participación cero." }],
    };
  }

  switch (source.toolName) {
    case "get_participation_summary":
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Participación ${String(data.year ?? "")} — ${scope}`,
        children: [
          {
            id: id("metricas"),
            type: "grid",
            columnCount: 3,
            children: [
              { id: id("participacion"), type: "metric", label: "Participación oficial CCPC", value: ref("totals.participationPct"), format: "percentage" },
              { id: id("votaron"), type: "metric", label: "Votaron", value: ref("totals.voted"), format: "number" },
              { id: id("clasificados"), type: "metric", label: "Votaron + no votaron", value: ref("totals.classified"), format: "number" },
              { id: id("nominal"), type: "metric", label: "Participación nominal", value: ref("totals.nominalParticipationPct"), format: "percentage" },
              { id: id("lista"), type: "metric", label: "Lista nominal", value: ref("totals.nominalList"), format: "number" },
              { id: id("no-especificado"), type: "metric", label: "No especificado", value: ref("totals.unspecified"), format: "number" },
            ],
          },
          {
            id: id("tabla"),
            type: "table",
            title: "Cómo se reparte la lista nominal",
            data: ref("composition"),
            columns: [
              { key: "category", label: "Categoría" },
              { key: "count", label: "Personas" },
              { key: "nominalSharePct", label: "% de la lista nominal" },
            ],
            maxRows: 3,
          },
          ...notes,
        ],
      };
    case "compare_elections":
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Participación por año — ${scope}`,
        children: [
          {
            id: id("grafica"),
            type: "chart",
            title: "Participación oficial CCPC por año (%)",
            chartType: "line",
            data: ref("elections"),
            categoryKey: "year",
            series: [{ key: "participationPct", label: "Participación (%)" }],
          },
          {
            id: id("tabla"),
            type: "table",
            title: "Detalle por año",
            data: ref("elections"),
            columns: [
              { key: "year", label: "Año" },
              { key: "voted", label: "Votaron" },
              { key: "classified", label: "Votaron + no votaron" },
              { key: "participationPct", label: "Participación oficial (%)" },
              { key: "nominalList", label: "Lista nominal" },
              { key: "nominalParticipationPct", label: "Participación nominal (%)" },
            ],
            maxRows: 6,
          },
          {
            id: id("cambios"),
            type: "table",
            title: "Cambio respecto al primer año (puntos porcentuales)",
            data: ref("changes"),
            columns: [
              { key: "year", label: "Año" },
              { key: "baselineYear", label: "Comparado con" },
              { key: "participationPoints", label: "Participación oficial (pp)" },
              { key: "nominalParticipationPoints", label: "Participación nominal (pp)" },
            ],
            maxRows: 5,
          },
          ...notes,
        ],
      };
    case "get_participation_breakdown": {
      const labels: Record<string, string> = { entidad: "Entidad", sexo: "Sexo", grupo_edad: "Grupo de edad", tipo_seccion: "Tipo de sección" };
      const label = labels[String(data.dimension)] ?? "Grupo";
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Participación ${String(data.year ?? "")} por ${label.toLowerCase()} — ${scope}`,
        children: [
          {
            id: id("grafica"),
            type: "chart",
            title: `Participación oficial CCPC por ${label.toLowerCase()} (%)`,
            chartType: "bar",
            data: ref("groups"),
            categoryKey: "group",
            series: [{ key: "participationPct", label: "Participación (%)" }],
          },
          {
            id: id("tabla"),
            type: "table",
            title: `Detalle por ${label.toLowerCase()}`,
            data: ref("groups"),
            columns: [
              { key: "group", label },
              { key: "voted", label: "Votaron" },
              { key: "classified", label: "Votaron + no votaron" },
              { key: "participationPct", label: "Participación oficial (%)" },
              { key: "nominalList", label: "Lista nominal" },
            ],
            maxRows: 40,
          },
          ...(typeof data.coverageNote === "string"
            ? [{ id: id("cobertura"), type: "alert" as const, severity: "info" as const, text: data.coverageNote }]
            : []),
          ...notes,
        ],
      };
    }
    case "get_supporting_records":
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Registros de respaldo ${String(data.year ?? "")} — ${scope}`,
        children: [
          {
            id: id("tabla"),
            type: "table",
            title: "Grupos de la fuente",
            data: ref("records"),
            columns: [
              { key: "entity", label: "Entidad" },
              { key: "sex", label: "Sexo" },
              { key: "ageGroup", label: "Edad" },
              { key: "sectionType", label: "Tipo de sección" },
              { key: "nominalList", label: "Lista nominal" },
              { key: "voted", label: "Votaron" },
              { key: "didNotVote", label: "No votaron" },
              { key: "unspecified", label: "No especificado" },
            ],
            maxRows: 60,
          },
          ...notes,
        ],
      };
    default:
      return undefined;
  }
}

function warningNotes(data: Record<string, unknown>, id: (suffix: string) => string): UiNode[] {
  const shown = new Set(["NS_EXCLUDED_FROM_CCPC", "ELECTIONS_NOT_A_PANEL", "CARTOGRAPHIC_FRAMES_DIFFER", "SMALL_CELLS", "NON_BINARY_UNAVAILABLE", "DEFAULT_YEAR_SELECTED"]);
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  return warnings.flatMap((warning, index): UiNode[] => (
    isRecord(warning) && typeof warning.code === "string" && shown.has(warning.code) && typeof warning.message === "string"
      ? [{ id: id(`aviso-${index + 1}`), type: "alert", severity: "info", text: warning.message }]
      : []
  ));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
