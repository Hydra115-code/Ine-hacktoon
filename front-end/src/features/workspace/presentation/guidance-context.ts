export type ContextField = "territory" | "age" | "sex" | "year";

export const WHY_CONTEXT_PROMPT = "¿Por qué necesitas estos datos? Explícamelo brevemente y no hagas el análisis todavía.";
export const USE_AVAILABLE_DATA_PROMPT = "Haz el análisis sólo con la información disponible. No inventes los datos faltantes y señala claramente las limitaciones.";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es-MX");
}

export function requestedContextFields(request: string): ContextField[] {
  const text = normalize(request);
  const fields: ContextField[] = [];
  if (/\b(?:estado|entidad|territorio|lugar)\b/u.test(text)) fields.push("territory");
  if (/\b(?:edad|grupo etario|rango de edad)\b/u.test(text)) fields.push("age");
  if (/\b(?:sexo|genero)\b/u.test(text)) fields.push("sex");
  if (/\b(?:ano|eleccion|periodo)\b/u.test(text)) fields.push("year");
  return fields;
}

export function buildContextFollowUp(values: Partial<Record<ContextField, string>>) {
  const labels: Record<ContextField, string> = {
    territory: "estado",
    age: "grupo de edad",
    sex: "sexo",
    year: "año electoral",
  };
  const details = (Object.entries(values) as Array<[ContextField, string]>)
    .filter(([, value]) => value.trim())
    .map(([field, value]) => `${labels[field]}: ${value.trim()}`);
  return `Estos son los datos para continuar: ${details.join("; ")}. Usa este contexto para responder mi pregunta anterior.`;
}
