import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/tool-output-validator.js";
import { CivicDataService } from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-08T12:00:00.000Z") });

test("devuelve los registros fuente y explica cómo se calculan los totales", async () => {
  const output = await service.getSupportingRecords({ year: 2024, office: "presidencia", entity: "Jalisco" });
  const sources = output.records.filter((record) => record.kind === "dato_fuente");
  const calculated = output.records.filter((record) => record.kind === "calculado");

  assert.equal(sources.length, 4); // 3 partidos + lista nominal
  assert.ok(calculated.every((record) => record.derivation));
  assert.equal(output.records.find((record) => record.field === "totalVotes")?.value, 4_000_000);
  assert.ok(output.records.every((record) => record.recordId.startsWith("EJEMPLO-2024-PRESIDENCIA-JALISCO")));
  assert.doesNotThrow(() => validateToolOutput("get_supporting_records", output));
});

test("los registros cuadran con el resumen de participación", async () => {
  const input = { year: 2018, office: "presidencia" as const, entity: "Oaxaca" };
  const summary = await service.getParticipationSummary(input);
  const support = await service.getSupportingRecords(input);
  const value = (field: string) => support.records.find((record) => record.field === field)?.value;

  assert.equal(value("totalVotes"), summary.participation.totalVotes);
  assert.equal(value("nominalList"), summary.participation.nominalList);
  assert.equal(value("turnoutPercentage"), summary.participation.turnoutPercentage);
});
