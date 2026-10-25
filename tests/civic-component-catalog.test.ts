import assert from "node:assert/strict";
import test from "node:test";
import {
  CIVIC_COMPONENT_CATALOG,
  CIVIC_COMPONENT_TYPES,
  FRONTEND_RUNTIME_NODE_TYPES,
  planCivicComponents,
  supportsCivicComponent,
} from "../src/ui/generation/civic-component-catalog.js";

test("el backend conoce los 42 nodos del runtime y los nueve componentes cívicos", () => {
  assert.equal(FRONTEND_RUNTIME_NODE_TYPES.length, 42);
  assert.equal(new Set(FRONTEND_RUNTIME_NODE_TYPES).size, 42);
  assert.equal(CIVIC_COMPONENT_TYPES.length, 9);
  assert.deepEqual(Object.keys(CIVIC_COMPONENT_CATALOG), [...CIVIC_COMPONENT_TYPES]);
  for (const type of CIVIC_COMPONENT_TYPES) {
    assert.equal(FRONTEND_RUNTIME_NODE_TYPES.includes(type), true, type);
    assert.equal(supportsCivicComponent(type), true, type);
    assert.ok(CIVIC_COMPONENT_CATALOG[type].requires.length > 0, type);
  }
});

test("el plan de componentes respeta intención, presentación y compatibilidad de datos", () => {
  assert.deepEqual(
    planCivicComponents({ composition: "ranking", presentation: ["map"] }),
    ["mexicoChoropleth", "territoryRanking", "dataQualityBadge"],
  );
  assert.deepEqual(
    planCivicComponents({ composition: "two-elections", presentation: ["matrix", "story"] }),
    ["comparisonMatrix", "electionDelta", "dataQualityBadge", "civicInsight"],
  );
  assert.equal(
    planCivicComponents({ composition: "summary", presentation: ["matrix"] }).includes("comparisonMatrix"),
    false,
  );
});
