import { type UiDataSource } from "../../ui/dsl/ui.schema.js";

/**
 * Revisa la respuesta escrita del agente ANTES de que llegue al frontend.
 * Si encuentra un problema, el orquestador le pide al modelo que la repare;
 * si no se puede reparar, la rechaza. Son reglas fijas: no usan IA.
 *
 * Reglas mínimas de BACK-03 que cubre este archivo:
 * - No inventar datos: cada número debe salir de los datos de las tools.
 * - No inferir causalidad: nada de "porque", "debido a", "provocó"...
 * - Diferenciar porcentaje y puntos porcentuales.
 * - No describir datos agregados como personas individuales.
 * - Conservar numerador y denominador junto al porcentaje de participación.
 * - Advertir diferencias metodológicas al comparar procesos.
 * - Conservar la fuente (esto se agrega solo, ver groundCivicAnswer).
 */

export type CivicReasoningIssueCode =
  | "unsupported_number"
  | "causal_claim"
  | "points_as_percentage"
  | "individual_attribution"
  | "missing_numerator_denominator"
  | "missing_methodology_warning";

export interface CivicReasoningIssue {
  code: CivicReasoningIssueCode;
  message: string;
}

export class CivicReasoningError extends Error {
  constructor(readonly issues: readonly CivicReasoningIssue[]) {
    super("La respuesta no está respaldada por los datos electorales consultados");
    this.name = "CivicReasoningError";
  }
}

interface CivicReasoningInput {
  query: string;
  answer: string;
  dataSources: readonly UiDataSource[];
}

/** Números chicos que pueden aparecer como conteos ("3 entidades", "2 procesos"). */
const SMALL_COUNT_LIMIT = 12;
const TOTAL_ENTITIES = 32;

const CAUSAL_PATTERN =
  /\b(?:porque|debido a|a causa de|gracias a|por culpa de|provoc[óo]|caus[óo]|origin[óo]|se explica por|es resultado de|fue resultado de|como consecuencia de)\b/iu;

const CHANGE_VERB_PATTERN =
  /\b(?:aument\p{L}*|disminu\p{L}*|baj\p{L}*|subi\p{L}*|sub[ií]\p{L}*|cay\p{L}*|crec\p{L}*|redu\p{L}*|increment\p{L}*|descend\p{L}*|cambi\p{L}*|vari\p{L}*|diferencia)\b/iu;

const INDIVIDUAL_ATTRIBUTION_PATTERN =
  /\b(?:los|las)\s+(?:\p{L}+(?:enses|eños|eñas|anos|anas|ecos|ecas|ianos|ianas|ses)|mexican[oa]s|ciudadan[oa]s|votantes|electores|mujeres|hombres|jóvenes|j[oó]venes|adult[oa]s(?:\s+mayores)?)\s+(?:votaron por|prefirieron|prefieren|eligieron|eligen|apoyan|apoyaron|decidieron|quieren|rechazaron|castigaron|premiaron)\b/iu;

export function validateCivicReasoning(input: CivicReasoningInput): CivicReasoningIssue[] {
  const civicSources = input.dataSources.filter((source) => isRecord(source.data));
  // Sin datos (saludo, pregunta de capacidades) no hay cifras que revisar.
  if (civicSources.length === 0) return [];

  const issues: CivicReasoningIssue[] = [];
  const answer = input.answer;
  const allowed = collectAllowedNumbers(civicSources, input.query);

  const unsupported = extractNumbers(answer).filter((value) => !isSupportedNumber(value, allowed));
  if (unsupported.length > 0) {
    issues.push({
      code: "unsupported_number",
      message: `La respuesta menciona cifras que no aparecen en los datos consultados: ${unique(unsupported.map((value) => value.raw)).join(", ")}. Usa sólo cifras de las herramientas.`,
    });
  }

  if (CAUSAL_PATTERN.test(answer)) {
    issues.push({
      code: "causal_claim",
      message: "La respuesta atribuye causas. Los datos sólo muestran cifras: describe qué cambió, no por qué.",
    });
  }

  const pointChanges = civicSources
    .map((source) => readPath(source.data, ["turnoutChange", "points"]))
    .filter((value): value is number => typeof value === "number" && value !== 0);
  if (pointChanges.some((points) => mentionsPointsAsPercentage(answer, points))) {
    issues.push({
      code: "points_as_percentage",
      message: "El cambio de participación está en puntos porcentuales, no en porcentaje. Escribe, por ejemplo, \"bajó 1.7 puntos porcentuales\".",
    });
  }

  if (INDIVIDUAL_ATTRIBUTION_PATTERN.test(answer)) {
    issues.push({
      code: "individual_attribution",
      message: "La respuesta describe datos agregados como decisiones de personas. Habla de votos o porcentajes, no de lo que \"prefieren\" o \"eligieron\" las personas.",
    });
  }

  if (mentionsTurnoutPercentage(answer, civicSources) && !mentionsBase(answer, civicSources)) {
    issues.push({
      code: "missing_numerator_denominator",
      message: "Al dar un porcentaje de participación incluye también los votos totales y la lista nominal (por ejemplo, \"60 millones de votos de una lista nominal de 98 millones\").",
    });
  }

  const comparesWithNominalChange = civicSources.some((source) => {
    const notes = readPath(source.data, ["methodologyNotes"]);
    return Array.isArray(notes) && notes.some((note) => typeof note === "string" && /lista nominal cambi/iu.test(note));
  });
  if (comparesWithNominalChange && !/lista nominal|porcentajes?,? no (?:en )?votos/iu.test(answer)) {
    issues.push({
      code: "missing_methodology_warning",
      message: "Entre los procesos comparados cambió la lista nominal: adviértelo y explica que conviene comparar porcentajes, no votos absolutos.",
    });
  }

  return issues;
}

/**
 * Ajustes que no necesitan al modelo: agrega la fuente y el aviso de datos de
 * ejemplo si la respuesta no los menciona.
 */
export function groundCivicAnswer(answer: string, dataSources: readonly UiDataSource[]): string {
  const sources = dataSources.filter((source) => isRecord(source.data));
  if (sources.length === 0) return answer;

  let grounded = answer.trim();
  const isSample = sources.some((source) => readPath(source.data, ["isSampleData"]) === true);
  if (isSample && !/datos de ejemplo|no oficial/iu.test(grounded)) {
    grounded += " (Datos de ejemplo, no oficiales.)";
  }
  const sourceNames = unique(sources
    .map((source) => readPath(source.data, ["source", "name"]))
    .filter((name): name is string => typeof name === "string" && name.length > 0));
  if (sourceNames.length > 0 && !/\bfuente\b/iu.test(grounded)) {
    grounded += ` Fuente: ${sourceNames.join("; ")}.`;
  }
  return grounded;
}

export function createCivicReasoningRepairPrompt(issues: readonly CivicReasoningIssue[]): string {
  return [
    "Tu respuesta anterior no cumple las reglas de presentación de datos electorales. Corrígela:",
    ...issues.map((issue) => `- ${issue.message}`),
    "Responde de nuevo usando únicamente las cifras de las herramientas.",
  ].join("\n");
}

// ---------- Números ----------

interface ExtractedNumber {
  raw: string;
  value: number;
  /** El número venía seguido de "millones" o "mil". */
  scale: 1 | 1_000 | 1_000_000;
}

function extractNumbers(text: string): ExtractedNumber[] {
  // Las fechas ISO (2026-10-08) no son cifras de la respuesta.
  const cleaned = text.replace(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/gu, " ");
  const pattern = /(?<![\p{L}\d.,])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)(?:\s*(millones|millón|mil)\b)?/giu;
  const numbers: ExtractedNumber[] = [];
  for (const match of cleaned.matchAll(pattern)) {
    const token = match[1]!;
    const value = parseSpanishNumber(token);
    if (!Number.isFinite(value)) continue;
    // En "56 y 60 millones", el 56 también son millones.
    const sharedUnit = /^\s*(?:y|o|a|,)\s*\d[\d.,]*\s*(millones|millón|mil)\b/iu
      .exec(cleaned.slice((match.index ?? 0) + match[0].length))?.[1];
    const unit = (match[2] ?? sharedUnit)?.toLowerCase();
    numbers.push({
      raw: match[0].trim(),
      value,
      scale: unit === "mil" ? 1_000 : unit ? 1_000_000 : 1,
    });
  }
  return numbers;
}

function parseSpanishNumber(token: string): number {
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/u.test(token)) return Number(token.replace(/,/gu, ""));
  // "61,22" → decimal con coma
  if (/^\d+,\d{1,2}$/u.test(token)) return Number(token.replace(",", "."));
  return Number(token);
}

function collectAllowedNumbers(sources: readonly UiDataSource[], query: string): number[] {
  const values: number[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "number" && Number.isFinite(value)) {
      values.push(value, Math.abs(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      // Cuántos elementos hay (por ejemplo "3 partidos") también es un dato.
      values.push(value.length);
      return;
    }
    if (isRecord(value)) Object.values(value).forEach(visit);
  };
  sources.forEach((source) => visit(source.data));
  // Lo que escribió el usuario (por ejemplo los años que pidió) también vale.
  extractNumbers(query).forEach((number) => values.push(number.value * number.scale));
  values.push(TOTAL_ENTITIES, 100);
  return values;
}

function isSupportedNumber(number: ExtractedNumber, allowed: readonly number[]): boolean {
  const value = number.value * number.scale;
  if (number.scale === 1 && Number.isInteger(number.value) && number.value <= SMALL_COUNT_LIMIT) return true;
  return allowed.some((candidate) => {
    if (number.scale > 1) {
      // "60 millones" vale si redondea a la cifra real (tolerancia de 1 %).
      return candidate !== 0 && Math.abs(value - candidate) / Math.abs(candidate) <= 0.01;
    }
    if (value === candidate) return true;
    // Redondeos aceptables: 61.22 → 61.2 o 61.
    return [0, 1, 2].some((digits) => round(candidate, digits) === value);
  });
}

function mentionsPointsAsPercentage(answer: string, points: number): boolean {
  const magnitude = Math.abs(points);
  const pattern = /(\d+(?:[.,]\d+)?)\s*(%|por\s*ciento)/giu;
  for (const match of answer.matchAll(pattern)) {
    const value = parseSpanishNumber(match[1]!);
    const isSameMagnitude = [0, 1, 2].some((digits) => round(magnitude, digits) === value);
    if (!isSameMagnitude) continue;
    // Sólo cuenta si se habla de un cambio cerca de esa cifra.
    const start = Math.max(0, (match.index ?? 0) - 60);
    const context = answer.slice(start, (match.index ?? 0) + match[0].length);
    if (CHANGE_VERB_PATTERN.test(context)) return true;
  }
  return false;
}

function mentionsTurnoutPercentage(answer: string, sources: readonly UiDataSource[]): boolean {
  if (!/participaci[oó]n/iu.test(answer)) return false;
  const turnouts = collectFieldValues(sources, "turnoutPercentage");
  return extractNumbers(answer).some((number) => (
    number.scale === 1 && turnouts.some((turnout) => [0, 1, 2].some((digits) => round(turnout, digits) === number.value))
  ));
}

function mentionsBase(answer: string, sources: readonly UiDataSource[]): boolean {
  if (/lista nominal/iu.test(answer)) return true;
  const bases = [
    ...collectFieldValues(sources, "nominalList"),
    ...collectFieldValues(sources, "totalVotes"),
    ...collectFieldValues(sources, "voters"),
  ];
  return extractNumbers(answer).some((number) => {
    const value = number.value * number.scale;
    return bases.some((base) => base !== 0 && Math.abs(value - base) / base <= 0.01);
  });
}

function collectFieldValues(sources: readonly UiDataSource[], field: string): number[] {
  const values: number[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (isRecord(value)) {
      for (const [key, nested] of Object.entries(value)) {
        if (key === field && typeof nested === "number") values.push(nested);
        else visit(nested);
      }
    }
  };
  sources.forEach((source) => visit(source.data));
  return values;
}

// ---------- Utilidades ----------

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
