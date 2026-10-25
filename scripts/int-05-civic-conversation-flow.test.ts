import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dataPatchSchema, uiSpecificationSchema } from "@ine/contracts";
import { createCivicStreamFallback, identifyCivicTool } from "../src/features/integration/civic-data/civic-stream-fallback.ts";
import { civicToolContractFixtures } from "../src/features/integration/civic-data/fixtures/civic-tool-contract-fixtures.ts";

function sharedPatch(value: unknown) {
  return dataPatchSchema.parse({
    version: "1",
    baseRevision: 0,
    revision: 1,
    op: "add",
    key: "source_1",
    value,
  });
}

function asSharedSummary() {
  const value = structuredClone(civicToolContractFixtures.get_participation_summary);
  value.participation.turnoutPercentage /= 100;
  value.participation.abstentionPercentage /= 100;
  value.results.forEach((row) => { row.percentage /= 100; });
  return value;
}

test("reconoce las cuatro formas cívicas sin depender del nombre de la clave", () => {
  for (const [toolName, fixture] of Object.entries(civicToolContractFixtures)) {
    assert.equal(identifyCivicTool(fixture), toolName);
  }
  assert.equal(identifyCivicTool({ accounts: [], balance: 10 }), null);
});

test("convierte el primer resultado MCP compartido en una UI cívica útil", () => {
  const fallback = createCivicStreamFallback(sharedPatch(asSharedSummary()));
  assert.ok(fallback);
  assert.equal(fallback.adaptation.status, "complete");
  assert.equal((fallback.data.participation as Record<string, unknown>).turnoutPercentage, 45);
  assert.doesNotThrow(() => uiSpecificationSchema.parse(fallback.specification));
  const serialized = JSON.stringify(fallback.specification);
  assert.match(serialized, /Personas que votaron/u);
  assert.match(serialized, /Lista nominal/u);
  assert.match(serialized, /Fuente/u);
});

test("no crea una UI provisional para fuentes ajenas al dominio cívico", () => {
  assert.equal(createCivicStreamFallback(sharedPatch({ accounts: [{ balance: 100 }] })), null);
});

test("conserva evidencia parcial cuando el adaptador compartido ocultó sólo el identificador técnico", () => {
  const value = structuredClone(civicToolContractFixtures.get_supporting_records) as {
    records: Array<Record<string, unknown>>;
  };
  for (const record of value.records) delete record.recordId;
  const fallback = createCivicStreamFallback(sharedPatch(value));
  assert.ok(fallback);
  assert.equal(fallback.adaptation.status, "partial");
  assert.equal((fallback.data.records as unknown[]).length, 3);
  assert.doesNotMatch(JSON.stringify(fallback.specification), /Información parcial/u);
  assert.doesNotMatch(JSON.stringify(fallback.specification), /campos válidos/u);
  assert.doesNotMatch(JSON.stringify(fallback.data), /recordId/u);
});

test("la continuidad escrita envía y valida la especificación vigente sólo en la ruta Next", () => {
  const session = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/agent/route.ts", import.meta.url), "utf8");
  const planner = readFileSync(new URL("../src/features/agent/server/stream-planned-agent.ts", import.meta.url), "utf8");
  assert.match(session, /currentSpecification: patchState\.specification/u);
  assert.doesNotMatch(session, /finanz|cuentas|gastos|pagos/iu);
  assert.match(route, /createUIPatchState\(parsedRequest\.data\.currentSpecification, state\.data\.interfaceRevision\)/u);
  assert.match(route, /initialState: input\.session\.initialState/u);
  assert.match(planner, /let patchState: UIPatchState \| undefined = options\.initialState/u);
});

test("la conversación pública usa un propietario local estable sin interponer el acceso de Supabase", () => {
  const shell = readFileSync(new URL("../src/features/workspace/components/AppShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /const PUBLIC_WORKSPACE_OWNER_KEY = "[a-f0-9]{64}"/u);
  assert.match(shell, /<AgentSessionProvider ownerKey=\{PUBLIC_WORKSPACE_OWNER_KEY\}>/u);
  assert.doesNotMatch(shell, /SessionAccessGate/u);
  assert.doesNotMatch(shell, /LOCAL_UI_OWNER_KEY/u);
});

test("el flujo progresivo emite una vista validada y la cierra si el planner no entrega otra", () => {
  const planner = readFileSync(new URL("../src/features/agent/server/stream-planned-agent.ts", import.meta.url), "utf8");
  assert.match(planner, /createCivicStreamFallback\(event\.patch\)/u);
  assert.match(planner, /type: "ui-started"/u);
  assert.match(planner, /hasProgressiveCivicFallback && !sawUiCompleted/u);
  assert.match(planner, /type: "ui-completed", revision: patchState\.revision/u);
});
