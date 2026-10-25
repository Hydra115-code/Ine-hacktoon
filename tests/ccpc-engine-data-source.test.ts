import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CcpcEngineDataSource,
  mapBreakdown,
  mapComparison,
  mapSummary,
  mapSupporting,
  type CcpcEngine,
} from "../src/infrastructure/ccpc/ccpc-engine-data-source.js";
import { FixtureCivicDataSource } from "../src/fixtures/civic-data.fixture.js";
import { CivicDataService } from "../src/services/civic-data.service.js";

interface RecordedCall {
  method: "getParticipationSummary" | "compareElections" | "getParticipationBreakdown" | "getSupportingRecords";
  input: { filters: Record<string, unknown>; years?: number[]; dimension?: string };
  result: unknown;
}
const recorded = JSON.parse(
  readFileSync(new URL("./fixtures/ccpc-sample-queries.json", import.meta.url), "utf8"),
) as { calls: RecordedCall[] };
const call = (method: RecordedCall["method"]) => recorded.calls.find((candidate) => candidate.method === method)!;
const fixture = new FixtureCivicDataSource();
const codes = (warnings: { code: string }[]) => warnings.map((warning) => warning.code).sort();

test("traduce el resumen del motor y la muestra local da las mismas cifras", async () => {
  const { input, result } = call("getParticipationSummary");
  const mapped = mapSummary(result);
  const local = await fixture.getParticipationSummary(input.filters);
  assert.equal(mapped.evidence.dataset, "sample");
  assert.equal(mapped.totals!.voted, 7_288);
  assert.deepEqual(local.totals, mapped.totals);
  assert.deepEqual(codes(local.warnings), codes(mapped.warnings));
});

test("traduce la comparación (puntos porcentuales oficiales y nominales)", async () => {
  const { input, result } = call("compareElections");
  const mapped = mapComparison(result);
  const local = await fixture.compareElections(input.filters, input.years as never);
  assert.deepEqual(mapped.elections.map((election) => election.year), [2018, 2024]);
  assert.deepEqual(local.elections, mapped.elections);
  for (const [index, change] of mapped.changes.entries()) {
    const other = local.changes[index]!;
    assert.ok(Math.abs(change.participationPoints! - other.participationPoints!) < 1e-9);
    assert.ok(Math.abs(change.nominalParticipationPoints! - other.nominalParticipationPoints!) < 1e-9);
  }
  assert.deepEqual(codes(local.warnings), codes(mapped.warnings));
});

test("traduce el desglose y los registros de respaldo", async () => {
  const breakdown = call("getParticipationBreakdown");
  const mappedBreakdown = mapBreakdown(breakdown.result);
  const localBreakdown = await fixture.getParticipationBreakdown(breakdown.input.filters, breakdown.input.dimension as never);
  assert.deepEqual(localBreakdown.groups, mappedBreakdown.groups);

  const supporting = call("getSupportingRecords");
  const mappedSupporting = mapSupporting(supporting.result);
  const localSupporting = await fixture.getSupportingRecords(supporting.input.filters);
  assert.deepEqual(
    localSupporting.records.map(({ sourceId, sourceRows, voted }) => ({ sourceId, sourceRows, voted })),
    mappedSupporting.records.map(({ sourceId, sourceRows, voted }) => ({ sourceId, sourceRows, voted })),
  );
  assert.equal(mappedSupporting.sources[0]!.id, "2024:01");
});

test("rechaza una respuesta del motor con forma inesperada", () => {
  assert.throws(() => mapSummary({ status: "ok", totals: { voted: "muchos" } }));
});

test("carga el motor una sola vez y reintenta si la carga falla", async () => {
  let loads = 0;
  const engine: CcpcEngine = {
    getParticipationSummary: () => call("getParticipationSummary").result,
    compareElections: () => call("compareElections").result,
    getParticipationBreakdown: () => call("getParticipationBreakdown").result,
    getSupportingRecords: () => call("getSupportingRecords").result,
  };
  const source = new CcpcEngineDataSource(async () => {
    loads += 1;
    if (loads === 1) throw new Error("archivo no encontrado");
    return engine;
  });
  await assert.rejects(source.getParticipationSummary({}), /archivo no encontrado/u);
  await source.getParticipationSummary({});
  await source.compareElections({}, [2018, 2024]);
  assert.equal(loads, 2);

  const output = await new CivicDataService({ dataSource: source }).getParticipationSummary({ year: 2024 });
  assert.equal(output.totals!.participationPct, 49.97);
});

test("con CCPC_DATA_DIR usa el motor de datos real", { skip: !process.env.CCPC_DATA_DIR && "CCPC_DATA_DIR no está configurado" }, async () => {
  const source = CcpcEngineDataSource.fromOptions({ dataDir: process.env.CCPC_DATA_DIR! });
  const service = new CivicDataService({ dataSource: source });
  const input = { year: 2024 as const, entities: ["Aguascalientes"], sexes: ["hombre" as const], ageGroups: ["18-19" as const], sectionTypes: ["urbana" as const] };
  const real = await service.getParticipationSummary(input);
  const local = await new CivicDataService().getParticipationSummary(input);
  assert.deepEqual(real.totals, local.totals);
  const breakdown = await service.getParticipationBreakdown({ year: 2024, dimension: "entidad" });
  assert.equal(breakdown.groups.length, 5);
});

test("la publicación congelada entrega el universo completo sin caer a la muestra", {
  skip: (!process.env.CCPC_DATA_DIR || !process.env.CCPC_DATASET_PATH)
    && "La publicación CCPC completa no está configurada",
}, async () => {
  const source = CcpcEngineDataSource.fromOptions({
    dataDir: process.env.CCPC_DATA_DIR!,
    datasetPath: process.env.CCPC_DATASET_PATH!,
  });
  const service = new CivicDataService({ dataSource: source });
  const documents = await source.initialize();

  assert.equal((documents.capabilities as { schemaVersion: string }).schemaVersion, "ccpc-capabilities/v1");
  assert.equal((documents.dataset as { schemaVersion: string }).schemaVersion, "ccpc-frontend-metadata/v1");
  assert.equal((documents.release as { datasetVersion: string }).datasetVersion, "1.0.0");

  const summary = await service.getParticipationSummary({ year: 2024 });
  assert.equal(summary.isSampleData, false);
  assert.equal(summary.metadata.matchedRecords, 3_503);
  assert.equal(summary.totals?.voted, 54_899_228);

  const breakdown = await service.getParticipationBreakdown({ year: 2024, dimension: "entidad" });
  assert.equal(breakdown.isSampleData, false);
  assert.equal(breakdown.groups.length, 32);
});
