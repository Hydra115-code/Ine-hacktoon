import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/tool-output-validator.js";
import { GetParticipationSummaryInputSchema } from "../src/schemas/civic.schema.js";
import { CivicDataNotFoundError, CivicDataService } from "../src/services/civic-data.service.js";

const service = new CivicDataService({ now: () => new Date("2026-10-08T12:00:00.000Z") });

test("calcula votos, participación y abstención, y marca los datos como de ejemplo", async () => {
  const output = await service.getParticipationSummary({ year: 2024, office: "presidencia", entity: "Nacional" });
  assert.equal(output.level, "nacional");
  assert.equal(output.isSampleData, true);
  assert.match(output.source.name, /ejemplo/u);
  assert.deepEqual(output.results.map((result) => result.percentage), [50, 30, 20]);
  assert.equal(output.participation.totalVotes, 60_000_000);
  assert.equal(output.participation.turnoutPercentage, 61.22);
  assert.equal(output.participation.abstentionPercentage, 38.78);
  assert.doesNotThrow(() => validateToolOutput("get_participation_summary", output));
});

test("encuentra entidades sin importar acentos ni mayúsculas", async () => {
  const output = await service.getParticipationSummary({ year: 2024, office: "presidencia", entity: "nuevo leon" });
  assert.equal(output.entity, "Nuevo León");
  assert.equal(output.level, "estatal");
});

test("responde con un error claro cuando no hay datos", async () => {
  await assert.rejects(
    service.getParticipationSummary({ year: 2012, office: "presidencia", entity: "Nacional" }),
    CivicDataNotFoundError,
  );
});

test("valida la entrada: usa Nacional por defecto y rechaza cargos desconocidos", () => {
  assert.equal(GetParticipationSummaryInputSchema.parse({ year: 2024, office: "presidencia" }).entity, "Nacional");
  assert.equal(GetParticipationSummaryInputSchema.safeParse({ year: 2024, office: "alcaldia" }).success, false);
  assert.equal(GetParticipationSummaryInputSchema.safeParse({ year: 1900, office: "presidencia" }).success, false);
});
