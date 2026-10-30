import assert from "node:assert/strict";
import test from "node:test";
import { CivicDataService } from "../src/services/civic-data.service.js";
import { parseUiDocument, type UiDataSource, type UiDocument } from "../src/ui/dsl/ui.schema.js";
import { validateCivicUi } from "../src/ui/generation/civic-semantic-ui-validator.js";
import { createCivicUiFallback } from "../src/ui/generation/civic-ui-fallback.js";
import { GeminiUiGenerator } from "../src/ui/generation/gemini-ui-generator.js";

const service = new CivicDataService({ now: () => new Date("2026-10-15T12:00:00.000Z") });
const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

async function sources(): Promise<UiDataSource[]> {
  return [
    { id: "aguascalientes", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, entities: ["Aguascalientes"] }) },
    { id: "nacional", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024 }) },
  ];
}

const chartOf = (sourceId: string) => ({
  id: `grafica-${sourceId}`,
  type: "chart" as const,
  title: "Cómo se reparte la lista nominal",
  chartType: "bar" as const,
  data: { sourceId, path: "composition" },
  categoryKey: "category",
  series: [{ key: "count", label: "Personas" }],
});

const tableOf = (sourceId: string) => ({
  id: `tabla-${sourceId}`,
  type: "table" as const,
  title: "Detalle",
  data: { sourceId, path: "composition" },
  columns: [{ key: "category", label: "Categoría" }, { key: "count", label: "Personas" }],
  maxRows: 3,
});

function stack(...children: UiDocument["root"][]): UiDocument {
  return { version: "1.0", root: { id: "raiz", type: "stack", direction: "vertical", children } };
}

const QUERY = "¿Cómo fue la participación en Aguascalientes en 2024?";
const ANSWER = "En Aguascalientes, la participación oficial de 2024 en la muestra fue alta.";

test("la UI incluye tabla o evidencia verificable", async () => {
  const data = await sources();
  assert.deepEqual(codes(validateCivicUi({ query: QUERY, answer: ANSWER, document: stack(chartOf("aguascalientes")), dataSources: data })), ["civic_evidence_required"]);
  assert.deepEqual(validateCivicUi({ query: QUERY, answer: ANSWER, document: stack(chartOf("aguascalientes"), tableOf("aguascalientes")), dataSources: data }), []);
});

test("también cuenta como evidencia mostrar votaron y su total", async () => {
  const data = await sources();
  const metrics = stack(
    { id: "votaron", type: "metric", label: "Votaron", value: { sourceId: "aguascalientes", path: "totals.voted" }, format: "number" },
    { id: "total", type: "metric", label: "Votaron + no votaron", value: { sourceId: "aguascalientes", path: "totals.classified" }, format: "number" },
  );
  assert.deepEqual(validateCivicUi({ query: QUERY, answer: ANSWER, document: metrics, dataSources: data }), []);
});

test("si el usuario pide no ver tablas, no se exige la tabla", async () => {
  const data = await sources();
  for (const query of ["Muéstrame Aguascalientes 2024 sin tabla", "Deja sólo la gráfica de Aguascalientes 2024"]) {
    assert.deepEqual(validateCivicUi({ query, answer: ANSWER, document: stack(chartOf("aguascalientes")), dataSources: data }), [], query);
  }
});

test("no mezclar niveles territoriales en una misma visualización", () => {
  const mixed: UiDataSource[] = [{
    id: "mezcla",
    toolName: "get_participation_breakdown",
    data: {
      dataType: "OBSERVED",
      isSampleData: true,
      dimension: "entidad",
      scope: "Nacional",
      groups: [
        { group: "Nacional", voted: 600, classified: 1_000, participationPct: 60 },
        { group: "Tabasco", voted: 50, classified: 100, participationPct: 50 },
      ],
    },
  }];
  const document = stack({
    id: "tabla-mezcla",
    type: "table",
    title: "Participación",
    data: { sourceId: "mezcla", path: "groups" },
    columns: [{ key: "group", label: "Territorio" }, { key: "participationPct", label: "Participación" }],
    maxRows: 10,
  });
  assert.ok(codes(validateCivicUi({ query: "Compara", answer: "Participación por entidad.", document, dataSources: mixed })).includes("civic_mixed_levels"));
});

test("texto y visualización usan el mismo subconjunto", async () => {
  const data = await sources();
  const query = "Compara Aguascalientes con el total nacional en 2024";
  const answer = "En Aguascalientes la participación oficial fue mayor que a nivel Nacional en la muestra.";
  const onlyState = stack(chartOf("aguascalientes"), tableOf("aguascalientes"));
  assert.deepEqual(codes(validateCivicUi({ query, answer, document: onlyState, dataSources: data })), ["civic_subset_mismatch"]);
  const both = stack(tableOf("aguascalientes"), tableOf("nacional"));
  assert.deepEqual(validateCivicUi({ query, answer, document: both, dataSources: data }), []);

  const comparison: UiDataSource = {
    id: "comparacion",
    toolName: "compare_elections",
    data: await service.compareElections({ years: [2018, 2024], entities: ["Aguascalientes"] }),
  };
  const wrongYear = "En 2018 la participación oficial en Aguascalientes fue distinta.";
  assert.ok(codes(validateCivicUi({ query, answer: wrongYear, document: onlyState, dataSources: [...data, comparison] })).includes("civic_subset_mismatch"));
});

test("la interfaz de respaldo es válida y cumple las reglas con cada tool", async () => {
  const all: UiDataSource[] = [
    { id: "resumen", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, entities: ["Veracruz"] }) },
    { id: "comparacion", toolName: "compare_elections", data: await service.compareElections({ years: [2018, 2021, 2024], entities: ["Aguascalientes"] }) },
    { id: "desglose", toolName: "get_participation_breakdown", data: await service.getParticipationBreakdown({ year: 2024, dimension: "entidad" }) },
    { id: "respaldo", toolName: "get_supporting_records", data: await service.getSupportingRecords({ year: 2024, entities: ["Tabasco"] }) },
    { id: "vacio", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, entities: ["Jalisco"] }) },
  ];
  for (const source of all) {
    const fallback = createCivicUiFallback([source]);
    assert.ok(fallback, source.toolName);
    const document = parseUiDocument(fallback, [source]);
    const text = JSON.stringify(document);
    if (source.id === "vacio") {
      assert.match(text, /no significa participación cero/u);
      continue;
    }
    assert.deepEqual(validateCivicUi({ query: "Muéstrame los datos", answer: "Datos electorales.", document, dataSources: [source] }), [], source.id);
    assert.match(text, /Datos de muestra/u);
    assert.match(text, /Fuente:/u);
  }
  assert.equal(createCivicUiFallback([]), undefined);
});

function geminiReturning(documents: unknown[]) {
  let calls = 0;
  const generator = new GeminiUiGenerator({
    apiUrl: "https://generativelanguage.googleapis.com",
    apiKey: "test-key",
    model: "test-model",
    timeoutMs: 1_000,
  }, async () => {
    const document = documents[Math.min(calls, documents.length - 1)];
    calls += 1;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(document) }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  return { generator, calls: () => calls };
}

test("si la UI generada no tiene evidencia, se pide corregir y se acepta la corrección", async () => {
  const data = await sources();
  const { generator, calls } = geminiReturning([stack(chartOf("aguascalientes")), stack(chartOf("aguascalientes"), tableOf("aguascalientes"))]);
  const ui = await generator.generate({ query: QUERY, answer: ANSWER, dataSources: data });
  assert.equal(calls(), 2);
  assert.match(JSON.stringify(ui), /tabla-aguascalientes/u);
});

test("si nunca la corrige, se usa la interfaz cívica de respaldo", async () => {
  const data = await sources();
  const { generator, calls } = geminiReturning([stack(chartOf("aguascalientes"))]);
  const ui = await generator.generate({ query: QUERY, answer: ANSWER, dataSources: data });
  assert.equal(calls(), 3);
  assert.equal(ui.root.id, "respuesta-civica");
  assert.match(JSON.stringify(ui), /Datos de muestra/u);
});
