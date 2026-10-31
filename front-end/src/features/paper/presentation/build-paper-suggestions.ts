import type { UINode, UISpecification } from "@ine/contracts";
import type { PaperSuggestion, PaperSuggestionFocus } from "../types/paper-suggestion.js";

interface BuildPaperSuggestionsOptions {
  hasBoundData?: boolean;
  maximum?: number;
}

interface ViewCapabilities {
  chart: boolean;
  comparison: boolean;
  demographic: boolean;
  evidence: boolean;
  map: boolean;
  table: boolean;
  timeline: boolean;
}

function readCapabilities(root: UINode): ViewCapabilities {
  const capabilities: ViewCapabilities = {
    chart: false,
    comparison: false,
    demographic: false,
    evidence: false,
    map: false,
    table: false,
    timeline: false,
  };
  const pending = [root];

  while (pending.length > 0) {
    const node = pending.shift();
    if (!node) continue;
    if (node.type === "mexicoChoropleth" || node.type === "territoryRanking") capabilities.map = true;
    if (node.type === "participationTimeline") capabilities.timeline = true;
    if (node.type === "visualization") capabilities.chart = true;
    if (node.type === "table") capabilities.table = true;
    if (node.type === "electionDelta" || node.type === "comparisonMatrix") capabilities.comparison = true;
    if (node.type === "demographicBreakdown") capabilities.demographic = true;
    if (["dataQualityBadge", "evidenceSummary", "civicInsight"].includes(node.type)) capabilities.evidence = true;

    if ("children" in node) pending.push(...node.children);
    if (node.type === "tabs" || node.type === "accordion") {
      node.items.forEach((item) => pending.push(...item.children));
    } else if (node.type === "repeat") {
      pending.push(node.template);
      if (node.empty) pending.push(node.empty);
    } else if (node.type === "conditional") {
      pending.push(node.then);
      if (node.else) pending.push(node.else);
    }
  }

  return capabilities;
}

function addUnique(suggestions: PaperSuggestion[], suggestion: PaperSuggestion) {
  if (suggestions.some((current) => current.focus === suggestion.focus)) return;
  suggestions.push(suggestion);
}

export function buildPaperSuggestions(
  specification: UISpecification | null | undefined,
  options: BuildPaperSuggestionsOptions = {},
): PaperSuggestion[] {
  if (!specification) return [];
  const capabilities = readCapabilities(specification.root);
  const suggestions: PaperSuggestion[] = [];

  if (capabilities.map) {
    addUnique(suggestions, {
      id: "compare-visible-territories",
      label: "Territorio",
      title: "Comparar entidades",
      description: "Contrasta lugares equivalentes y conserva el contexto de la fuente.",
      prompt: "Compara las entidades con los valores más altos y más bajos de esta vista. Mantén visibles los datos que sustentan la comparación.",
      focus: "territory",
    });
  }

  if (capabilities.timeline || capabilities.comparison) {
    addUnique(suggestions, {
      id: "explain-period-change",
      label: "Periodos",
      title: "Explicar el cambio",
      description: "Profundiza en la diferencia sin convertir una asociación en una causa.",
      prompt: "Profundiza en el cambio entre los periodos disponibles y distingue claramente lo observado de cualquier posible explicación.",
      focus: "period",
    });
  }

  if (capabilities.demographic) {
    addUnique(suggestions, {
      id: "compare-population-groups",
      label: "Población",
      title: "Comparar grupos",
      description: "Revisa segmentos equivalentes y mantén visibles sus universos.",
      prompt: "Compara los grupos de población disponibles y muestra el universo usado para calcular cada resultado.",
      focus: "population",
    });
  }

  if (capabilities.chart && capabilities.table) {
    addUnique(suggestions, {
      id: "focus-on-table",
      label: "Presentación",
      title: "Dejar sólo la tabla",
      description: "Simplifica la vista sin perder los valores verificables.",
      prompt: "Quita la gráfica y conserva únicamente la tabla con los mismos datos, ordenada de mayor a menor.",
      focus: "presentation",
    });
  } else if (capabilities.chart && !capabilities.table) {
    addUnique(suggestions, {
      id: "add-verifiable-table",
      label: "Presentación",
      title: "Añadir valores exactos",
      description: "Complementa la gráfica con una alternativa tabular verificable.",
      prompt: "Conserva la gráfica y añade una tabla accesible con los valores exactos que la sustentan.",
      focus: "presentation",
    });
  } else if (capabilities.table) {
    addUnique(suggestions, {
      id: "prioritize-table-differences",
      label: "Presentación",
      title: "Priorizar diferencias",
      description: "Ordena los registros para encontrar contrastes con rapidez.",
      prompt: "Ordena la tabla por la diferencia más relevante y conserva visibles las columnas necesarias para verificarla.",
      focus: "presentation",
    });
  }

  if (options.hasBoundData || capabilities.evidence) {
    addUnique(suggestions, {
      id: "review-source-and-method",
      label: "Evidencia",
      title: "Revisar el sustento",
      description: "Comprueba fuente, universo, periodos y advertencias metodológicas.",
      prompt: "Deja visibles la fuente, el universo, los periodos comparados y las advertencias metodológicas de esta vista.",
      focus: "evidence",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "show-evidence-first",
      label: "Siguiente paso",
      title: "Mostrar la evidencia",
      description: "Convierte la lectura actual en una vista que pueda comprobarse.",
      prompt: "Muestra los datos que respaldan esta lectura en la forma más clara y deja visible su fuente.",
      focus: "evidence",
    });
  }

  return suggestions.slice(0, Math.min(Math.max(options.maximum ?? 3, 1), 3));
}
