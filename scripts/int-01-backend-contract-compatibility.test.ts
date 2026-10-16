import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { uiSpecificationSchema } from "@ine/contracts";
import {
  BRYAN_BACKEND_CONTRACT_FINGERPRINT,
  isSupportedBackendContractFingerprint,
  normalizeBackendContractPayload,
  normalizeFrontendContractPayloadForBackend,
} from "../src/features/integration/contracts/backend-contract-compatibility.ts";

const backendContractDist = process.env.INE_BACKEND_CONTRACT_DIST
  ?? resolve(import.meta.dirname, "../../back-end/packages/contracts/dist/index.js");

const backendWireSpecification = {
  version: "1",
  root: {
    id: "participation-root",
    type: "stack",
    children: [
      {
        id: "participation-metric",
        type: "metric",
        label: "Participación",
        valueBinding: "turnout",
        format: "percent",
        semanticState: "financial.positive",
      },
      {
        id: "participation-chart",
        type: "visualization",
        ariaLabel: "Comparación de participación",
        mark: "bar",
        dataBinding: "series",
        encoding: {
          x: { field: "period", type: "ordinal" },
          y: { field: "turnout", type: "quantitative" },
        },
      },
    ],
  },
} as const;

const frontendSpecification = {
  version: "1",
  root: {
    id: "participation-root",
    type: "stack",
    children: [
      {
        id: "participation-metric",
        type: "metric",
        label: "Participación",
        valueBinding: "turnout",
        format: "percent",
        semanticState: "data.positive",
      },
      {
        id: "participation-chart",
        type: "visualization",
        ariaLabel: "Comparación de participación",
        mark: "bar",
        dataBinding: "series",
        encoding: {
          x: { field: "period", type: "ordinal", format: "text" },
          y: { field: "turnout", type: "quantitative", format: "percent" },
        },
      },
    ],
  },
} as const;

test("sólo reconoce el contrato nativo y el fingerprint explícito del backend", () => {
  assert.equal(isSupportedBackendContractFingerprint(BRYAN_BACKEND_CONTRACT_FINGERPRINT), true);
  assert.equal(isSupportedBackendContractFingerprint("a".repeat(64)), false);
});

test("normaliza la semántica entrante antes de validar la UI neutral", () => {
  const normalized = normalizeBackendContractPayload(backendWireSpecification);
  const parsed = uiSpecificationSchema.parse(normalized);
  const metric = parsed.root.type === "stack" ? parsed.root.children[0] : undefined;
  assert.equal(metric?.type, "metric");
  if (metric?.type === "metric") assert.equal(metric.semanticState, "data.positive");
});

test("adapta una edición saliente sin eliminar formatos válidos de métricas", () => {
  const normalized = normalizeFrontendContractPayloadForBackend(frontendSpecification) as typeof frontendSpecification;
  const [metric, visualization] = normalized.root.children;
  assert.equal(metric.semanticState, "financial.positive");
  assert.equal(metric.format, "percent");
  assert.equal("format" in visualization.encoding.x, false);
  assert.equal("format" in visualization.encoding.y, false);
});

test("no permite contaminación de prototipo al normalizar JSON no confiable", () => {
  const payload = JSON.parse('{"__proto__":{"polluted":true},"semanticState":"financial.neutral"}') as unknown;
  const normalized = normalizeBackendContractPayload(payload) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(normalized), Object.prototype);
  assert.equal(Object.hasOwn(normalized, "__proto__"), true);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.equal(normalized.semanticState, "data.neutral");
});

test("el esquema compilado real del backend acepta la edición adaptada", {
  skip: !existsSync(backendContractDist),
}, async () => {
  const backend = await import(pathToFileURL(backendContractDist).href) as {
    uiSpecificationSchema: { parse(value: unknown): unknown };
  };
  const normalized = normalizeFrontendContractPayloadForBackend(frontendSpecification);
  assert.doesNotThrow(() => backend.uiSpecificationSchema.parse(normalized));
  assert.doesNotThrow(() => backend.uiSpecificationSchema.parse(backendWireSpecification));
});
