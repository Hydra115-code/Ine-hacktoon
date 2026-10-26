import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { visualizationMarkSchema } from "@ine/contracts";
import { FINAL_DEMO_JOURNEY } from "../src/features/integration/acceptance/final-demo-journey.ts";
import { nodeCapabilityMatrix } from "../src/features/generative-ui/runtime/node-capability-matrix.ts";

test("el recorrido final contiene una consulta y dos refinamientos de la misma vista", () => {
  assert.deepEqual(FINAL_DEMO_JOURNEY.map((step) => step.dataRequest), [
    "required",
    "not-required",
    "not-required",
  ]);
  assert.equal(new Set(FINAL_DEMO_JOURNEY.map((step) => step.id)).size, FINAL_DEMO_JOURNEY.length);
  assert.match(FINAL_DEMO_JOURNEY[0].prompt, /Aguascalientes/u);
  assert.match(FINAL_DEMO_JOURNEY[0].prompt, /2018.*2024/u);
  assert.match(FINAL_DEMO_JOURNEY[1].prompt, /únicamente la tabla/u);
  assert.match(FINAL_DEMO_JOURNEY[2].prompt, /fuente.*metodología/u);
});

test("cada pieza esperada en la demo existe en el catálogo GenUI", () => {
  const available: ReadonlySet<string> = new Set(nodeCapabilityMatrix.map((capability) => capability.type));
  for (const type of ["visualization", "table", "mexicoChoropleth", "participationTimeline"]) {
    assert.ok(available.has(type), `${type} debe existir en el runtime`);
  }
  assert.equal(nodeCapabilityMatrix.length, 42);
  assert.deepEqual(visualizationMarkSchema.options, [
    "line", "area", "bar", "grouped-bar", "stacked-bar", "scatter", "donut", "heatmap",
  ]);
});

test("las preguntas de aceptación son ciudadanas y no reintroducen el dominio financiero", () => {
  const prompts = FINAL_DEMO_JOURNEY.map((step) => step.prompt).join(" ");
  assert.doesNotMatch(prompts, /banc|saldo|cuenta|pago|gasto|transferencia|financier/iu);
  assert.match(prompts, /participación|comparación|fuente|metodología/u);
});

test("la continuidad anuncia únicamente claves confirmadas por eventos de datos", () => {
  const source = readFileSync(new URL(
    "../src/features/agent/components/AgentSessionProvider.tsx",
    import.meta.url,
  ), "utf8");
  assert.doesNotMatch(
    source,
    /Object\.keys\(part\.data\.data \?\? \{\}\)\) authoritativeDataKeysRef\.current\.add\(key\)/u,
    "los valores temporales de la UI progresiva no deben contaminar la referencia del backend",
  );
  assert.match(source, /part\.type === "data-dataAvailable"[\s\S]*?authoritativeDataKeysRef\.current\.add\(part\.data\.key\)/u);
  assert.match(source, /part\.type === "data-dataPatch"[\s\S]*?authoritativeDataKeysRef\.current\.(?:add|delete)\(part\.data\.key\)/u);
  assert.match(source, /dataKeys: \[\.\.\.authoritativeDataKeysRef\.current\]/u);
});
