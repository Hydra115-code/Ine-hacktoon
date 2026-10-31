import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { uiSpecificationSchema } from "@ine/contracts";
import { formatDataValue } from "../src/features/generative-ui/data-binding/formatting/format-data-value.ts";
import { createINEParticipationFixture, ineParticipationSpecification } from "../src/features/generative-ui/fixtures/ine-participation-fixture.ts";
import { isSensitiveIdentifierField } from "../src/features/generative-ui/data-binding/formatting/mask-sensitive-identifier.ts";
import { normalizeBackendContractPayload, normalizeFrontendContractPayloadForBackend } from "../src/features/integration/contracts/backend-contract-compatibility.ts";

test("el contrato acepta estados cívicos definitivos", () => {
  assert.doesNotThrow(() => uiSpecificationSchema.parse(ineParticipationSpecification));
  const serialized = JSON.stringify(ineParticipationSpecification);
  assert.match(serialized, /trend\.increase/u);
  assert.match(serialized, /evidence\.neutral/u);
  assert.doesNotMatch(serialized, /(?:financial|data)\.(?:positive|negative|neutral|warning)/u);
});

test("el fixture contractual no inventa cifras electorales", () => {
  const source = readFileSync(new URL("../src/features/generative-ui/fixtures/ine-participation-fixture.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:19|20)\d{2}\b/u);
  assert.doesNotMatch(source, /\b\d+(?:[.,]\d+)?\s*%/u);
  const data = { summary: { firstPeriodLabel: "Periodo A", lastPeriodLabel: "Periodo B", firstParticipation: 50, lastParticipation: 55, differencePoints: 5 }, periods: [] };
  assert.equal(createINEParticipationFixture(data).data, data);
});

test("el adaptador conserva compatibilidad con el wire financiero del backend", () => {
  const incoming = normalizeBackendContractPayload({ semanticState: "financial.warning" }) as { semanticState: string };
  assert.equal(incoming.semanticState, "evidence.caution");
  const outgoing = normalizeFrontendContractPayloadForBackend({ semanticState: "trend.decrease" }) as { semanticState: string };
  assert.equal(outgoing.semanticState, "financial.negative");
});

test("formato y protección admiten datos cívicos sin supuestos financieros", () => {
  assert.equal(formatDataValue(123456, "number", { locale: "es-MX", currency: "MXN" }), "123,456");
  assert.equal(formatDataValue(0.614, "percent", { locale: "es-MX", currency: "MXN" }), "61.4%");
  assert.equal(formatDataValue(0.6494, "percentage", { locale: "es-MX", currency: "MXN" }), "64.94%");
  assert.equal(formatDataValue(61.4, "percent", { locale: "es-MX", currency: "MXN" }), "61.4%");
  assert.equal(formatDataValue(61.4, "percentage", { locale: "es-MX", currency: "MXN" }), "61.4%");
  assert.equal(formatDataValue("official", "status", { locale: "es-MX", currency: "MXN" }), "Fuente oficial");
  assert.equal(isSensitiveIdentifierField("persona.claveElector"), true);
  assert.equal(isSensitiveIdentifierField("aggregate.nominalList"), false);
});

test("los componentes de evidencia existen y los fixtures financieros fueron retirados", () => {
  assert.equal(existsSync(new URL("../src/features/generative-ui/primitives/content/SourceNotice.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../src/features/generative-ui/primitives/content/MethodologyNotice.tsx", import.meta.url)), true);
  for (const file of ["f5-personal-banking-fixtures.ts", "f6-financial-education-fixtures.ts", "f7-payment-preparation-fixtures.ts"]) {
    assert.equal(existsSync(new URL(`../src/features/generative-ui/fixtures/${file}`, import.meta.url)), false);
  }
});
