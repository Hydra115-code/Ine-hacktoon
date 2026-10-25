const replacements: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bMCP\b/giu, "fuentes oficiales"],
  [/\bGemini\b/giu, "Paper"],
  [/\bJSON\b/giu, "información"],
  [/\bZod\b/giu, "revisión"],
  [/\bschemas?\b/giu, "estructura"],
  [/\bbindings?\b/giu, "datos relacionados"],
  [/\bpayloads?\b/giu, "solicitud"],
  [/\bruntimes?\b/giu, "aplicación"],
  [/\b(?:UI|interfaces?)\b/giu, "vista"],
  [/\b(?:planner|planificador|provider|proveedor)\b/giu, "Paper"],
  [/\bpatch(?:es)?\b/giu, "cambio"],
  [/\brevisi[oó]n(?:es)?\b/giu, "versión"],
  [/\bbackend\b/giu, "servicio"],
  [/\bfrontend\b/giu, "aplicación"],
  [/\bcorrelation(?:Id)?\b/giu, "referencia"],
  [/\bsnapshots?\b/giu, "vista guardada"],
];

export const forbiddenCitizenTerms = [
  "MCP", "Gemini", "JSON", "Zod", "schema", "binding", "payload", "runtime",
  "UI", "planner", "provider", "patch", "revision", "backend", "frontend", "correlationId",
] as const;

export function toCitizenLanguage(value: string): string {
  return replacements
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\s{2,}/gu, " ")
    .trim();
}

export function citizenProgressMessage(value: string): string {
  if (/\b(?:MCP|herramienta|fuente)\b/iu.test(value)) return "Estoy consultando las fuentes oficiales";
  if (/\b(?:interfaz|UI|componente|render)\b/iu.test(value)) return "Estoy organizando la información";
  if (/\b(?:planner|planificador|provider|proveedor|modelo)\b/iu.test(value)) return "Estoy entendiendo tu pregunta";
  if (/\b(?:valid|evidencia|cifra|seguridad)\b/iu.test(value)) return "Estoy comprobando la información";
  return toCitizenLanguage(value);
}
