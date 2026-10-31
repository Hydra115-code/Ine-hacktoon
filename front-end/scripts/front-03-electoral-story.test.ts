import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { electoralExplorationIntents } from "../src/features/electoral-exploration/electoral-exploration-intents.ts";

test("la primera historia cubre periodo, territorio y evidencia", () => {
  assert.equal(electoralExplorationIntents.length, 3);
  assert.deepEqual(new Set(electoralExplorationIntents.map((intent) => intent.focus)), new Set(["period", "territory", "evidence"]));
  assert.equal(new Set(electoralExplorationIntents.map((intent) => intent.id)).size, electoralExplorationIntents.length);
  assert.equal(new Set(electoralExplorationIntents.map((intent) => intent.prompt)).size, electoralExplorationIntents.length);
});

test("las intenciones formulan preguntas sin inventar resultados electorales", () => {
  for (const intent of electoralExplorationIntents) {
    const copy = `${intent.title} ${intent.description} ${intent.prompt}`;
    assert.doesNotMatch(copy, /\b\d{4}\b/u, intent.id);
    assert.doesNotMatch(copy, /\b\d+(?:[.,]\d+)?\s*%/u, intent.id);
    assert.doesNotMatch(copy, /(?:MXN|USD|\$\s*\d)/u, intent.id);
    assert.match(intent.prompt, /(?:participación|patrones territoriales)/iu, intent.id);
  }
});

test("el estado inicial es navegación de intención, no una pantalla con datos mock", () => {
  const component = readFileSync(new URL("../src/features/electoral-exploration/components/ElectoralExplorationStart.tsx", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("../src/features/workspace/components/GenerativeCanvas.tsx", import.meta.url), "utf8");

  assert.match(component, /electoralExplorationIntents\.map/u);
  assert.match(component, /onSelect\?\.\(intent\.prompt\)/u);
  assert.doesNotMatch(component, /(?:DataRegistry|UIRenderer|type="(?:metric|table|visualization)")/u);
  assert.doesNotMatch(component, /\b\d+(?:[.,]\d+)?\s*%/u);
  assert.match(canvas, /<ElectoralExplorationStart/u);
  assert.doesNotMatch(canvas, /const suggestedPrompts/u);
  assert.doesNotMatch(canvas, /hasFinancialData/u);
});
