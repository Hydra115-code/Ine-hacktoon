import type { DataValue } from "../schemas/data-registry-schema.js";

export type DataDisplayFormat =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "percentage"
  | "date"
  | "datetime"
  | "status";

interface FormatDataValueOptions {
  locale: string;
  currency: string;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const decimalAmountPattern = /^-?\d{1,16}(?:\.\d{1,2})?$/;
const localizedDisplayValues: Readonly<Record<string, string>> = {
  active: "Activo",
  inactive: "Inactivo",
  pending: "Pendiente",
  completed: "Completo",
  failed: "No disponible",
  cancelled: "Cancelado",
  success: "Validado",
  increase: "Aumento",
  decrease: "Disminución",
  unchanged: "Sin cambio",
  official: "Fuente oficial",
  preliminary: "Dato preliminar",
  observed: "Observado",
  simulated: "Simulado",
};

export function localizeDisplayValue(value: string) {
  return localizedDisplayValues[value.trim().toLocaleLowerCase("es-MX")] ?? value;
}

function numericDisplayValue(value: DataValue, format: "currency" | "number") {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && decimalAmountPattern.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new TypeError(`${format} requiere un valor numérico válido`);
}

function percentageRatio(value: DataValue) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("percentage requiere un número válido");
  }

  // El contrato compartido usa razones (0.614), mientras que vistas antiguas
  // pueden conservar puntos porcentuales (61.4). Ambos formatos deben verse igual.
  return Math.abs(value) > 1 ? value / 100 : value;
}

const percentageFieldPattern = /(?:^|[._-])(?:percentage|percent|porcentaje|participation|participacion|abstention|abstencion|turnout|rate|ratio|share|pct)(?:$|[._-])|(?:Percentage|Percent|Pct)$/iu;
const percentageLabelPattern = /%|porcentaje|participaci[oó]n|abstenci[oó]n|tasa|proporci[oó]n/iu;
const yearFieldPattern = /(?:^|[._-])(?:year|anio|año)(?:$|[._-])/iu;
const yearLabelPattern = /^(?:año|anio|year)$/iu;

export function inferDataDisplayFormat(
  format: DataDisplayFormat | undefined,
  field?: string,
  label?: string,
): DataDisplayFormat | undefined {
  const isPercentage = (field && percentageFieldPattern.test(field)) || (label && percentageLabelPattern.test(label));
  if (isPercentage && (format === undefined || format === "number" || format === "percent" || format === "percentage")) {
    return "percent";
  }
  const isYear = (field && yearFieldPattern.test(field)) || (label && yearLabelPattern.test(label.trim()));
  if (isYear && (format === undefined || format === "number" || format === "text")) return "text";
  if (format) return format;
  return undefined;
}

export function formatDataValue(
  value: DataValue,
  format: DataDisplayFormat | undefined,
  options: FormatDataValueOptions,
): string | null {
  if (value === null) return null;

  if (format === "text") {
    if (typeof value === "string") return localizeDisplayValue(value);
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return null;
  }

  if (format === "currency") {
    return new Intl.NumberFormat(options.locale, {
      style: "currency",
      currency: options.currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(numericDisplayValue(value, "currency"));
  }

  if (format === "number") {
    return new Intl.NumberFormat(options.locale, { maximumFractionDigits: 2 })
      .format(numericDisplayValue(value, "number"));
  }

  if (format === "percent" || format === "percentage") {
    return new Intl.NumberFormat(options.locale, {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(percentageRatio(value));
  }

  if (format === "date" || format === "datetime") {
    if (typeof value !== "string" || !isoDatePattern.test(value)) throw new TypeError("date requiere una fecha ISO");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new TypeError("La fecha no es válida");
    return new Intl.DateTimeFormat(
      options.locale,
      format === "datetime"
        ? { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }
        : { dateStyle: "medium", timeZone: "UTC" },
    ).format(date);
  }

  if (typeof value === "string") return localizeDisplayValue(value);
  if (typeof value === "number") return new Intl.NumberFormat(options.locale, { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return null;
}
