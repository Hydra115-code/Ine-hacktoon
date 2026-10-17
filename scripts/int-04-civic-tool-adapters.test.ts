import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { adaptCivicToolOutput } from "../src/features/integration/civic-data/civic-tool-adapter.ts";
import { civicToolContractFixtures } from "../src/features/integration/civic-data/fixtures/civic-tool-contract-fixtures.ts";
import { civicToolNames, civicToolOutputSchemas } from "../src/features/integration/civic-data/civic-tool-wire.ts";
import { buildCivicToolUISpecification } from "../src/features/integration/civic-data/civic-tool-ui.ts";
import { uiSpecificationSchema } from "@ine/contracts";

const backendSchemaDist = process.env.INE_BACKEND_CIVIC_SCHEMA_DIST
  ?? resolve(import.meta.dirname, "../../back-end/dist/schemas/civic.schema.js");
const backendServiceDist = resolve(backendSchemaDist, "../../services/civic-data.service.js");

test("los cuatro fixtures cumplen los esquemas frontend", () => {
  assert.deepEqual([...civicToolNames], [
    "get_participation_summary",
    "compare_elections",
    "get_participation_breakdown",
    "get_supporting_records",
  ]);
  for (const toolName of civicToolNames) {
    assert.doesNotThrow(() => civicToolOutputSchemas[toolName].parse(civicToolContractFixtures[toolName]), toolName);
  }
});

test("el servicio compilado del backend emite las cuatro respuestas conforme a su contrato", {
  skip: !existsSync(backendSchemaDist) || !existsSync(backendServiceDist),
}, async () => {
  const backend = await import(pathToFileURL(backendSchemaDist).href) as Record<string, { parse(value: unknown): unknown }>;
  const serviceModule = await import(pathToFileURL(backendServiceDist).href) as {
    CivicDataService: new () => {
      getParticipationSummary(input: unknown): Promise<unknown>;
      compareElections(input: unknown): Promise<unknown>;
      getParticipationBreakdown(input: unknown): Promise<unknown>;
      getSupportingRecords(input: unknown): Promise<unknown>;
    };
  };
  const schemas = {
    get_participation_summary: backend.GetParticipationSummaryOutputSchema,
    compare_elections: backend.CompareElectionsOutputSchema,
    get_participation_breakdown: backend.GetParticipationBreakdownOutputSchema,
    get_supporting_records: backend.GetSupportingRecordsOutputSchema,
  };
  const service = new serviceModule.CivicDataService();
  const outputs = {
    get_participation_summary: await service.getParticipationSummary({ year: 2024 }),
    compare_elections: await service.compareElections({ years: [2018, 2024] }),
    get_participation_breakdown: await service.getParticipationBreakdown({ year: 2024, dimension: "sexo" }),
    get_supporting_records: await service.getSupportingRecords({ year: 2024 }),
  };
  for (const toolName of civicToolNames) {
    assert.doesNotThrow(() => schemas[toolName].parse(outputs[toolName]), toolName);
  }
});

test("adapta cada respuesta completa sin recalcular cifras", () => {
  const summary = adaptCivicToolOutput("get_participation_summary", civicToolContractFixtures.get_participation_summary);
  assert.equal(summary.status, "complete");
  assert.deepEqual(summary.data?.participation, civicToolContractFixtures.get_participation_summary.participation);

  const comparison = adaptCivicToolOutput("compare_elections", civicToolContractFixtures.compare_elections);
  assert.equal(comparison.status, "complete");
  assert.deepEqual(comparison.data?.turnoutChange, { fromYear: 2018, toYear: 2024, points: 16 });
  assert.deepEqual(comparison.data?.methodologyNotes, ["Fixture: diferencia expresada en puntos porcentuales."]);

  const breakdown = adaptCivicToolOutput("get_participation_breakdown", civicToolContractFixtures.get_participation_breakdown);
  assert.equal(breakdown.status, "complete");
  assert.equal((breakdown.data?.groups as unknown[])?.length, 2);
  assert.equal(breakdown.data?.coverageNote, "Fixture con dos entidades ficticias; no representa cobertura oficial.");

  const supporting = adaptCivicToolOutput("get_supporting_records", civicToolContractFixtures.get_supporting_records);
  assert.equal(supporting.status, "complete");
  assert.deepEqual(supporting.data?.records, civicToolContractFixtures.get_supporting_records.records);
});

test("las cuatro respuestas producen árboles GenUI válidos y verificables", () => {
  for (const toolName of civicToolNames) {
    const adaptation = adaptCivicToolOutput(toolName, civicToolContractFixtures[toolName]);
    const specification = buildCivicToolUISpecification(adaptation);
    assert.doesNotThrow(() => uiSpecificationSchema.parse(specification), toolName);
    const serialized = JSON.stringify(specification);
    assert.match(serialized, /Fuente/u, toolName);
    if (toolName === "compare_elections") {
      assert.match(serialized, /participationTimeline/u, toolName);
      assert.match(serialized, /table/u, toolName);
    }
    if (toolName === "get_participation_breakdown") {
      assert.match(serialized, /demographicBreakdown/u, toolName);
      assert.match(serialized, /table/u, toolName);
    }
    if (toolName === "get_supporting_records") assert.doesNotMatch(serialized, /visualization/u, toolName);
  }
});

test("propaga fuente, hora y advertencia de muestra", () => {
  const result = adaptCivicToolOutput("get_participation_summary", civicToolContractFixtures.get_participation_summary);
  const provenance = result.data?.provenance as Record<string, unknown>;
  assert.equal(provenance.toolName, "get_participation_summary");
  assert.equal(provenance.queriedAt, "2026-10-15T12:00:00.000Z");
  assert.deepEqual(provenance.source, civicToolContractFixtures.get_participation_summary.source);
  assert.match(String((result.data?.warnings as string[])?.[0]), /datos de ejemplo/u);
});

test("una respuesta parcial conserva sólo evidencia válida sin inventar faltantes", () => {
  const { participation: _participation, ...partialSummary } = civicToolContractFixtures.get_participation_summary;
  const summary = adaptCivicToolOutput("get_participation_summary", partialSummary);
  assert.equal(summary.status, "partial");
  assert.equal(summary.data?.participation, undefined);
  assert.deepEqual(summary.data?.results, partialSummary.results);
  assert.match(summary.citizenMessage, /parcialmente/u);

  const brokenBreakdown = structuredClone(civicToolContractFixtures.get_participation_breakdown) as {
    groups: Array<Record<string, unknown>>;
  };
  brokenBreakdown.groups.push({ group: "Inválido", nominalList: 0, voters: -1, turnoutPercentage: 140 });
  const breakdown = adaptCivicToolOutput("get_participation_breakdown", brokenBreakdown);
  assert.equal(breakdown.status, "partial");
  assert.equal((breakdown.data?.groups as unknown[])?.length, 2);
});

test("sin evidencia válida rechaza el payload y no produce ceros ni series", () => {
  const result = adaptCivicToolOutput("compare_elections", {
    ...civicToolContractFixtures.compare_elections,
    elections: [],
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.data, null);
  assert.match(result.citizenMessage, /No pudimos validar/u);
  const specification = buildCivicToolUISpecification(result);
  assert.match(JSON.stringify(specification), /Datos no disponibles/u);
  assert.doesNotMatch(JSON.stringify(specification), /valueBinding/u);
});

test("rechaza porcentajes que contradicen numerador y denominador", () => {
  const incoherentSummary = structuredClone(civicToolContractFixtures.get_participation_summary);
  incoherentSummary.participation.turnoutPercentage = 99;
  const summary = adaptCivicToolOutput("get_participation_summary", incoherentSummary);
  assert.equal(summary.status, "partial");
  assert.equal(summary.data?.participation, undefined);
  assert.match(summary.issues.join(" "), /porcentaje no coincide/iu);

  const incoherentEvidence = structuredClone(civicToolContractFixtures.get_supporting_records);
  incoherentEvidence.records[2]!.value = 99;
  const evidence = adaptCivicToolOutput("get_supporting_records", incoherentEvidence);
  assert.equal(evidence.status, "invalid");
  assert.equal(evidence.data, null);
});

test("la implementación no depende del repositorio backend ni contiene semántica financiera", () => {
  const files = ["civic-tool-wire.ts", "civic-tool-adapter.ts", "civic-tool-ui.ts", "fixtures/civic-tool-contract-fixtures.ts"];
  const source = files.map((file) => readFileSync(new URL(`../src/features/integration/civic-data/${file}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /from\s+["'][^"']*back-end|financial\.|currency|MXN/iu);
});
