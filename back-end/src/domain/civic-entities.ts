export const ENTITIES = [
  { code: "01", name: "Aguascalientes" },
  { code: "02", name: "Baja California" },
  { code: "03", name: "Baja California Sur" },
  { code: "04", name: "Campeche" },
  { code: "05", name: "Coahuila" },
  { code: "06", name: "Colima" },
  { code: "07", name: "Chiapas" },
  { code: "08", name: "Chihuahua" },
  { code: "09", name: "Ciudad de México" },
  { code: "10", name: "Durango" },
  { code: "11", name: "Guanajuato" },
  { code: "12", name: "Guerrero" },
  { code: "13", name: "Hidalgo" },
  { code: "14", name: "Jalisco" },
  { code: "15", name: "Estado de México" },
  { code: "16", name: "Michoacán" },
  { code: "17", name: "Morelos" },
  { code: "18", name: "Nayarit" },
  { code: "19", name: "Nuevo León" },
  { code: "20", name: "Oaxaca" },
  { code: "21", name: "Puebla" },
  { code: "22", name: "Querétaro" },
  { code: "23", name: "Quintana Roo" },
  { code: "24", name: "San Luis Potosí" },
  { code: "25", name: "Sinaloa" },
  { code: "26", name: "Sonora" },
  { code: "27", name: "Tabasco" },
  { code: "28", name: "Tamaulipas" },
  { code: "29", name: "Tlaxcala" },
  { code: "30", name: "Veracruz" },
  { code: "31", name: "Yucatán" },
  { code: "32", name: "Zacatecas" },
] as const;

export type EntityCode = typeof ENTITIES[number]["code"];
export const ENTITY_CODES = ENTITIES.map((entity) => entity.code) as [EntityCode, ...EntityCode[]];

const ALIASES: Record<string, EntityCode> = {
  "cdmx": "09",
  "distrito federal": "09",
  "df": "09",
  "mexico": "15",
  "edomex": "15",
  "estado de mexico": "15",
  "coahuila de zaragoza": "05",
  "michoacan de ocampo": "16",
  "veracruz de ignacio de la llave": "30",
};

export function resolveEntityCode(value: string): EntityCode | undefined {
  const normalized = normalizeName(value);
  if (/^\d{1,2}$/u.test(normalized)) {
    const code = normalized.padStart(2, "0");
    return ENTITY_CODES.find((candidate) => candidate === code);
  }
  return ENTITIES.find((entity) => normalizeName(entity.name) === normalized)?.code ?? ALIASES[normalized];
}

export function entityName(code: string): string {
  return ENTITIES.find((entity) => entity.code === code)?.name ?? code;
}

export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-MX").replace(/\s+/gu, " ").trim();
}
