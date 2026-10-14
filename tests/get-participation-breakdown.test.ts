import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/tool-output-validator.js";
import { GetParticipationBreakdownInputSchema } from "../src/schemas/civic.schema.js";
import { CivicDataNotFoundError, CivicDataService } from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-08T12:00:00.000Z") });

test("desglosa por entidad y avisa que la cobertura es parcial", async () => {
  const output = await service.getParticipationBreakdown({
    year: 2024,
    office: "presidencia",
    dimension: "entidad",
    entity: "Nacional",
  });
  assert.deepEqual(output.groups.map((group) => group.group), ["Jalisco", "Nuevo León", "Oaxaca"]);
  assert.ok(output.groups.every((group) => group.group !== "Nacional"));
  assert.match(output.coverageNote ?? "", /3 de 32/u);
  assert.doesNotThrow(() => validateToolOutput("get_participation_breakdown", output));
});

test("desglosa por sexo y los grupos suman el total nacional", async () => {
  const output = await service.getParticipationBreakdown({
    year: 2024,
    office: "presidencia",
    dimension: "sexo",
    entity: "Nacional",
  });
  const voters = output.groups.reduce((sum, group) => sum + group.voters, 0);
  const nominal = output.groups.reduce((sum, group) => sum + group.nominalList, 0);
  assert.equal(voters, 60_000_000);
  assert.equal(nominal, 98_000_000);
  assert.equal(output.scope, "Nacional");
});

test("desglosa por grupo de edad", async () => {
  const output = await service.getParticipationBreakdown({
    year: 2024,
    office: "presidencia",
    dimension: "grupo_edad",
    entity: "Nacional",
  });
  assert.equal(output.groups.length, 4);
  assert.equal(output.groups[0]!.turnoutPercentage, 50);
});

test("avisa cuando no hay desglose para ese territorio", async () => {
  await assert.rejects(
    service.getParticipationBreakdown({ year: 2024, office: "presidencia", dimension: "sexo", entity: "Jalisco" }),
    CivicDataNotFoundError,
  );
});

test("valida la entrada: rechaza dimensiones fuera de alcance", () => {
  assert.equal(
    GetParticipationBreakdownInputSchema.safeParse({ year: 2024, office: "presidencia", dimension: "municipio" }).success,
    false,
  );
});
