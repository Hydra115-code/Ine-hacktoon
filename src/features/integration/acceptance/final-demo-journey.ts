export interface FinalDemoStep {
  id: "initial-comparison" | "table-only" | "restore-source";
  prompt: string;
  expectedVisible: readonly string[];
  expectedHidden?: readonly string[];
  dataRequest: "required" | "not-required";
}

/**
 * Recorrido mínimo de aceptación para la demo final.
 *
 * Se mantiene en código para que QA, producto y la interfaz prueben exactamente
 * las mismas instrucciones, sin depender de preguntas improvisadas.
 */
export const FINAL_DEMO_JOURNEY = [
  {
    id: "initial-comparison",
    prompt: "Compara la participación de Aguascalientes entre 2018 y 2024. Elige la forma más clara de mostrarlo y deja visible la evidencia que sustenta la comparación.",
    expectedVisible: ["visualization", "table", "source", "methodology"],
    dataRequest: "required",
  },
  {
    id: "table-only",
    prompt: "Quita la gráfica y conserva únicamente la tabla.",
    expectedVisible: ["table"],
    expectedHidden: ["visualization", "mexicoChoropleth", "participationTimeline"],
    dataRequest: "not-required",
  },
  {
    id: "restore-source",
    prompt: "Muéstrame la fuente y la metodología de esta comparación.",
    expectedVisible: ["table", "source", "methodology"],
    expectedHidden: ["visualization", "mexicoChoropleth", "participationTimeline"],
    dataRequest: "not-required",
  },
] as const satisfies readonly FinalDemoStep[];

