import type { UINode, UISpecification } from "@ine/contracts";
import { cleanGeneratedCopy } from "../../generative-ui/primitives/content/clean-generated-copy.ts";
import type { PaperResultIntroData } from "../types/paper-result-intro.ts";

interface BuildPaperResultIntroOptions {
  hasBoundData?: boolean;
}

const evidenceNodeTypes = new Set<UINode["type"]>([
  "metric",
  "visualization",
  "table",
  "electionDelta",
  "territoryRanking",
  "participationTimeline",
  "dataQualityBadge",
  "demographicBreakdown",
  "comparisonMatrix",
  "evidenceSummary",
  "civicInsight",
  "mexicoChoropleth",
]);

const internalVocabulary = /\b(?:json|zod|http|mcp|gemini|schema|binding|registry|payload|stack trace)\b/iu;
const instructionalOpening = /^(?:explora|compara|revisa|selecciona|usa|consulta|filtra|ordena|elige|puedes)\b/iu;

interface SpecificationReading {
  evidenceCount: number;
  firstHeading?: string;
  narrativeCandidates: string[];
  presentationTypes: Set<"map" | "timeline" | "chart" | "table" | "metrics">;
}

function visitSpecification(root: UINode): SpecificationReading {
  const reading: SpecificationReading = {
    evidenceCount: 0,
    narrativeCandidates: [],
    presentationTypes: new Set(),
  };
  const pending = [root];

  while (pending.length > 0) {
    const node = pending.shift();
    if (!node) continue;

    if (evidenceNodeTypes.has(node.type)) reading.evidenceCount += 1;
    if (node.type === "heading" && !reading.firstHeading) reading.firstHeading = node.content;
    if (node.type === "text" && node.variant !== "caption") reading.narrativeCandidates.push(node.content);

    if (node.type === "mexicoChoropleth") reading.presentationTypes.add("map");
    else if (node.type === "participationTimeline") reading.presentationTypes.add("timeline");
    else if (node.type === "visualization") reading.presentationTypes.add("chart");
    else if (node.type === "table" || node.type === "comparisonMatrix") reading.presentationTypes.add("table");
    else if (["metric", "electionDelta", "territoryRanking", "demographicBreakdown", "evidenceSummary"].includes(node.type)) {
      reading.presentationTypes.add("metrics");
    }

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

  return reading;
}

function normalizeSentence(content: string, maximumLength = 220): string | null {
  const cleaned = cleanGeneratedCopy(content).replace(/\s+/gu, " ").trim();
  if (cleaned.length < 24 || internalVocabulary.test(cleaned) || instructionalOpening.test(cleaned)) return null;

  const firstSentence = /^.*?[.!?](?=\s|$)/u.exec(cleaned)?.[0] ?? cleaned;
  const shortened = firstSentence.length <= maximumLength
    ? firstSentence
    : `${firstSentence.slice(0, maximumLength - 1).trimEnd()}…`;
  return /[.!?…]$/u.test(shortened) ? shortened : `${shortened}.`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "una vista clara";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

function describePresentation(types: SpecificationReading["presentationTypes"]): string[] {
  const labels: string[] = [];
  if (types.has("map")) labels.push("un mapa");
  if (types.has("timeline")) labels.push("una línea de tiempo");
  if (types.has("chart")) labels.push("una gráfica");
  if (types.has("table")) labels.push("una tabla verificable");
  if (types.has("metrics")) labels.push("indicadores clave");
  return labels.slice(0, 3);
}

function fallbackSummary(types: SpecificationReading["presentationTypes"]): string {
  if (types.has("map")) return "Organicé la información por territorio para que puedas reconocer diferencias y explorar cada entidad.";
  if (types.has("timeline")) return "Organicé la información por periodo para que puedas seguir cómo cambia la participación.";
  if (types.has("table")) return "Organicé los resultados disponibles para que puedas compararlos y revisar su evidencia.";
  return "Organicé la información disponible para que puedas entenderla y comprobarla paso a paso.";
}

export function buildPaperResultIntro(
  specification: UISpecification | null | undefined,
  options: BuildPaperResultIntroOptions = {},
): PaperResultIntroData | null {
  if (!specification) return null;
  const reading = visitSpecification(specification.root);
  const normalizedHeading = reading.firstHeading?.trim().toLocaleLowerCase("es-MX");
  const observedSummary = reading.narrativeCandidates
    .map((candidate) => normalizeSentence(candidate))
    .find((candidate) => candidate && candidate.toLocaleLowerCase("es-MX") !== normalizedHeading);
  const presentation = describePresentation(reading.presentationTypes);

  return {
    summary: observedSummary ?? fallbackSummary(reading.presentationTypes),
    presentationReason: `Preparé ${formatList(presentation)} para que puedas explorar la respuesta y verificar la evidencia.`,
    summaryKind: observedSummary ? "observation" : "orientation",
    ...(reading.evidenceCount > 0 ? { evidenceCount: reading.evidenceCount } : {}),
    ...(options.hasBoundData ? { sourceLabel: "Datos vinculados a esta vista" } : {}),
  };
}
