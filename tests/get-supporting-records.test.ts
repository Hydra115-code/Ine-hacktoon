import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/tool-output-validator.js";
import { CivicDataService } from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-15T12:00:00.000Z") });

test("devuelve los grupos de la fuente y los archivos oficiales", async () => {
  const output = await service.getSupportingRecords({ year: 2024, entities: ["Aguascalientes"], sexes: ["hombre"], ageGroups: ["18-19"], sectionTypes: ["urbana"] });
  assert.equal(output.records.length, 1);
  assert.deepEqual(
    { entity: output.records[0]!.entity, voted: output.records[0]!.voted, sourceRows: output.records[0]!.sourceRows },
    { entity: "Aguascalientes", voted: 7_288, sourceRows: 1_025 },
  );
  assert.equal(output.sources[0]!.id, "2024:01");
  assert.match(output.sources[0]!.url, /^https:\/\/ine\.mx\//u);
  assert.equal(output.truncated, false);
  assert.doesNotThrow(() => validateToolOutput("get_supporting_records", output));
});

test("los registros cuadran con el resumen", async () => {
  const input = { year: 2024 as const, entities: ["Aguascalientes"] };
  const summary = await service.getParticipationSummary(input);
  const support = await service.getSupportingRecords(input);
  assert.equal(support.records.reduce((sum, record) => sum + record.voted, 0), summary.totals!.voted);
  assert.equal(support.records.reduce((sum, record) => sum + record.nominalList, 0), summary.totals!.nominalList);
});

test("corta la lista larga y lo indica", async () => {
  const output = await service.getSupportingRecords({ year: 2024 });
  assert.ok(output.records.length <= 60);
  assert.equal(output.truncated, output.totalRecords > 60);
});
