import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/civic-tool-output-validator.js";
import { CompareElectionsInputSchema } from "../src/schemas/civic.schema.js";
import { CivicDataService, CivicInvalidRequestError } from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-15T12:00:00.000Z") });
const AGS_GROUP = { entities: ["Aguascalientes"], sexes: ["hombre" as const], ageGroups: ["18-19" as const], sectionTypes: ["urbana" as const] };

test("compara dos elecciones y da el cambio en puntos porcentuales", async () => {
  const output = await service.compareElections({ years: [2018, 2024], ...AGS_GROUP });
  assert.deepEqual(output.elections.map((election) => election.year), [2018, 2024]);
  assert.deepEqual(output.elections.map((election) => election.participationPct), [53.58, 49.97]);
  assert.deepEqual(output.changes, [{
    year: 2024, baselineYear: 2018, participationPoints: -3.61, nominalParticipationPoints: -4.08, abstentionPoints: 3.61,
  }]);
  assert.ok(output.methodologyNotes.some((note) => /puntos porcentuales/u.test(note)));
  assert.ok(output.methodologyNotes.some((note) => /universo/u.test(note)));
  assert.doesNotThrow(() => validateToolOutput("compare_elections", output));
});

test("ordena los años y compara hasta seis elecciones", async () => {
  const output = await service.compareElections({ years: [2024, 2009, 2015], entities: ["Aguascalientes"] });
  assert.deepEqual(output.years, [2009, 2015, 2024]);
  assert.equal(output.baselineYear, 2009);
  assert.equal(output.changes.length, 2);
});

test("un año sin datos aparece como sin datos, no como cero", async () => {
  const output = await service.compareElections({ years: [2018, 2024], entities: ["Tabasco"] });
  const [y2018] = output.elections;
  assert.equal(y2018!.hasData, false);
  assert.equal(y2018!.participationPct, null);
  assert.equal(output.changes[0]!.participationPoints, null);
});

test("rechaza comparar un solo año", async () => {
  await assert.rejects(service.compareElections({ years: [2024, 2024] }), CivicInvalidRequestError);
  assert.equal(CompareElectionsInputSchema.safeParse({ years: [2024] }).success, false);
});
