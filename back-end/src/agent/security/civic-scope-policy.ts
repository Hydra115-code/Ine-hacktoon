import { type UiDocument } from "../../ui/dsl/ui.schema.js";

export type CivicScopeBlockReason = "prompt-injection" | "out-of-scope" | "partisan" | "personal-data";

export type CivicScopeDecision =
  | { allowed: true; category: "civic" | "ui-transform" | "greeting" | "capabilities" }
  | { allowed: false; reason: CivicScopeBlockReason };

const STATES = "aguascalientes|baja\\s+california(?:\\s+sur)?|campeche|chiapas|chihuahua|ciudad\\s+de\\s+mexico|cdmx|coahuila|colima|durango|guanajuato|guerrero|hidalgo|jalisco|estado\\s+de\\s+mexico|edomex|michoacan|morelos|nayarit|nuevo\\s+leon|oaxaca|puebla|queretaro|quintana\\s+roo|san\\s+luis\\s+potosi|sinaloa|sonora|tabasco|tamaulipas|tlaxcala|veracruz|yucatan|zacatecas";
const CIVIC_INTENT = new RegExp(`\\b(?:elecci(?:on|ones)|electoral(?:es)?|vot(?:o|os|ar|aron|antes?|acion(?:es)?)|sufragio(?:s)?|casilla(?:s)?|participacion|abstencion|lista\\s+nominal|padron(?:\\s+electoral)?|ine|partido(?:s)?|candidat[a-z]*|coalici(?:on|ones)|distrito(?:s)?|seccion(?:es)?\\s+electoral(?:es)?|municipio(?:s)?|entidad(?:es)?|estado(?:s)?|estatal(?:es)?|nacional|presiden(?:cia|te|ta)|diputad[a-z]*|senad[a-z]*|gubernatura(?:s)?|goberna(?:dor|dora)|alcald[a-z]*|ayuntamiento(?:s)?|proceso(?:s)?\\s+electoral(?:es)?|computo(?:s)?|prep|conteo\\s+rapido|resultado(?:s)?|ciudadan[a-z]*|democracia|cargo(?:s)?\\s+de\\s+eleccion|${STATES})\\b`, "u");
const DEMOGRAPHIC_COMPARISON = /(?=.*\b(?:(?:19|20)\d{2}|matriz)\b)(?:\b(?:compar\w*|brecha|diferencia|matriz|desglose)\b.{0,80}\b(?:mujeres?|hombres?|sexo|genero|edad(?:es)?)\b|\b(?:mujeres?|hombres?|sexo|genero|edad(?:es)?)\b.{0,80}\b(?:compar\w*|brecha|diferencia|matriz|desglose)\b)/u;
const PARTISAN_REQUEST = [
  /\b(?:por|a)\s+quien\s+(?:le\s+)?(?:debo|deberia|tengo\s+que|me\s+conviene|recomiendas)\s+votar\b/u,
  /\b(?:recomiend(?:a|as|ame)|sugier(?:e|es|eme)|aconsej(?:a|ame))\b.{0,60}\b(?:partido|candidat[a-z]*|votar|voto)\b/u,
  /\b(?:cual|que)\s+(?:partido|candidat[a-z]*)\s+(?:es|fue|seria)\s+(?:el\s+|la\s+)?(?:mejor|peor|mas\s+corrupt[a-z]*)\b/u,
  /\b(?:haz|hazme|escribe|crea|redacta)\b.{0,40}\b(?:propaganda|campana\s+(?:a\s+favor|en\s+contra)|discurso\s+de\s+campana)\b/u,
  /\b(?:quien|que\s+partido|que\s+candidat[a-z]*)\s+(?:va\s+a\s+ganar|ganara|ganaria)\b|\b(?:predic\w*|pronostic\w*)\b.{0,40}\b(?:ganador\w*|eleccion\w*|resultado\w*)\b/u,
];
const PERSONAL_DATA_REQUEST = /\b(?:curp|clave\s+de\s+elector|numero\s+de\s+credencial|domicilio\s+de|direccion\s+de|datos\s+personales\s+de|telefono\s+de|donde\s+vive)\b/u;
const UI_TRANSFORM_ACTION = /\b(?:quit(?:a|ar)|elimin(?:a|ar)|ocult(?:a|ar)|suprim(?:e|ir)|retir(?:a|ar)|dej(?:a|ar|ame)|conserv(?:a|ar)|convert(?:ir|irlo|irla|irlos|irlas)|conviert(?:e|elo|ela|elos|elas)|transform(?:a|ar)|reorganiz(?:a|ar)|orden[a-z]*|agrup(?:a|ar)|regres(?:a|ar)|vuelve|volver|deshaz|deshacer|recuper(?:a|ar)|restaur(?:a|ar)|d(?:a|ame|amelo|amela|amelos|amelas)|presenta[a-z]*|quiero|ver(?:lo|la|los|las)?|muev(?:e|elo|ela)|mov(?:er|erlo|erla)|pon|ponlo|ponla|coloc(?:a|ar)|sub(?:e|ir)|prioriz(?:a|ar)|cambi(?:a|ar)|ajust(?:a|ar)|actualiz(?:a|ar)|edit(?:a|ar)|filtr(?:a|ar)|muestr[a-z]*|ensen[a-z]*|ampli(?:a|ar)|reduc(?:e|ir)|simplific(?:a|ar))\b/u;
const UI_PRESENTATION_REFERENCE = /\b(?:grafic[a-z]*|tabl[a-z]*|tabal[a-z]*|vist[a-z]*|visualiz[a-z]*|mapa(?:s)?|timeline|linea\s+temporal|tarjet[a-z]*|indicador(?:es)?|metric[a-z]*|filtro(?:s)?|control(?:es)?|bloque(?:s)?|seccion(?:es)?|interfaz|ui|evidencia|resultado|comparacion(?:es)?|cambio(?:s)?|variacion(?:es)?|estos?\s+datos|lo\s+mismo|lo\s+anterior|fuente(?:s)?|origen|de\s+menor\s+a\s+mayor|de\s+mayor\s+a\s+menor|ascendente|descendente)\b/u;
const UI_REPLAY_FOLLOW_UP = /\b(?:muestr(?:a|ame)|ensen(?:a|ame))\b.{0,45}\b(?:lo\s+mismo|lo\s+anterior|estos?\s+datos|de\s+nuevo|otra\s+vez)\b|\b(?:de\s+nuevo|otra\s+vez)\b.{0,45}\b(?:muestr(?:a|ame)|ensen(?:a|ame))\b/u;
const CIVIC_FOLLOW_UP = /\b(?:mujer(?:es)?|hombre(?:s)?|sexo|genero|edad(?:es)?|joven(?:es)?|adult[oa]s\s+mayores|urban[ao]s?|rural(?:es)?|mixt[ao]s?|(?:19|20)\d{2}|compar[a-z]*|desglos[a-z]*|tendencia|evolucion|abstencion)\b/u;
const GREETING = /^(?:hola|buen(?:os|as)?\s+(?:dias|tardes|noches)|hey|hello|hi|gracias|muchas\s+gracias|adios|hasta\s+luego)[!,.?\s]*$/u;
const CAPABILITIES = /\b(?:que\s+(?:puedes|sabes)\s+hacer|como\s+(?:puedes\s+)?ayudarme|en\s+que\s+(?:puedes\s+)?ayudarme|tus\s+capacidades|quien\s+eres|what\s+can\s+you\s+do|how\s+can\s+you\s+help)\b/u;
const SAFE_CONVERSATION = /\b(?:hola|gracias|con\s+gusto|puedo\s+ayudarte|como\s+puedo\s+ayudarte|hasta\s+luego|cruza\s+varios\s+anos|elige\s+un\s+ano|nivel\s+estatal\s+o\s+nacional|no\s+debo\s+mezclar)\b/u;
const CIVIC_VALUE = /\b\d[\d,.]*\s*(?:%|por\s+ciento|votos?|casillas?|electores?|ciudadan[a-z]*)\b/u;
const PROMPT_INJECTION = [
  /\b(?:ignora|omite|olvida|desobedece|anula)\b.{0,80}\b(?:instrucciones|reglas|prompt|mensaje\s+de\s+sistema|politicas)\b/u,
  /\b(?:ignore|forget|override|disregard)\b.{0,80}\b(?:instructions|rules|prompt|system\s+message|policies)\b/u,
  /\b(?:muestra|revela|imprime|expone|dime)\b.{0,80}\b(?:prompt|instrucciones\s+internas|mensaje\s+de\s+sistema|secreto(?:s)?)\b/u,
  /\b(?:show|reveal|print|expose)\b.{0,80}\b(?:system\s+prompt|internal\s+instructions|secret(?:s)?)\b/u,
  /\b(?:jailbreak|modo\s+dan|developer\s+mode|system\s+override)\b/u,
  /\b(?:usa|usar|cambia|cambiar|sustituye|suplanta)\b.{0,50}\buser[\s_-]*id\b/u,
  /\b(?:elude|evita|salta|desactiva|bypass)\b.{0,60}\b(?:seguridad|autorizacion|politica|policy)\b/u,
];
const PROMPT_DISCLOSURE = /\b(?:system\s+prompt|developer\s+message|mensaje\s+de\s+sistema|instrucciones\s+internas)\b/u;
const OUT_OF_SCOPE_CONTENT = /\b(?:capital\s+de\s+[a-z]+|receta(?:s)?|clima|pronostico\s+del\s+tiempo|futbol|partido\s+deportivo|javascript|python|programacion|pelicula(?:s)?|serie(?:s)?\s+de\s+television)\b/u;

export function classifyCivicQuery(query: string): CivicScopeDecision {
  const normalized = normalize(query);
  const request = latestUserRequest(normalized);
  if (PROMPT_INJECTION.some((pattern) => pattern.test(request))) {
    return { allowed: false, reason: "prompt-injection" };
  }
  if (PERSONAL_DATA_REQUEST.test(request)) return { allowed: false, reason: "personal-data" };
  if (PARTISAN_REQUEST.some((pattern) => pattern.test(request))) return { allowed: false, reason: "partisan" };
  if (OUT_OF_SCOPE_CONTENT.test(request) && !CIVIC_INTENT.test(request)) {
    return { allowed: false, reason: "out-of-scope" };
  }
  if (CIVIC_INTENT.test(request) || DEMOGRAPHIC_COMPARISON.test(request)) return { allowed: true, category: "civic" };
  if (hasPriorCivicSessionContext(normalized) && isUiTransformRequest(request)) {
    return { allowed: true, category: "ui-transform" };
  }
  if (hasPriorCivicSessionContext(normalized) && CIVIC_FOLLOW_UP.test(request)) return { allowed: true, category: "civic" };
  if (GREETING.test(request)) return { allowed: true, category: "greeting" };
  if (CAPABILITIES.test(request)) return { allowed: true, category: "capabilities" };
  return { allowed: false, reason: "out-of-scope" };
}

export function isCivicResponseSafe(answer: string): boolean {
  const normalized = normalize(answer);
  if (PROMPT_DISCLOSURE.test(normalized)) return false;
  if (PROMPT_INJECTION.some((pattern) => pattern.test(normalized))) return false;
  if (OUT_OF_SCOPE_CONTENT.test(normalized) && !CIVIC_INTENT.test(normalized)) return false;
  return CIVIC_INTENT.test(normalized)
    || CIVIC_VALUE.test(normalized)
    || GREETING.test(normalized)
    || CAPABILITIES.test(normalized)
    || SAFE_CONVERSATION.test(normalized);
}

export function createCivicScopeResponse(
  reason: CivicScopeBlockReason | "unsafe-response",
): { answer: string; ui: UiDocument } {
  const answer = reason === "prompt-injection"
    ? "No puedo seguir instrucciones que intenten cambiar mis reglas o controles de seguridad. Puedo ayudarte con una consulta sobre datos electorales públicos."
    : reason === "partisan"
    ? "No puedo recomendar por quién votar, predecir resultados ni calificar partidos o candidaturas. Sí puedo mostrarte datos oficiales, por ejemplo: «¿Cuál fue la participación por estado en 2024?»."
    : reason === "personal-data"
    ? "Sólo trabajo con datos públicos agregados; no consulto datos personales como CURP, clave de elector o domicilio. Puedo mostrarte resultados o participación por estado."
    : reason === "unsafe-response"
    ? "No fue posible producir una respuesta segura con datos electorales. Reformula tu consulta sobre resultados, participación o comparaciones entre entidades."
    : "Sólo puedo ayudarte con datos electorales públicos del INE, como resultados por partido, participación, abstención y comparaciones entre estados. Prueba con: «Compara la participación de Jalisco y Nuevo León en 2024».";
  return {
    answer,
    ui: {
      version: "1.0",
      root: {
        id: "civic-scope-notice",
        type: "alert",
        severity: reason === "prompt-injection" || reason === "unsafe-response" ? "warning" : "info",
        text: answer,
      },
    },
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-MX")
    .trim();
}

function latestUserRequest(normalizedQuery: string): string {
  return normalizedQuery.split("nueva solicitud del usuario:").at(-1)?.trim() || normalizedQuery;
}

function hasPriorCivicSessionContext(normalizedQuery: string): boolean {
  const marker = "nueva solicitud del usuario:";
  const markerIndex = normalizedQuery.lastIndexOf(marker);
  if (markerIndex < 0) return false;
  return CIVIC_INTENT.test(normalizedQuery.slice(0, markerIndex));
}

function isUiTransformRequest(request: string): boolean {
  return UI_REPLAY_FOLLOW_UP.test(request)
    || (UI_TRANSFORM_ACTION.test(request) && UI_PRESENTATION_REFERENCE.test(request));
}
