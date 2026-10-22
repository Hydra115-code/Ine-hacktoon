import assert from "node:assert/strict";
import test from "node:test";
import { CivicHarness, queryRequest } from "./support/civic-harness.js";

test("I6 emite DataPatch antes de la primera UI que consume sus bindings", async () => {
  const harness = new CivicHarness();
  const events = await harness.run(queryRequest(
    "33000000-0000-4000-8000-000000000001",
    "44000000-0000-4000-8000-000000000001",
    "Muéstrame una gráfica de votos por partido a nivel nacional en 2024",
  ));
  const dataIndex = events.findIndex((event) => event.type === "data-patch");
  const uiIndex = events.findIndex((event) => event.type === "ui-started" || event.type === "ui");
  const completedIndex = events.findIndex((event) => event.type === "ui-completed");
  const planningIndex = events.findIndex((event) => event.type === "status" && event.status.stage === "generating_ui");

  assert.ok(dataIndex >= 0, "debe existir un DataPatch");
  assert.ok(uiIndex > dataIndex, "la UI inicial debe llegar después de sus datos");
  assert.ok(uiIndex > planningIndex, "la UI real no debe adelantarse al planificador");
  assert.ok(completedIndex > uiIndex, "la primera UI útil debe preceder al cierre");
  assert.equal(events.slice(0, planningIndex).filter((event) => event.type === "ui-started").length, 0);

  const initialUI = events[uiIndex];
  assert.ok(initialUI?.type === "ui-started" || initialUI?.type === "ui");
  assert.equal(initialUI.specification.root.type, "visualization");
  assert.equal(events.slice(0, completedIndex).filter((event) => event.type === "ui-started").length, 1);
});

test("GEN4 mantiene feedback inmediato y no publica UI falsa con planificador lento", async () => {
  const harness = new CivicHarness({ uiGenerationDelayMs: 250 });
  const request = queryRequest(
    "33000000-0000-4000-8000-000000000002",
    "44000000-0000-4000-8000-000000000002",
    "¿Cómo votó Aguascalientes en la elección presidencial de 2024?",
  );
  const startedAt = performance.now();
  const observed: Array<{ type: string; atMs: number }> = [];
  for await (const event of harness.service(request)) {
    observed.push({ type: event.type, atMs: performance.now() - startedAt });
  }

  const firstFeedback = observed[0];
  const firstUi = observed.find((event) => event.type === "ui-started");
  const finalUi = observed.find((event) => event.type === "ui-completed");
  assert.equal(firstFeedback?.type, "started");
  assert.ok(firstFeedback.atMs < 500, "el primer feedback debe llegar antes de 500 ms");
  assert.ok(firstUi && firstUi.atMs >= 200, "la UI no debe anticiparse al planificador lento");
  assert.ok(finalUi && finalUi.atMs >= firstUi.atMs);
  assert.equal(observed.filter((event) => event.type === "ui-started").length, 1);
});

test("GEN4 publica una sola vista final al consultar nuevos datos en el mismo hilo", async () => {
  const harness = new CivicHarness();
  const sessionId = "33000000-0000-4000-8000-000000000003";
  await harness.run(queryRequest(sessionId, "44000000-0000-4000-8000-000000000003", "Resultados nacionales de la elección presidencial 2024"));
  const previous = harness.sessions.latest();
  const events = await harness.run(queryRequest(
    sessionId,
    "44000000-0000-4000-8000-000000000004",
    "¿Y cuál fue la participación en Tabasco?",
    previous,
  ));
  const replacements = events.filter((event) => event.type === "ui-started");
  assert.equal(replacements.length, 1);
  assert.equal(replacements[0]?.revision, previous.interfaceRevision + 1);
  assert.equal(events.filter((event) => event.type === "ui-patch").length, 0);
  assert.ok(events.some((event) => event.type === "ui-completed"));
});
