import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatDataValue,
  inferDataDisplayFormat,
} from "../src/features/generative-ui/data-binding/formatting/format-data-value.ts";

const options = { locale: "es-MX", currency: "MXN" };

test("muestra igual una razón contractual y un porcentaje legado", () => {
  assert.equal(formatDataValue(0.6494, "percent", options), "64.94%");
  assert.equal(formatDataValue(0.6494, "percentage", options), "64.94%");
  assert.equal(formatDataValue(64.94, "percent", options), "64.94%");
  assert.equal(formatDataValue(64.94, "percentage", options), "64.94%");
  assert.equal(formatDataValue(0.006, "percentage", options), "0.6%");
});

test("infiere porcentajes sólo a partir de campos y etiquetas reconocibles", () => {
  assert.equal(inferDataDisplayFormat(undefined, "participationPct", "Participación oficial (%)"), "percent");
  assert.equal(inferDataDisplayFormat(undefined, "turnoutRate", "Tasa de participación"), "percent");
  assert.equal(inferDataDisplayFormat(undefined, "voted", "Votaron"), undefined);
  assert.equal(inferDataDisplayFormat("number", "participationPct", "Participación"), "percent");
  assert.equal(inferDataDisplayFormat("currency", "participationPct", "Participación"), "currency");
});

test("los años no reciben separadores de miles", () => {
  assert.equal(inferDataDisplayFormat(undefined, "year", "Año"), "text");
  assert.equal(formatDataValue(2018, "text", options), "2018");
});

test("todos los renderizadores aplican el formateador común de porcentajes", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const table = read("../src/features/generative-ui/table/table-model.ts");
  const chart = read("../src/features/generative-ui/visualization/VisualizationCompiler.ts");
  const accessibleChart = read("../src/features/generative-ui/visualization/VisualizationDataTable.tsx");
  const metrics = read("../src/features/generative-ui/runtime/LayoutRenderer.tsx");
  const civic = read("../src/features/generative-ui/primitives/civic/civic-data.ts");

  assert.match(table, /inferDataDisplayFormat\(column\.format, column\.field, column\.label\)/u);
  assert.match(chart, /effectiveChannelFormat/u);
  assert.match(chart, /formatDataValue\(value, quantitativeFormat/u);
  assert.match(accessibleChart, /inferDataDisplayFormat/u);
  assert.match(metrics, /inferDataDisplayFormat\(node\.format, node\.valueBinding/u);
  assert.match(civic, /Math\.abs\(value\) > 1\) \? 1 : 100/u);
});
