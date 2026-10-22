import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/civic-tool-output-validator.js";
import { GetParticipationSummaryInputSchema } from "../src/schemas/civic.schema.js";
import { CivicDataService, CivicInvalidRequestError } from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-15T12:00:00.000Z") });
const AGS_GROUP = {
  year: 2024 as const,
  entities: ["Aguascalientes"],
  sexes: ["hombre" as const],
  ageGroups: ["18-19" as const],
  sectionTypes: ["urbana" as const],
};

test("devuelve conteos y las dos participaciones (oficial CCPC y nominal)", async () => {
  const output = await service.getParticipationSummary(AGS_GROUP);
  assert.equal(output.status, "ok");
  assert.equal(output.level, "estatal");
  assert.equal(output.scope, "Aguascalientes");
  assert.deepEqual(output.filters.entities, [{ code: "01", name: "Aguascalientes" }]);
  assert.deepEqual(
    { ...output.totals },
    {
      nominalList: 14_908, voted: 7_288, didNotVote: 7_297, unspecified: 323, classified: 14_585,
      participationPct: 49.97, nominalParticipationPct: 48.89, abstentionPct: 50.03, unspecifiedPct: 2.17,
    },
  );
  assert.equal(output.composition.reduce((sum, row) => sum + row.count, 0), 14_908);
  assert.doesNotThrow(() => validateToolOutput("get_participation_summary", output));
});

test("marca la muestra y conserva sus avisos", async () => {
  const output = await service.getParticipationSummary({ year: 2024 });
  assert.equal(output.isSampleData, true);
  assert.equal(output.level, "nacional");
  assert.equal(output.scope, "Nacional");
  assert.match(output.source.name, /muestra/u);
  assert.ok(output.warnings.some((warning) => warning.code === "SAMPLE_DATA"));
  assert.ok(output.source.urls[0]?.startsWith("https://ine.mx/"));
});

test("sin año usa el más reciente y lo avisa", async () => {
  const output = await service.getParticipationSummary({ entities: ["01"] });
  assert.equal(output.year, 2024);
  assert.ok(output.warnings.some((warning) => warning.code === "DEFAULT_YEAR_SELECTED"));
});

test("sin datos responde no_data, nunca cero", async () => {
  const output = await service.getParticipationSummary({ year: 2024, entities: ["Jalisco"] });
  assert.equal(output.status, "no_data");
  assert.equal(output.totals, null);
  assert.deepEqual(output.composition, []);
  assert.ok(output.warnings.some((warning) => warning.code === "NO_MATCHING_RECORDS"));
});

test("entiende nombres sin acentos, alias y claves", async () => {
  for (const entity of ["ciudad de mexico", "CDMX", "9", "09"]) {
    const output = await service.getParticipationSummary({ year: 2024, entities: [entity] });
    assert.deepEqual(output.filters.entities, [{ code: "09", name: "Ciudad de México" }], entity);
  }
  await assert.rejects(service.getParticipationSummary({ year: 2024, entities: ["Atlantis"] }), CivicInvalidRequestError);
});

test("valida la entrada: rechaza años sin elección y niveles fuera de alcance", () => {
  assert.equal(GetParticipationSummaryInputSchema.safeParse({ year: 2023 }).success, false);
  assert.equal(GetParticipationSummaryInputSchema.safeParse({ year: 2024, sexes: ["otro"] }).success, false);
  assert.equal(GetParticipationSummaryInputSchema.safeParse({ year: 2024 }).success, true);
});
