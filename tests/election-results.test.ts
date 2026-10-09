import assert from "node:assert/strict";
import test from "node:test";
import { validateToolOutput } from "../src/agent/mcp-client/tool-output-validator.js";
import { GetElectionResultsInputSchema } from "../src/schemas/election-results.schema.js";
import {
  ElectionDataNotFoundError,
  ElectionResultsService,
} from "../src/services/election-results.service.js";

const service = new ElectionResultsService(undefined, () => new Date("2026-10-08T12:00:00.000Z"));

test("calcula porcentajes y participación y marca los datos como de ejemplo", () => {
  const output = service.getResults({ year: 2024, office: "presidencia", entity: "Nacional" });
  assert.equal(output.level, "nacional");
  assert.equal(output.isSampleData, true);
  assert.match(output.source.name, /ejemplo/u);
  assert.deepEqual(output.results.map((result) => result.percentage), [50, 30, 20]);
  assert.equal(output.participation.totalVotes, 60_000_000);
  assert.equal(output.participation.turnoutPercentage, 61.22);
  assert.doesNotThrow(() => validateToolOutput("get_election_results", output));
});

test("encuentra entidades sin importar acentos ni mayúsculas", () => {
  const output = service.getResults({ year: 2024, office: "presidencia", entity: "nuevo leon" });
  assert.equal(output.entity, "Nuevo León");
  assert.equal(output.level, "estatal");
});

test("responde con un error claro cuando no hay datos", () => {
  assert.throws(
    () => service.getResults({ year: 2018, office: "presidencia", entity: "Nacional" }),
    ElectionDataNotFoundError,
  );
});

test("valida la entrada: usa Nacional por defecto y rechaza cargos desconocidos", () => {
  assert.equal(GetElectionResultsInputSchema.parse({ year: 2024, office: "presidencia" }).entity, "Nacional");
  assert.equal(GetElectionResultsInputSchema.safeParse({ year: 2024, office: "alcaldia" }).success, false);
});
