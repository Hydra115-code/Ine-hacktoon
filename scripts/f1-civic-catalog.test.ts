import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dataRegistrySchema, uiSpecificationSchema } from "@ine/contracts";
import {
  f1CivicCatalogData,
  f1CivicCatalogSpecification,
} from "../src/features/generative-ui/fixtures/f1-civic-catalog-fixture.ts";

const expectedCivicTypes = [
  "electionDelta",
  "territoryRanking",
  "participationTimeline",
  "dataQualityBadge",
  "demographicBreakdown",
  "comparisonMatrix",
  "evidenceSummary",
  "civicInsight",
] as const;

function collectTypes(root: Record<string, unknown>) {
  const types = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if (typeof node.type === "string") types.add(node.type);
    if (Array.isArray(node.children)) pending.push(...node.children as Record<string, unknown>[]);
  }
  return types;
}

test("F1 valida el contrato y el registro de datos sintéticos", () => {
  assert.equal(uiSpecificationSchema.safeParse(f1CivicCatalogSpecification).success, true);
  assert.equal(dataRegistrySchema.safeParse(f1CivicCatalogData).success, true);
});

test("F1 demuestra los ocho componentes cívicos enlazados", () => {
  const types = collectTypes(f1CivicCatalogSpecification.root as unknown as Record<string, unknown>);
  expectedCivicTypes.forEach((type) => assert.equal(types.has(type), true, type));

  const serialized = JSON.stringify(f1CivicCatalogSpecification);
  expectedCivicTypes.forEach((type) => assert.equal(serialized.includes(`"type":"${type}"`), true, type));
  assert.match(serialized, /"dataBinding":/u);
});

test("el renderer y la matriz anuncian las mismas capacidades F1", () => {
  const renderer = readFileSync(new URL("../src/features/generative-ui/runtime/LayoutRenderer.tsx", import.meta.url), "utf8");
  const matrix = readFileSync(new URL("../src/features/generative-ui/runtime/node-capability-matrix.ts", import.meta.url), "utf8");
  expectedCivicTypes.forEach((type) => {
    assert.equal(renderer.includes(`case "${type}"`), true, type);
    assert.equal(matrix.includes(`type: "${type}"`), true, type);
  });
});

test("los componentes F1 no contienen cifras ni entidades del fixture", () => {
  const componentPaths = [
    "ElectionDelta.tsx",
    "TerritoryRanking.tsx",
    "ParticipationTimeline.tsx",
    "DataQualityBadge.tsx",
    "DemographicBreakdown.tsx",
    "ComparisonMatrix.tsx",
    "EvidenceSummary.tsx",
    "CivicInsight.tsx",
  ];
  for (const componentPath of componentPaths) {
    const source = readFileSync(new URL(`../src/features/generative-ui/primitives/civic/${componentPath}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /Entidad Alfa|Entidad Beta|2009|2024|45\.2|61\.4/u, componentPath);
  }
});

test("el layout conserva respiración entre visualizaciones y tarjetas", () => {
  const layoutCss = readFileSync(new URL("../src/features/generative-ui/styles/layout-primitives.css", import.meta.url), "utf8");
  assert.match(layoutCss, /\[data-node-type="visualization"\]/u);
  assert.match(layoutCss, /\[data-node-type="territoryRanking"\]/u);
  assert.match(layoutCss, /\[data-node-type="comparisonMatrix"\]/u);
  assert.match(layoutCss, /margin-block-start:\s*var\(--space-6\)/u);
});
