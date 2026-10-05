export type ElectoralExplorationIntentId =
  | "participation-over-time"
  | "territory-comparison"
  | "evidence-review";

export interface ElectoralExplorationIntent {
  id: ElectoralExplorationIntentId;
  label: string;
  title: string;
  description: string;
  prompt: string;
  focus: "period" | "territory" | "evidence";
}

/**
 * Entry points for the first electoral story. They describe questions, never
 * results: values must arrive from the connected public-data source.
 */
export const electoralExplorationIntents = [
  {
    id: "participation-over-time",
    label: "Evolución",
    title: "Entender un cambio",
    description: "Compara periodos disponibles y distingue la tendencia de la evidencia que la respalda.",
    prompt: "¿Cómo ha cambiado la participación electoral en mi entidad entre los periodos disponibles? Muestra la evidencia que sustenta la comparación.",
    focus: "period",
  },
  {
    id: "territory-comparison",
    label: "Territorio",
    title: "Comparar lugares",
    description: "Contrasta territorios equivalentes dentro del mismo proceso y conserva el contexto de lectura.",
    prompt: "Compara la participación entre municipios de una misma entidad para el proceso disponible y explica qué diferencias son relevantes.",
    focus: "territory",
  },
  {
    id: "evidence-review",
    label: "Evidencia",
    title: "Revisar el sustento",
    description: "Pide una vista clara y mantén visibles los registros y la procedencia de cada conclusión.",
    prompt: "Muéstrame los patrones territoriales de participación que merecen atención y deja visibles los registros y fuentes que respaldan la lectura.",
    focus: "evidence",
  },
] as const satisfies readonly ElectoralExplorationIntent[];
