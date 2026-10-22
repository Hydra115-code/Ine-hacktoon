import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/civic-tool-output-validator.js";
import { GetParticipationBreakdownInputSchema } from "../src/schemas/civic.schema.js";
import { CivicDataService } from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-15T12:00:00.000Z") });

test("desglosa por sexo con las cifras del motor de datos", async () => {
  const output = await service.getParticipationBreakdown({ year: 2024, dimension: "sexo", entities: ["Aguascalientes"], ageGroups: ["18-19"] });
  assert.deepEqual(output.groups.map((group) => [group.group, group.participationPct]), [["Hombres", 50.71], ["Mujeres", 57.71]]);
  assert.doesNotThrow(() => validateToolOutput("get_participation_breakdown", output));
});

test("desglosa por entidad con nombres legibles y avisa la cobertura", async () => {
  const output = await service.getParticipationBreakdown({ year: 2024, dimension: "entidad" });
  assert.deepEqual(output.groups.map((group) => group.group), ["Aguascalientes", "Baja California", "Ciudad de México", "Tabasco", "Veracruz"]);
  assert.ok(output.groups.every((group) => group.group !== "Nacional"));
  assert.match(output.coverageNote ?? "", /5 de 32/u);
});

test("desglosa por grupo de edad y por tipo de sección", async () => {
  const ages = await service.getParticipationBreakdown({ year: 2024, dimension: "grupo_edad", entities: ["01"] });
  assert.deepEqual(ages.groups.map((group) => group.group), ["18-19 años", "20-24 años", "60-64 años", "100 años o más"]);
  const sections = await service.getParticipationBreakdown({ year: 2024, dimension: "tipo_seccion", entities: ["01"] });
  assert.deepEqual(sections.groups.map((group) => group.value), ["urbana", "mixta", "rural"]);
});

test("rechaza dimensiones fuera de alcance", () => {
  assert.equal(GetParticipationBreakdownInputSchema.safeParse({ dimension: "municipio" }).success, false);
});
