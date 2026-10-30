import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatDataValue, localizeDisplayValue, type DataDisplayFormat } from "../../data-binding/formatting/format-data-value";
import { readDataField } from "../../data-binding/resolver/read-data-field";

export function isDataRecord(value: DataValue | undefined): value is { [key: string]: DataValue } {
  return value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readCivicField(value: DataValue, field: string) {
  return readDataField(value, field);
}

export function readCivicNumber(value: DataValue, field: string) {
  const candidate = readCivicField(value, field);
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined;
}

export function readCivicLabel(value: DataValue, field: string) {
  const candidate = readCivicField(value, field);
  if (typeof candidate === "string") return localizeDisplayValue(candidate);
  if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  return undefined;
}

export function formatCivicValue(
  value: number | undefined,
  format: DataDisplayFormat | undefined,
  unit: string | undefined,
  locale: string,
) {
  if (value === undefined) return "Sin dato";
  const formatted = formatDataValue(value, format ?? "number", { locale, currency: "MXN" }) ?? String(value);
  if (!unit) return formatted;
  if (unit.trim() === "%") {
    return format === "percent" || format === "percentage" ? formatted : `${formatted}%`;
  }
  return `${formatted} ${unit}`;
}

export function percentagePointScale(values: readonly number[], format: DataDisplayFormat | undefined) {
  if (format !== "percent" && format !== "percentage") return 1;
  return values.some((value) => Math.abs(value) > 1) || format === "percentage" ? 1 : 100;
}
