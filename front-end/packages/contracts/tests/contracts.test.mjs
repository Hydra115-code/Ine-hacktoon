import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTRACT_FINGERPRINT,
  dataPatchSchema,
  sessionReferenceSchema,
  textAgentRequestSchema,
  textAgentStreamEventSchema,
  uiEventSchema,
  uiPatchSchema,
  uiSpecificationSchema,
} from "../dist/index.js";

const sessionId = "10000000-0000-4000-8000-000000000001";
const correlationId = "20000000-0000-4000-8000-000000000001";
const specification = uiSpecificationSchema.parse({
  version: "1",
  root: {
    type: "section",
    id: "results",
    ariaLabel: "Resultados de la consulta",
    children: [
      { type: "heading", id: "title", content: "Resultados", level: 2 },
      { type: "metric", id: "total", label: "Total", valueBinding: "summary.total", format: "number", semanticState: "data.neutral" },
    ],
  },
});

test("el contrato raíz es neutral y valida el ciclo generativo", () => {
  const sessionState = sessionReferenceSchema.parse({ interfaceRevision: 0, dataRevision: 0, dataKeys: [] });
  const request = textAgentRequestSchema.parse({
    version: "1", sessionId, correlationId, provider: "google", responseMode: "complete-ui",
    query: "Compara los resultados por periodo", sessionState,
  });
  const stream = textAgentStreamEventSchema.parse({
    version: "1", sessionId, correlationId, sequence: 1, type: "ui-started",
    specification, dataRegistry: { version: "1", revision: 0, data: { summary: { total: 42 } } }, revision: 0,
  });
  const event = uiEventSchema.parse({
    version: "1", sessionId, correlationId, interfaceRevision: 0, dataRevision: 0,
    dataKeys: ["summary"], event: { name: "view.details", sourceId: "title" },
  });

  assert.equal(request.query, "Compara los resultados por periodo");
  assert.equal(stream.type, "ui-started");
  assert.equal(event.event.name, "view.details");
  assert.match(CONTRACT_FINGERPRINT, /^[a-f0-9]{64}$/);
});

test("los patches exigen revisiones consecutivas", () => {
  assert.equal(dataPatchSchema.safeParse({
    version: "1", baseRevision: 0, revision: 1, op: "add", key: "summary", value: { total: 43 },
  }).success, true);
  assert.equal(uiPatchSchema.safeParse({
    version: "1", baseRevision: 0, revision: 1, op: "update", target: "title", changes: { content: "Actualizado" },
  }).success, true);
  assert.equal(dataPatchSchema.safeParse({
    version: "1", baseRevision: 0, revision: 2, op: "remove", key: "summary",
  }).success, false);
});

test("el contrato rechaza versiones incompatibles y estados semánticos de legado", () => {
  assert.equal(uiSpecificationSchema.safeParse({ ...specification, version: "2" }).success, false);
  const legacy = structuredClone(specification);
  legacy.root.children[1].semanticState = "financial.neutral";
  assert.equal(uiSpecificationSchema.safeParse(legacy).success, false);
});
