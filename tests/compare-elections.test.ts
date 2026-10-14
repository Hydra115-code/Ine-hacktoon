import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/tool-output-validator.js";
import { CompareElectionsInputSchema } from "../src/schemas/civic.schema.js";
import {
  CivicDataNotFoundError,
  CivicDataService,
  CivicInvalidRequestError,
} from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-08T12:00:00.000Z") });

test("compara dos procesos y expresa el cambio en puntos porcentuales", async () => {
  const output = await service.compareElections({
    office: "presidencia",
    entity: "Nacional",
    baseYear: 2018,
    compareYear: 2024,
  });
  assert.deepEqual(output.elections.map((election) => election.year), [2018, 2024]);
  assert.deepEqual(output.elections.map((election) => election.turnoutPercentage), [62.92, 61.22]);
  assert.deepEqual(output.turnoutChange, { fromYear: 2018, toYear: 2024, points: -1.7 });
  assert.ok(output.methodologyNotes.some((note) => /puntos porcentuales/u.test(note)));
  assert.ok(output.methodologyNotes.some((note) => /lista nominal cambió/u.test(note)));
  assert.doesNotThrow(() => validateToolOutput("compare_elections", output));
});

test("ordena los años aunque lleguen al revés", async () => {
  const output = await service.compareElections({
    office: "presidencia",
    entity: "Oaxaca",
    baseYear: 2024,
    compareYear: 2018,
  });
  assert.equal(output.turnoutChange.fromYear, 2018);
  assert.equal(output.turnoutChange.toYear, 2024);
});

test("rechaza comparar un año consigo mismo y avisa si falta un proceso", async () => {
  await assert.rejects(
    service.compareElections({ office: "presidencia", entity: "Nacional", baseYear: 2024, compareYear: 2024 }),
    CivicInvalidRequestError,
  );
  await assert.rejects(
    service.compareElections({ office: "presidencia", entity: "Nacional", baseYear: 2012, compareYear: 2024 }),
    CivicDataNotFoundError,
  );
});

test("valida la entrada", () => {
  assert.equal(CompareElectionsInputSchema.safeParse({ office: "presidencia", baseYear: 2018 }).success, false);
});
