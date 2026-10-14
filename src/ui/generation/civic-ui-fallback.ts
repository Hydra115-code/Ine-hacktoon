import { type UiDataSource, type UiDocument, type UiNode } from "../dsl/ui.schema.js";

/**
 * Interfaz de respaldo SIN IA: se arma con reglas fijas a partir de los datos
 * de las tools cívicas. Se usa cuando el modelo no logra generar una interfaz
 * válida, y sirve de base si el equipo decide no usar un modelo para la UI.
 *
 * Siempre cumple las reglas mínimas: tabla como evidencia, fuente visible,
 * aviso de datos de ejemplo y cada fuente en su propia tarjeta (sin mezclar
 * el total Nacional con entidades).
 */

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
      text: "Datos de ejemplo: estas cifras no son resultados oficiales.",
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

  switch (source.toolName) {
    case "get_participation_summary": {
      const process = isRecord(data.process) ? data.process : {};
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Participación ${String(process.year ?? "")} — ${String(data.entity ?? "")}`.trim(),
        children: [
          {
            id: id("metricas"),
            type: "grid",
            columnCount: 3,
            children: [
              { id: id("participacion"), type: "metric", label: "Participación", value: ref("participation.turnoutPercentage"), format: "percentage" },
              { id: id("votos"), type: "metric", label: "Votos totales", value: ref("participation.totalVotes"), format: "number" },
              { id: id("lista"), type: "metric", label: "Lista nominal", value: ref("participation.nominalList"), format: "number" },
            ],
          },
          {
            id: id("grafica"),
            type: "chart",
            title: "Votos por partido",
            chartType: "bar",
            data: ref("results"),
            categoryKey: "party",
            series: [{ key: "votes", label: "Votos" }],
          },
          {
            id: id("tabla"),
            type: "table",
            title: "Detalle por partido",
            data: ref("results"),
            columns: [
              { key: "party", label: "Partido" },
              { key: "votes", label: "Votos" },
              { key: "percentage", label: "Porcentaje" },
            ],
            maxRows: 30,
          },
        ],
      };
    }
    case "compare_elections": {
      const notes = Array.isArray(data.methodologyNotes)
        ? data.methodologyNotes.filter((note): note is string => typeof note === "string")
        : [];
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Comparación de participación — ${String(data.entity ?? "")}`.trim(),
        children: [
          { id: id("cambio"), type: "metric", label: "Cambio de participación (puntos porcentuales)", value: ref("turnoutChange.points"), format: "number" },
          {
            id: id("grafica"),
            type: "chart",
            title: "Participación por año",
            chartType: "bar",
            data: ref("elections"),
            categoryKey: "year",
            series: [{ key: "turnoutPercentage", label: "Participación" }],
          },
          {
            id: id("tabla"),
            type: "table",
            title: "Detalle por año",
            data: ref("elections"),
            columns: [
              { key: "year", label: "Año" },
              { key: "totalVotes", label: "Votos totales" },
              { key: "nominalList", label: "Lista nominal" },
              { key: "turnoutPercentage", label: "Participación" },
            ],
            maxRows: 10,
          },
          ...notes.map((note, noteIndex): UiNode => ({ id: id(`nota-${noteIndex + 1}`), type: "alert", severity: "info", text: note })),
        ],
      };
    }
    case "get_participation_breakdown": {
      const labels: Record<string, string> = { entidad: "Entidad", sexo: "Sexo", grupo_edad: "Grupo de edad" };
      const label = labels[String(data.dimension)] ?? "Grupo";
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Participación por ${label.toLowerCase()} — ${String(data.scope ?? "")}`.trim(),
        children: [
          {
            id: id("grafica"),
            type: "chart",
            title: `Participación por ${label.toLowerCase()}`,
            chartType: "bar",
            data: ref("groups"),
            categoryKey: "group",
            series: [{ key: "turnoutPercentage", label: "Participación" }],
          },
          {
            id: id("tabla"),
            type: "table",
            title: `Detalle por ${label.toLowerCase()}`,
            data: ref("groups"),
            columns: [
              { key: "group", label },
              { key: "voters", label: "Votantes" },
              { key: "nominalList", label: "Lista nominal" },
              { key: "turnoutPercentage", label: "Participación" },
            ],
            maxRows: 40,
          },
          ...(typeof data.coverageNote === "string"
            ? [{ id: id("cobertura"), type: "alert" as const, severity: "info" as const, text: data.coverageNote }]
            : []),
        ],
      };
    }
    case "get_supporting_records":
      return {
        id: id("tarjeta"),
        type: "card",
        title: `Registros de respaldo — ${String(data.entity ?? "")}`.trim(),
        children: [{
          id: id("tabla"),
          type: "table",
          title: "Cifras y cómo se obtienen",
          data: ref("records"),
          columns: [
            { key: "label", label: "Cifra" },
            { key: "value", label: "Valor" },
            { key: "kind", label: "Tipo" },
            { key: "derivation", label: "Cálculo" },
          ],
          maxRows: 60,
        }],
      };
    default:
      return undefined;
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
