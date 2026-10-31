import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auditUISpecificationAccessibility } from "../src/features/generative-ui/accessibility/audit-ui-accessibility.ts";
import {
  buildParticipationHarnessSpecification,
  buildSyntheticParticipationData,
  syntheticParticipationEntities,
} from "../src/app/dev/ine-participation-harness/participation-harness-model.ts";

function rootChildren(view: "complete" | "without-chart" | "table-only") {
  const specification = buildParticipationHarnessSpecification(view);
  assert.equal(specification.root.type, "section");
  return specification.root.type === "section" ? specification.root.children : [];
}

test("la vista completa reúne comparación, filtro, gráfica, tabla y advertencia", () => {
  const children = rootChildren("complete");
  assert.equal(children.some((node) => node.type === "select"), true);
  assert.equal(children.some((node) => node.type === "visualization"), true);
  assert.equal(children.some((node) => node.type === "table"), true);
  assert.equal(children.some((node) => node.type === "alert"), true);
  assert.deepEqual(auditUISpecificationAccessibility(buildParticipationHarnessSpecification("complete")), []);
});

test("las ediciones quitan sólo lo solicitado y conservan la evidencia", () => {
  const withoutChart = rootChildren("without-chart");
  assert.equal(withoutChart.some((node) => node.type === "visualization"), false);
  assert.equal(withoutChart.some((node) => node.type === "table"), true);
  const tableOnly = rootChildren("table-only");
  assert.deepEqual(tableOnly.map((node) => node.type), ["table"]);
});

test("el filtro cambia el registro y recalcula puntos porcentuales", () => {
  assert.deepEqual(syntheticParticipationEntities.map(({ id }) => id), ["national-scenario", "entity-alpha", "entity-beta"]);
  const alpha = buildSyntheticParticipationData("entity-alpha");
  assert.deepEqual(alpha.summary, {
    firstPeriodLabel: "Participación 2009 (%)",
    lastPeriodLabel: "Participación 2024 (%)",
    firstParticipation: 52,
    lastParticipation: 67,
    differencePoints: 15,
  });
  assert.equal(Array.isArray(alpha.periods), true);
});

test("el harness identifica los datos como sintéticos y explica fuente y método", () => {
  const component = readFileSync(new URL("../src/app/dev/ine-participation-harness/INEParticipationProbe.tsx", import.meta.url), "utf8");
  assert.match(component, /Datos sintéticos de prueba/u);
  assert.match(component, /No son cifras oficiales del INE/u);
  assert.match(component, /SourceNotice/u);
  assert.match(component, /MethodologyNotice/u);
  assert.match(component, /base ficticia de 100 personas/u);
  assert.doesNotMatch(component, /currency:\s*["']/u);
});

test("las interacciones son operables con teclado y anuncian cambios", () => {
  const component = readFileSync(new URL("../src/app/dev/ine-participation-harness/INEParticipationProbe.tsx", import.meta.url), "utf8");
  const table = readFileSync(new URL("../src/features/generative-ui/table/Table.tsx", import.meta.url), "utf8");
  assert.match(component, /<button[^>]+type="button"/u);
  assert.match(component, /aria-live="polite"/u);
  assert.match(component, /Recuperar vista anterior/u);
  assert.match(table, /role="region"/u);
  assert.match(table, /tabIndex=\{0\}/u);
  assert.match(table, /aria-sort/u);
});

test("la ruta INT-03 no contiene lenguaje financiero", () => {
  const files = ["INEParticipationProbe.tsx", "participation-harness-model.ts", "page.tsx"];
  const source = files.map((file) => readFileSync(new URL(`../src/app/dev/ine-participation-harness/${file}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /banca|saldo|cuenta|pago|gasto|MXN|currency/iu);
});
