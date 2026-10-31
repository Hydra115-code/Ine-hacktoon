import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { uiSpecificationSchema } from "@ine/contracts";
import {
  civicComponentTypes,
  planCivicComposition,
} from "../src/features/agent/planner/civic-composition-policy.ts";
import {
  composeF2CivicFixture,
  f2CompositionQuestions,
} from "../src/features/generative-ui/fixtures/f2-civic-composition-fixture.ts";

function collectTypes(root: Record<string, unknown>) {
  const types: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if (typeof node.type === "string") types.push(node.type);
    if (Array.isArray(node.children)) pending.push(...node.children as Record<string, unknown>[]);
  }
  return types;
}

test("F2 clasifica cinco intenciones cívicas con composiciones distintas", () => {
  const plans = f2CompositionQuestions.slice(0, 5).map((query) => planCivicComposition(query));
  assert.deepEqual(plans.map((plan) => plan.intent), ["change", "territory", "trend", "demographic", "evidence"]);
  assert.equal(new Set(plans.map((plan) => [plan.primary, ...plan.supporting].join(">"))).size, 5);
  plans.forEach((plan) => assert.ok(plan.supporting.length <= 2));
});

test("F2 respeta sin gráfica y conserva evidencia no gráfica", () => {
  const plan = planCivicComposition("Quita la gráfica y conserva la evidencia verificable.");
  assert.equal(plan.presentation, "without-chart");
  assert.equal(plan.primary, "evidenceSummary");
  assert.equal(plan.excluded.includes("participationTimeline"), true);
  assert.equal(plan.excluded.includes("territoryRanking"), true);
  assert.equal([plan.primary, ...plan.supporting].some((type) => plan.excluded.includes(type)), false);
});

test("F2 convierte únicamente la tabla en una composición de una sola pieza", () => {
  const plan = planCivicComposition("Déjame únicamente la tabla comparativa.");
  assert.deepEqual(plan, {
    intent: "change",
    primary: "comparisonMatrix",
    supporting: [],
    excluded: civicComponentTypes.filter((component) => component !== "comparisonMatrix"),
    presentation: "table-only",
    rationale: "La solicitud explícita de una sola tabla tiene prioridad sobre la receta temática.",
  });
});

test("cada escenario F2 produce una especificación válida con ids estables", () => {
  for (const query of f2CompositionQuestions) {
    const result = composeF2CivicFixture(query);
    assert.equal(uiSpecificationSchema.safeParse(result.specification).success, true, query);
    const types = collectTypes(result.specification.root as unknown as Record<string, unknown>);
    assert.equal(types.includes(result.plan.primary), true, query);
    assert.equal(result.plan.excluded.some((type) => types.includes(type)), false, query);
    const serialized = JSON.stringify(result.specification);
    assert.doesNotMatch(serialized, /Math\.random|crypto\.randomUUID/u, query);
  }
});

test("el planner remoto recibe el catálogo cívico y sus reglas de composición", () => {
  const capabilities = readFileSync(new URL("../src/features/agent/planner/runtime-capabilities.ts", import.meta.url), "utf8");
  const planner = readFileSync(new URL("../src/features/agent/planner/ui-planner.ts", import.meta.url), "utf8");
  civicComponentTypes.forEach((type) => assert.equal(capabilities.includes(`${type}:`) || capabilities.includes(`"${type}"`), true, type));
  assert.match(capabilities, /CIVIC_COMPOSITION_RECIPES/u);
  assert.match(planner, /one primary civic component and at most two supporting components/u);
  assert.match(planner, /sólo la tabla/u);
});
