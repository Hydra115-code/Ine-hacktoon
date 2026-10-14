import assert from "node:assert/strict";
import test from "node:test";
import { CivicDataService } from "../src/services/civic-data.service.js";
import { parseUiDocument, type UiDataSource, type UiDocument } from "../src/ui/dsl/ui.schema.js";
import { validateCivicUi } from "../src/ui/generation/civic-semantic-ui-validator.js";
import { createCivicUiFallback } from "../src/ui/generation/civic-ui-fallback.js";
import { GeminiUiGenerator } from "../src/ui/generation/gemini-ui-generator.js";

const service = new CivicDataService({ now: () => new Date("2026-10-08T12:00:00.000Z") });
const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

async function sources(): Promise<UiDataSource[]> {
  return [
    { id: "jalisco", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, office: "presidencia", entity: "Jalisco" }) },
    { id: "nacional", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, office: "presidencia", entity: "Nacional" }) },
  ];
}

const chartOf = (sourceId: string) => ({
  id: `grafica-${sourceId}`,
  type: "chart" as const,
  title: "Votos por partido",
  chartType: "bar" as const,
  data: { sourceId, path: "results" },
  categoryKey: "party",
  series: [{ key: "votes", label: "Votos" }],
});

const tableOf = (sourceId: string) => ({
  id: `tabla-${sourceId}`,
  type: "table" as const,
  title: "Detalle por partido",
  data: { sourceId, path: "results" },
  columns: [{ key: "party", label: "Partido" }, { key: "votes", label: "Votos" }],
  maxRows: 10,
});

function stack(...children: UiDocument["root"][]): UiDocument {
  return { version: "1.0", root: { id: "raiz", type: "stack", direction: "vertical", children } };
}

test("la UI incluye tabla o evidencia verificable", async () => {
  const data = await sources();
  const query = "¿Cómo votó Jalisco en 2024?";
  const answer = "En Jalisco, Partido A obtuvo 40 % de los votos en 2024.";
  assert.deepEqual(codes(validateCivicUi({ query, answer, document: stack(chartOf("jalisco")), dataSources: data })), ["civic_evidence_required"]);
  assert.deepEqual(validateCivicUi({ query, answer, document: stack(chartOf("jalisco"), tableOf("jalisco")), dataSources: data }), []);
});

test("si el usuario pide no ver tablas, no se exige la tabla", async () => {
  const data = await sources();
  const answer = "En Jalisco, Partido A obtuvo 40 % de los votos en 2024.";
  for (const query of ["Muéstrame Jalisco 2024 sin tabla", "Deja sólo la gráfica de Jalisco 2024"]) {
    assert.deepEqual(validateCivicUi({ query, answer, document: stack(chartOf("jalisco")), dataSources: data }), [], query);
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
        { group: "Nacional", voters: 60_000_000, nominalList: 98_000_000, turnoutPercentage: 61.22 },
        { group: "Jalisco", voters: 4_000_000, nominalList: 6_500_000, turnoutPercentage: 61.54 },
      ],
    },
  }];
  const document = stack({
    id: "tabla-mezcla",
    type: "table",
    title: "Participación",
    data: { sourceId: "mezcla", path: "groups" },
    columns: [{ key: "group", label: "Territorio" }, { key: "turnoutPercentage", label: "Participación" }],
    maxRows: 10,
  });
  assert.ok(codes(validateCivicUi({ query: "Compara", answer: "Participación por entidad.", document, dataSources: mixed })).includes("civic_mixed_levels"));
});

test("texto y visualización usan el mismo subconjunto", async () => {
  const data = await sources();
  const query = "Compara Jalisco con el total nacional en 2024";
  const answer = "En Jalisco la participación fue de 61.54 % y a nivel Nacional de 61.22 %.";
  // La respuesta menciona Nacional, pero la UI sólo muestra Jalisco.
  const onlyJalisco = stack(chartOf("jalisco"), tableOf("jalisco"));
  assert.deepEqual(codes(validateCivicUi({ query, answer, document: onlyJalisco, dataSources: data })), ["civic_subset_mismatch"]);
  // Mostrando ambos (cada uno en su visualización) ya coincide.
  const both = stack(tableOf("jalisco"), tableOf("nacional"));
  assert.deepEqual(validateCivicUi({ query, answer, document: both, dataSources: data }), []);
  // Un año que no está en los datos mostrados también cuenta.
  const wrongYear = "En 2018 la participación en Jalisco fue alta.";
  const comparison: UiDataSource = {
    id: "comparacion",
    toolName: "compare_elections",
    data: await service.compareElections({ office: "presidencia", entity: "Jalisco", baseYear: 2018, compareYear: 2024 }),
  };
  assert.ok(codes(validateCivicUi({ query, answer: wrongYear, document: onlyJalisco, dataSources: [...data, comparison] })).includes("civic_subset_mismatch"));
});

test("la interfaz de respaldo es válida y cumple las reglas con cada tool", async () => {
  const all: UiDataSource[] = [
    { id: "resumen", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, office: "presidencia", entity: "Oaxaca" }) },
    { id: "comparacion", toolName: "compare_elections", data: await service.compareElections({ office: "presidencia", entity: "Oaxaca", baseYear: 2018, compareYear: 2024 }) },
    { id: "desglose", toolName: "get_participation_breakdown", data: await service.getParticipationBreakdown({ year: 2024, office: "presidencia", dimension: "entidad", entity: "Nacional" }) },
    { id: "respaldo", toolName: "get_supporting_records", data: await service.getSupportingRecords({ year: 2024, office: "presidencia", entity: "Oaxaca" }) },
  ];
  for (const source of all) {
    const fallback = createCivicUiFallback([source]);
    assert.ok(fallback, source.toolName);
    const document = parseUiDocument(fallback, [source]);
    assert.deepEqual(validateCivicUi({ query: "Muéstrame los datos", answer: "Datos electorales.", document, dataSources: [source] }), [], source.toolName);
    assert.match(JSON.stringify(document), /Datos de ejemplo/u);
    assert.match(JSON.stringify(document), /Fuente:/u);
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
  const { generator, calls } = geminiReturning([stack(chartOf("jalisco")), stack(chartOf("jalisco"), tableOf("jalisco"))]);
  const ui = await generator.generate({ query: "¿Cómo votó Jalisco en 2024?", answer: "En Jalisco, Partido A obtuvo 40 % de los votos en 2024.", dataSources: data });
  assert.equal(calls(), 2);
  assert.match(JSON.stringify(ui), /tabla-jalisco/u);
});

test("si nunca la corrige, se usa la interfaz cívica de respaldo", async () => {
  const data = await sources();
  const { generator, calls } = geminiReturning([stack(chartOf("jalisco"))]);
  const ui = await generator.generate({ query: "¿Cómo votó Jalisco en 2024?", answer: "En Jalisco, Partido A obtuvo 40 % de los votos en 2024.", dataSources: data });
  assert.equal(calls(), 3);
  assert.equal(ui.root.id, "respuesta-civica");
  assert.match(JSON.stringify(ui), /Datos de ejemplo/u);
});
