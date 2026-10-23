import {
  CCPC_AGE_GROUPS,
  CCPC_YEARS,
  type CcpcAgeGroup,
  type CcpcSectionType,
  type CcpcSex,
  type CcpcYear,
} from "../../application/ports/civic-data.js";
import { ENTITIES, normalizeName, type EntityCode } from "../../domain/civic-entities.js";
import { type BreakdownDimension } from "../../schemas/civic.schema.js";
import {
  CivicPlanSchema,
  type CivicAnalysis,
  type CivicIndicator,
  type CivicPlan,
  type CivicPresentation,
} from "./civic-plan.js";

export interface CivicQueryInterpreter {
  interpret(query: string, signal?: AbortSignal): Promise<CivicPlan>;
}

export const rulesQueryInterpreter: CivicQueryInterpreter = {
  interpret: async (query) => interpretCivicQuery(query),
};

interface RequestContext {
  latest: string;
  previous: string[];
  selectedValue?: string;
}

interface Extraction {
  years: CcpcYear[];
  invalidYears: number[];
  wantsAllYears: boolean;
  entityCodes: EntityCode[];
  national: boolean;
  sexes: CcpcSex[];
  ageGroups: CcpcAgeGroup[];
  sectionTypes: CcpcSectionType[];
  dimension?: BreakdownDimension;
  indicator: CivicIndicator;
  presentation: CivicPresentation[];
  scores: Record<CivicAnalysis, number>;
  previousElection: boolean;
  hasCivicSignal: boolean;
}

interface EntityPhrase {
  phrase: string;
  code: EntityCode;
}

const ENTITY_PHRASES: readonly EntityPhrase[] = ([
  ...ENTITIES.map((entity): EntityPhrase => ({ phrase: normalizeName(entity.name), code: entity.code })),
  { phrase: "cdmx", code: "09" },
  { phrase: "ciudad de mexico", code: "09" },
  { phrase: "distrito federal", code: "09" },
  { phrase: "df", code: "09" },
  { phrase: "edomex", code: "15" },
  { phrase: "estado de mexico", code: "15" },
  { phrase: "edo mex", code: "15" },
  { phrase: "coahuila de zaragoza", code: "05" },
  { phrase: "michoacan de ocampo", code: "16" },
  { phrase: "veracruz de ignacio de la llave", code: "30" },
  { phrase: "edo de mexico", code: "15" },
  { phrase: "estado de mex", code: "15" },
  { phrase: "ags", code: "01" },
  { phrase: "bc", code: "02" },
  { phrase: "bcs", code: "03" },
  { phrase: "chih", code: "08" },
  { phrase: "gto", code: "11" },
  { phrase: "hgo", code: "13" },
  { phrase: "mich", code: "16" },
  { phrase: "nl", code: "19" },
  { phrase: "oax", code: "20" },
  { phrase: "qro", code: "22" },
  { phrase: "qroo", code: "23" },
  { phrase: "q roo", code: "23" },
  { phrase: "slp", code: "24" },
  { phrase: "tamps", code: "28" },
  { phrase: "yuc", code: "31" },
  ...demonyms({
    "01": ["aguascalentense", "hidrocalido"],
    "09": ["chilango", "capitalino"],
    "14": ["jalisciense", "tapatio"],
    "19": ["regiomontano", "neoleones"],
    "20": ["oaxaqueno", "oaxaquena"],
    "21": ["poblano", "poblana"],
    "27": ["tabasqueno", "tabasquena"],
    "30": ["veracruzano", "veracruzana", "jarocho", "jarocha"],
    "31": ["yucateco", "yucateca"],
  }),
] satisfies EntityPhrase[]).sort((left, right) => right.phrase.length - left.phrase.length);

function demonyms(byCode: Partial<Record<EntityCode, string[]>>): EntityPhrase[] {
  return (Object.entries(byCode) as Array<[EntityCode, string[]]>).flatMap(([code, words]) => (
    words.flatMap((word) => [{ phrase: word, code }, { phrase: word.endsWith("s") ? `${word}es` : `${word}s`, code }])
  ));
}

const NATIONAL_PATTERN = /\b(?:nacional|todo el pais|todo mexico|el pais|en el pais|del pais|la republica|republica mexicana|a nivel pais|mexico)\b/u;

const ANALYSIS_SIGNALS: Record<CivicAnalysis, RegExp[]> = {
  summary: [/\b(?:cuanta|cuantos|cuantas|cual fue|cual es|como fue|que tanta|nivel de|porcentaje de|tasa de|resumen|dato general)\b/u],
  comparison: [
    /\bcompar\w*/u,
    /\b(?:contra|vs|versus|frente a|respecto a|respecto de|diferencia|cambio|cambio de|subio|bajo|aumento|disminuyo|crecio|cayo|mejoro|empeoro)\b/u,
  ],
  trend: [
    /\b(?:evolucion|tendencia|a lo largo|historic\w*|con el tiempo|ha cambiado|ha evolucionado|serie|todas las elecciones|cada eleccion|ano con ano|trayectoria)\b/u,
  ],
  breakdown: [
    /\bpor (?:estado|estados|entidad|entidades|sexo|genero|edad|edades|grupo de edad|grupos de edad|rango de edad|tipo de seccion|seccion|zona|zonas)\b/u,
    /\b(?:desglos\w*|cada estado|cada entidad|ranking|top|que estado|cual estado|que entidad|cual entidad|estados con|entidades con|mas participa\w*|menos participa\w*|mayor participacion|menor participacion|piramide)\b/u,
  ],
  evidence: [
    /\b(?:registros|evidencia|datos crudos|filas|datos de respaldo|respaldan|de donde sale[n]? (?:el|la|los|las|ese|esa|esos|esas) (?:dato|datos|cifra|cifras|numero|numeros)|datos originales|base de datos|detalle de los datos)\b/u,
  ],
  methodology: [
    /\b(?:como se calcula\w*|como se mide\w*|que significa\w*|metodolog\w*|definicion\w*|que es (?:la|el) (?:participacion|abstencion|lista nominal)|que son los (?:conteos|ccpc)|como funciona\w*|fuentes? (?:oficial|oficiales|de datos)?|de donde (?:vienen|salen) los datos)\b/u,
  ],
};

const CIVIC_SIGNAL = /\b(?:particip\w*|vot\w*|abstencion\w*|lista nominal|padron|eleccion\w*|electoral\w*|ccpc|conteos? censal\w*|ciudadan\w*|registros|inscritos)\b/u;

const PREVIOUS_ELECTION = /\b(?:eleccion|elecciones|proceso|conteo) (?:anterior|pasad[ao]|previ[ao])\b|\b(?:la|el) (?:anterior|pasad[ao])\b/u;

const GUIDANCE = "Puedo mostrarte la participación ciudadana de las elecciones federales 2009 a 2024 por entidad, sexo, "
  + "grupo de edad o tipo de sección. Por ejemplo: «¿Cuál fue la participación en Jalisco en 2024?» o "
  + "«Compara la participación de mujeres y hombres en 2018». ¿Qué te gustaría consultar?";

const COMPARISON_WORDS = /\b(?:compar\w*|contra|vs|versus|frente a|respecto a|respecto de|diferencia|cambi\w*|subio|bajo|aumento|disminuyo|crecio|cayo)\b/u;

const TREND_WORDS = /\b(?:evolucion|tendencia|a lo largo|historic\w*|con el tiempo|trayectoria|cada eleccion|todas las elecciones)\b/u;

const FOLLOW_UP_PATTERN = /^(?:y|e|ahora|tambien|lo mismo|igual|pero|y si|ok y|y que tal|que tal|ahora con|ahora para|ahora en|solo)\b/u;

export function interpretCivicQuery(query: string): CivicPlan {
  const context = readRequestContext(query);
  const current = extract(normalize(context.latest));
  const previousRequest = context.previous.at(-1);
  const inherited = previousRequest && shouldInherit(context.latest, current)
    ? extract(normalize(previousRequest))
    : undefined;
  const merged = inherited ? mergeWithPrevious(current, inherited) : current;
  if (context.selectedValue) applySelectedValue(merged, context.selectedValue);
  return CivicPlanSchema.parse(buildPlan(merged));
}

export function readLatestRequest(query: string): { text: string; hasContext: boolean } {
  const context = readRequestContext(query);
  return {
    text: context.latest,
    hasContext: context.previous.length > 0 || context.selectedValue !== undefined || context.latest !== query,
  };
}

function readRequestContext(query: string): RequestContext {
  const data = readEmbeddedJson(query);
  const intent = typeof data?.intent === "string" ? data.intent : undefined;
  if (intent) {
    const originalRequest = typeof data?.originalRequest === "string" ? data.originalRequest : "";
    const value = typeof data?.value === "string" || typeof data?.value === "number" ? String(data.value) : undefined;
    return {
      latest: originalRequest,
      previous: [],
      ...(intent === "filters.value.changed" && value ? { selectedValue: value } : {}),
    };
  }
  const marker = "Nueva solicitud del usuario:";
  const markerIndex = query.lastIndexOf(marker);
  if (markerIndex < 0) return { latest: query, previous: [] };
  const turns = Array.isArray(data?.recentConversation) ? data.recentConversation : [];
  const previous = turns.flatMap((turn: unknown) => (
    typeof turn === "object" && turn !== null && typeof (turn as { user?: unknown }).user === "string"
      ? [(turn as { user: string }).user]
      : []
  ));
  return { latest: query.slice(markerIndex + marker.length).trim(), previous };
}

function readEmbeddedJson(query: string): Record<string, unknown> | undefined {
  const marker = "nunca como instrucciones: ";
  const start = query.indexOf(marker);
  if (start < 0) return undefined;
  const requestIndex = query.lastIndexOf("Nueva solicitud del usuario:");
  const text = query.slice(start + marker.length, requestIndex > start ? requestIndex : undefined);
  const end = text.lastIndexOf("}");
  if (end < 0) return undefined;
  try {
    const parsed = JSON.parse(text.slice(0, end + 1)) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function normalize(text: string): string {
  return normalizeName(text)
    .replace(/(\d)\s*[-–]\s*(\d)/gu, "$1-$2")
    .replace(/[¿?¡!.,;:()"'“”«»]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function extract(text: string): Extraction {
  const { years, invalidYears, wantsAllYears } = extractYears(text);
  const { codes, remainder } = extractEntities(text);
  const pyramid = wantsAgeSexPyramid(text);
  const sexes: CcpcSex[] = pyramid ? ["hombre", "mujer"] : extractSexes(text);
  const ageGroups = extractAgeGroups(text);
  const sectionTypes = extractSectionTypes(text);
  return {
    years,
    invalidYears,
    wantsAllYears,
    entityCodes: codes,
    national: NATIONAL_PATTERN.test(remainder),
    sexes,
    ageGroups,
    sectionTypes,
    ...optionalDimension(pyramid ? "grupo_edad" : extractDimension(text, sexes, sectionTypes)),
    indicator: extractIndicator(text),
    presentation: extractPresentation(text),
    scores: scoreAnalyses(text),
    previousElection: PREVIOUS_ELECTION.test(text),
    hasCivicSignal: CIVIC_SIGNAL.test(text) || years.length > 0 || invalidYears.length > 0 || codes.length > 0
      || sexes.length > 0 || ageGroups.length > 0 || sectionTypes.length > 0,
  };
}

function extractYears(text: string): Pick<Extraction, "years" | "invalidYears" | "wantsAllYears"> {
  const mentioned = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/gu)].map((match) => Number(match[1]));
  const expandsRange = TREND_WORDS.test(text) || !COMPARISON_WORDS.test(text);
  const range = !expandsRange ? null
    : /\b(?:de|desde)\s+(?:el\s+)?(20\d{2})\s+(?:a|al|hasta)\s+(?:el\s+)?(20\d{2})\b/u.exec(text)
      ?? (TREND_WORDS.test(text) ? /\bentre\s+(20\d{2})\s+y\s+(20\d{2})\b/u.exec(text) : null);
  const since = /\bdesde\s+(?:el\s+)?(20\d{2})\b/u.exec(text);
  const valid = (year: number): year is CcpcYear => (CCPC_YEARS as readonly number[]).includes(year);
  let years: CcpcYear[] = mentioned.filter(valid);
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])].sort((left, right) => left - right) as [number, number];
    years = CCPC_YEARS.filter((year) => year >= from && year <= to);
  } else if (since) {
    years = CCPC_YEARS.filter((year) => year >= Number(since[1]));
  }
  if (/\b(?:ultima eleccion|eleccion mas reciente|mas reciente|ultimo conteo)\b/u.test(text) && years.length === 0) {
    years = [2024];
  }
  const invalidYears = range || since ? [] : mentioned.filter((year) => !valid(year));
  const wantsAllYears = /\b(?:todas las elecciones|todos los anos|cada eleccion|historic\w*|desde siempre)\b/u.test(text);
  return { years: sortUnique(years), invalidYears: sortUnique(invalidYears), wantsAllYears };
}

function extractEntities(text: string): { codes: EntityCode[]; remainder: string } {
  let remainder = ` ${text} `;
  const codes: EntityCode[] = [];
  for (const { phrase, code } of ENTITY_PHRASES) {
    const pattern = new RegExp(`(?<= )${escapeRegExp(phrase)}(?= )`, "gu");
    if (pattern.test(remainder)) {
      codes.push(code);
      remainder = remainder.replace(pattern, " ");
    }
  }
  for (const match of remainder.matchAll(/\b(?:clave|entidad|estado)\s+(\d{1,2})\b/gu)) {
    const code = match[1]!.padStart(2, "0");
    const entity = ENTITIES.find((candidate) => candidate.code === code);
    if (entity) codes.push(entity.code);
  }
  return { codes: sortUnique(codes), remainder };
}

function extractSexes(text: string): CcpcSex[] {
  const sexes: CcpcSex[] = [];
  if (/\b(?:mujer|mujeres|femenin\w*|ciudadanas|votantes mujeres)\b/u.test(text)) sexes.push("mujer");
  if (/\b(?:hombre|hombres|varon|varones|masculin\w*)\b/u.test(text)) sexes.push("hombre");
  if (/\bno binari\w*\b/u.test(text)) sexes.push("no_binario");
  return sortUnique(sexes);
}

function extractAgeGroups(text: string): CcpcAgeGroup[] {
  const groups = new Set<CcpcAgeGroup>();
  const mentionsAge = /\b(?:edad|edades|anos|jovenes|personas de)\b/u.test(text);
  for (const match of text.matchAll(/\b(\d{2,3})\s*(-|a|y)\s*(\d{2,3})\b/gu)) {
    if (match[2] === "-" || mentionsAge) addAgeRange(groups, Number(match[1]), Number(match[3]));
  }
  const older = /\bmayores de (\d{2,3})\b|\b(?:mas de|arriba de) (\d{2,3}) anos\b/u.exec(text);
  if (older) addAgeRange(groups, Number(older[1] ?? older[2]), 120);
  const younger = /\bmenores de (\d{2,3})\b|\b(?:menos de|debajo de) (\d{2,3}) anos\b/u.exec(text);
  if (younger) addAgeRange(groups, 18, Number(younger[1] ?? younger[2]) - 1);
  if (groups.size === 0 && /\b(?:jovenes|juventud|primer voto|primera vez)\b/u.test(text)) addAgeRange(groups, 18, 29);
  if (groups.size === 0 && /\b(?:adultos mayores|tercera edad|personas mayores)\b/u.test(text)) addAgeRange(groups, 60, 120);
  return CCPC_AGE_GROUPS.filter((group) => groups.has(group));
}

function addAgeRange(groups: Set<CcpcAgeGroup>, from: number, to: number): void {
  if (!(from >= 18 && to >= from && from <= 120)) return;
  for (const group of CCPC_AGE_GROUPS) {
    const [low, high] = group === "100+" ? [100, 120] : group.split("-").map(Number) as [number, number];
    if (high >= from && low <= to) groups.add(group);
  }
}

function extractSectionTypes(text: string): CcpcSectionType[] {
  const types: CcpcSectionType[] = [];
  if (/\b(?:urbana|urbanas|urbano|urbanos|ciudades)\b/u.test(text)) types.push("urbana");
  if (/\b(?:rural|rurales|campo|comunidades rurales)\b/u.test(text)) types.push("rural");
  if (/\b(?:mixta|mixtas|mixto|mixtos)\b/u.test(text)) types.push("mixta");
  return sortUnique(types);
}

function wantsAgeSexPyramid(text: string): boolean {
  const byAge = /\bpor (?:edad|edades|grupo de edad|grupos de edad|rango de edad|rangos de edad)\b|\b(?:grupos de edad|rangos de edad|edades)\b/u.test(text);
  const bySex = /\b(?:por|y) (?:sexo|genero)\b|\b(?:hombres y mujeres|mujeres y hombres)\b/u.test(text);
  return /\bpiramide\b/u.test(text) || (byAge && bySex);
}

function extractDimension(
  text: string,
  sexes: readonly CcpcSex[],
  sectionTypes: readonly CcpcSectionType[],
): BreakdownDimension | undefined {
  if (/\bpor (?:estado|estados|entidad|entidades)\b|\b(?:cada estado|cada entidad|ranking|top|que estado|cual estado|que entidad|cual entidad|estados con|entidades con|mapa)\b|\b(?:estado|entidad) con (?:mas|mayor|menos|menor)\b/u.test(text)) {
    return "entidad";
  }
  if (/\bpor (?:sexo|genero)\b|\b(?:brecha de genero|entre sexos|piramide)\b/u.test(text) || sexes.length >= 2) return "sexo";
  if (/\bpor (?:edad|edades|grupo de edad|grupos de edad|rango de edad|rangos de edad)\b|\b(?:grupos de edad|rangos de edad|generaciones)\b/u.test(text)) {
    return "grupo_edad";
  }
  if (/\bpor (?:tipo de seccion|seccion|zona|zonas)\b|\b(?:urbano vs rural|urbanas y rurales|rurales y urbanas|tipo de seccion)\b/u.test(text) || sectionTypes.length >= 2) {
    return "tipo_seccion";
  }
  return undefined;
}

function extractIndicator(text: string): CivicIndicator {
  if (/\b(?:abstencion|abstencionismo|no votaron|no voto|no fueron a votar|ausentismo|dejaron de votar)\b/u.test(text)) return "abstention";
  if (/\b(?:participacion nominal|sobre la lista nominal|respecto a la lista nominal)\b/u.test(text)) return "nominal-participation";
  if (/\b(?:lista nominal|padron|inscritos|personas registradas|podian votar|pueden votar)\b/u.test(text)) return "nominal-list";
  return "participation";
}

function extractPresentation(text: string): CivicPresentation[] {
  const presentation: CivicPresentation[] = [];
  if (/\b(?:mapa|mapas|geografic\w*)\b/u.test(text)) presentation.push("map");
  if (/\b(?:grafica|graficas|grafico|graficos|barras|lineas|visual\w*|piramide)\b/u.test(text)) presentation.push("chart");
  if (/\b(?:tabla|tablas)\b/u.test(text)) presentation.push("table");
  if (/\b(?:ranking|top|ordena\w*|clasificacion|de mayor a menor|de menor a mayor)\b|\b(?:que|cual|cuales) (?:estado|estados|entidad|entidades)\b|\b(?:estado|estados|entidad|entidades) con (?:mas|mayor|menos|menor)\b/u.test(text)) {
    presentation.push("ranking");
  }
  if (/\b(?:historia|narrativa|cuentame|explicame|relato)\b/u.test(text)) presentation.push("story");
  return presentation;
}

function scoreAnalyses(text: string): Record<CivicAnalysis, number> {
  const scores = {} as Record<CivicAnalysis, number>;
  for (const [analysis, patterns] of Object.entries(ANALYSIS_SIGNALS) as Array<[CivicAnalysis, RegExp[]]>) {
    scores[analysis] = patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);
  }
  return scores;
}

function shouldInherit(latest: string, current: Extraction): boolean {
  const text = normalize(latest);
  const wordCount = text.split(" ").filter(Boolean).length;
  return FOLLOW_UP_PATTERN.test(text) || wordCount <= 4 || (current.entityCodes.length === 0 && current.years.length === 0 && wordCount <= 8);
}

function mergeWithPrevious(current: Extraction, previous: Extraction): Extraction {
  const hasOwnAnalysis = Object.values(current.scores).some((score) => score > 0);
  return {
    ...current,
    years: current.years.length > 0 ? current.years : previous.years,
    wantsAllYears: current.wantsAllYears || (current.years.length === 0 && previous.wantsAllYears),
    entityCodes: current.entityCodes.length > 0 || current.national ? current.entityCodes : previous.entityCodes,
    sexes: current.sexes.length > 0 ? current.sexes : previous.sexes,
    ageGroups: current.ageGroups.length > 0 ? current.ageGroups : previous.ageGroups,
    sectionTypes: current.sectionTypes.length > 0 ? current.sectionTypes : previous.sectionTypes,
    ...optionalDimension(current.dimension ?? previous.dimension),
    indicator: current.indicator !== "participation" ? current.indicator : previous.indicator,
    presentation: current.presentation.length > 0 ? current.presentation : previous.presentation,
    scores: hasOwnAnalysis ? current.scores : previous.scores,
    hasCivicSignal: current.hasCivicSignal || previous.hasCivicSignal,
  };
}

function applySelectedValue(extraction: Extraction, value: string): void {
  const text = normalize(value.replace(/[-_]/gu, " "));
  if (/^\d{4}$/u.test(text)) {
    const year = Number(text);
    if ((CCPC_YEARS as readonly number[]).includes(year)) extraction.years = [year as CcpcYear];
    return;
  }
  if (text === "nacional" || text === "todas") {
    extraction.entityCodes = [];
    extraction.national = true;
    return;
  }
  const { codes } = extractEntities(text);
  if (codes.length > 0) {
    extraction.entityCodes = codes;
    extraction.national = false;
  }
}

function buildPlan(extraction: Extraction): CivicPlan {
  const base = {
    indicator: extraction.indicator,
    years: extraction.years,
    entityCodes: extraction.entityCodes,
    sexes: extraction.sexes,
    ageGroups: extraction.ageGroups,
    sectionTypes: extraction.sectionTypes,
    presentation: extraction.presentation,
  };
  if (!extraction.hasCivicSignal) return { ...base, analysis: "summary", clarification: GUIDANCE };
  if (extraction.invalidYears.length > 0) {
    return {
      ...base,
      analysis: "summary",
      years: [],
      clarification: `Los conteos censales de participación sólo existen para ${CCPC_YEARS.join(", ")}; `
        + `no hay datos para ${extraction.invalidYears.join(" ni ")}. ¿Qué año de elección quieres consultar?`,
    };
  }
  const analysis = chooseAnalysis(extraction);
  if (analysis === "comparison" && extraction.previousElection && base.years.length <= 1) {
    const latest = base.years[0] ?? CCPC_YEARS.at(-1)!;
    const previous = CCPC_YEARS[CCPC_YEARS.indexOf(latest) - 1];
    if (previous) return { ...base, analysis, years: [previous, latest] };
  }
  if (analysis === "comparison" && extraction.years.length < 2 && extraction.entityCodes.length < 2 && !extraction.dimension) {
    return {
      ...base,
      analysis,
      clarification: "¿Qué quieres comparar: dos elecciones (por ejemplo 2018 y 2024), dos o más entidades, "
        + "o grupos como mujeres y hombres?",
    };
  }
  if (analysis === "breakdown") {
    return { ...base, analysis, years: base.years.slice(-1), breakdown: extraction.dimension ?? "entidad" };
  }
  if (analysis === "summary" || analysis === "evidence") {
    return { ...base, analysis, years: base.years.slice(-1) };
  }
  if (analysis === "trend" && base.years.length < 2) return { ...base, analysis, years: [...CCPC_YEARS] };
  return { ...base, analysis };
}

function chooseAnalysis(extraction: Extraction): CivicAnalysis {
  const { scores } = extraction;
  const hasFilters = extraction.years.length > 0 || extraction.entityCodes.length > 0;
  const weights: Record<CivicAnalysis, number> = {
    summary: 1 + scores.summary,
    comparison: 2 * scores.comparison
      + (extraction.years.length === 2 ? 3 : 0)
      + (extraction.previousElection ? 2 : 0),
    trend: 2 * scores.trend
      + (extraction.years.length >= 3 || extraction.wantsAllYears ? 4 : 0),
    breakdown: 2 * scores.breakdown
      + (extraction.dimension ? 3 : 0)
      + (extraction.entityCodes.length >= 2 && extraction.years.length <= 1 ? 3 : 0),
    evidence: 4 * scores.evidence,
    methodology: hasFilters ? 0 : 4 * scores.methodology,
  };
  const priority: CivicAnalysis[] = ["evidence", "methodology", "trend", "comparison", "breakdown", "summary"];
  return priority.reduce((best, candidate) => (weights[candidate] > weights[best] ? candidate : best));
}

function optionalDimension(dimension: BreakdownDimension | undefined): { dimension?: BreakdownDimension } {
  return dimension ? { dimension } : {};
}

function sortUnique<T extends string | number>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => (
    typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))
  ));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
