import mexicoMapAsset from "../../generative-ui/geography/mexico-states.paths.json" with { type: "json" };
import type { PaperInteractionReaction } from "../types/paper-interaction.js";

export interface PaperObservableUIEvent {
  name: string;
  value?: string | number | boolean | string[] | { start: string; end: string } | null;
  isValid: boolean;
}

const labelsByCode = new Map(mexicoMapAsset.states.map((state) => [state.code, state.name]));

function cleanLabel(value: unknown, maximum = 64) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[<>\n\r\t]/gu, " ").replace(/\s+/gu, " ").trim();
  return cleaned.length > 0 ? cleaned.slice(0, maximum) : undefined;
}

function territoryLabel(value: unknown) {
  const label = cleanLabel(value);
  return label ? labelsByCode.get(label.padStart(2, "0")) ?? label : undefined;
}

function periodsLabel(value: unknown) {
  const periods = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => cleanLabel(entry, 16) ?? [])
    .slice(0, 4);
  if (periods.length === 0) return undefined;
  if (periods.length === 1) return periods[0];
  return `${periods.slice(0, -1).join(", ")} y ${periods.at(-1)}`;
}

export function buildPaperInteractionReaction(event: PaperObservableUIEvent): PaperInteractionReaction | null {
  if (!event.isValid) return null;
  const name = event.name.toLocaleLowerCase("es-MX");

  if (name === "map.entity_selected" || /(?:territory|entity)\.(?:selected|changed)$/u.test(name)) {
    const territory = territoryLabel(event.value);
    return {
      kind: "territory.selected",
      message: territory ? `Ahora estamos observando ${territory}.` : "Ahora estamos observando el territorio que elegiste.",
      mood: "pointing",
    };
  }

  if (name === "period.changed" || /periods?_(?:selected|changed)$/u.test(name) || /periods?\.(?:selected|changed)$/u.test(name)) {
    const periods = periodsLabel(event.value);
    return {
      kind: "period.changed",
      message: periods ? `La vista ahora considera ${periods}.` : "Actualicé el periodo de la comparación.",
      mood: "presenting",
    };
  }

  if (/(?:chart|graph|visualization)\.(?:removed|hidden)$/u.test(name)) {
    return { kind: "chart.removed", message: "Quité la gráfica y conservé la evidencia restante.", mood: "approving" };
  }

  if (/^table\.filter\./u.test(name) || name === "table.filtered") {
    const query = cleanLabel(event.value, 40);
    return {
      kind: "table.filtered",
      message: query ? `La tabla muestra coincidencias para «${query}».` : "La tabla vuelve a mostrar todos los resultados.",
      mood: "pointing",
    };
  }

  if (/^table\.sort\./u.test(name) || name === "table.sorted") {
    return { kind: "table.sorted", message: "Ordené la tabla por la columna que elegiste.", mood: "approving" };
  }

  if (name === "methodology.opened" || /methodology\.(?:opened|viewed)$/u.test(name)) {
    return { kind: "methodology.opened", message: "Aquí puedes revisar cómo se preparó esta comparación.", mood: "presenting" };
  }

  if (name === "view.restored") {
    return { kind: "view.restored", message: "Recuperé la última vista válida sin cambiar sus datos.", mood: "approving" };
  }

  return null;
}
