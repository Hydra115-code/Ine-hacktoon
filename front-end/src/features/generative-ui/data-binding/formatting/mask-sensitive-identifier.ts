import type { DataValue } from "../schemas/data-registry-schema.js";

const sensitiveFieldNames = new Set([
  "account", "accountid", "accountnumber", "card", "cardid", "cardnumber", "clabe",
  "credential", "credentialid", "cuenta", "cuentaid", "curp", "electorid", "claveelector", "iban",
  "numerocuenta", "numerotarjeta", "ocr", "pan", "password", "phone", "refreshToken", "seccionelectoral",
  "secret", "sessiontoken", "tarjeta", "tarjetaid", "token",
].map((value) => value.toLocaleLowerCase("en-US")));

function normalizedLeaf(path: string) {
  return (path.split(".").at(-1) ?? path)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9]/gu, "")
    .toLocaleLowerCase("en-US");
}

export function isSensitiveIdentifierField(path: string): boolean {
  return sensitiveFieldNames.has(normalizedLeaf(path));
}

/** Masks personal, authentication and electoral identifiers; aggregate civic fields remain visible. */
export function maskSensitiveIdentifier(path: string, value: DataValue): string | undefined {
  if (!isSensitiveIdentifierField(path)) return undefined;
  if (typeof value !== "string" && typeof value !== "number") return "••••";

  const normalized = String(value).replace(/[^a-zA-Z0-9]/gu, "");
  if (normalized.length <= 4) return "••••";
  return `•••• ${normalized.slice(-4)}`;
}
