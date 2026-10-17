import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dataPatchSchema, uiSpecificationSchema } from "@ine/contracts";
import { createCivicStreamFallback } from "../src/features/integration/civic-data/civic-stream-fallback.ts";
import { normalizeFrontendContractPayloadForBackend } from "../src/features/integration/contracts/backend-contract-compatibility.ts";

const sharedBreakdown = {
  dataType: "OBSERVED",
  isSampleData: true,
  status: "ok",
  level: "nacional",
  scope: "Nacional",
  filters: { year: 2024, entities: [] },
  source: {
    name: "Conteos Censales de Participación Ciudadana (CCPC), INE — muestra de desarrollo",
    urls: ["https://ine.mx/datos-abiertos-ccpc.zip"],
    note: "Muestra de desarrollo: sus sumas no son totales estatales ni nacionales.",
  },
  warnings: [{ code: "SAMPLE_DATA", message: "Muestra reducida; no representa el total nacional." }],
  metadata: {
    queriedAt: "2026-10-17T07:13:26.149Z",
    recordsSha256: "8dcf0071c3610a7ad7e3480c6c79f9bf6e8ebc76aa232b1ec44aa93971d0d975",
    matchedRecords: 29,
  },
  year: 2024,
  dimension: "entidad",
  groups: [
    { group: "Aguascalientes", value: "01", nominalList: 245897, voted: 132414, didNotVote: 106705, unspecified: 6778, classified: 239119, participationPct: 0.5538, nominalParticipationPct: 0.5385, abstentionPct: 0.4462, unspecifiedPct: 0.0276 },
    { group: "Baja California", value: "02", nominalList: 1, voted: 1, didNotVote: 0, unspecified: 0, classified: 1, participationPct: 1, nominalParticipationPct: 1, abstentionPct: 0, unspecifiedPct: 0 },
    { group: "Ciudad de México", value: "09", nominalList: 4, voted: 3, didNotVote: 1, unspecified: 0, classified: 4, participationPct: 0.75, nominalParticipationPct: 0.75, abstentionPct: 0.25, unspecifiedPct: 0 },
    { group: "Tabasco", value: "27", nominalList: 1, voted: 1, didNotVote: 0, unspecified: 0, classified: 1, participationPct: 1, nominalParticipationPct: 1, abstentionPct: 0, unspecifiedPct: 0 },
    { group: "Veracruz", value: "30", nominalList: 1, voted: 1, didNotVote: 0, unspecified: 0, classified: 1, participationPct: 1, nominalParticipationPct: 1, abstentionPct: 0, unspecifiedPct: 0 },
  ],
  coverageNote: "Incluye 5 de 32 entidades disponibles en los datos cargados.",
} as const;

function patch(value: unknown) {
  return dataPatchSchema.parse({ version: "1", baseRevision: 0, revision: 1, op: "add", key: "source_1", value });
}

test("F4 adapta el desglose territorial real del backend al mapa sin inventar entidades", () => {
  const fallback = createCivicStreamFallback(patch(sharedBreakdown));
  assert.ok(fallback);
  assert.equal(fallback.adaptation.status, "complete");
  assert.equal(fallback.preserveSpecification, true);
  assert.equal((fallback.data.groups as unknown[]).length, 5);
  assert.equal((fallback.data.groups as Array<Record<string, unknown>>)[0]?.participationPct, 55.38);
  assert.equal(fallback.data.coverageNote, "Incluye 5 de 32 entidades disponibles en los datos cargados.");
  assert.doesNotThrow(() => uiSpecificationSchema.parse(fallback.specification));
  const serialized = JSON.stringify(fallback.specification);
  assert.match(serialized, /mexicoChoropleth/u);
  assert.match(serialized, /map\.entity_selected/u);
  assert.match(serialized, /breakdown-table/u);
});

test("F4 conserva fuente, advertencias, huella y tamaño de la muestra", () => {
  const fallback = createCivicStreamFallback(patch(sharedBreakdown));
  assert.ok(fallback);
  const provenance = fallback.data.provenance as Record<string, unknown>;
  assert.equal(provenance.matchedRecords, 29);
  assert.equal(provenance.recordsSha256, sharedBreakdown.metadata.recordsSha256);
  assert.match(JSON.stringify(fallback.data.warnings), /Muestra reducida/u);
  assert.match(JSON.stringify(provenance.source), /CCPC/u);
});

test("F4 representa no_data como ausencia y nunca como participación cero", () => {
  const noData = { ...sharedBreakdown, status: "no_data" as const, groups: [], coverageNote: "No hay entidades para los filtros aplicados." };
  const fallback = createCivicStreamFallback(patch(noData));
  assert.ok(fallback);
  assert.equal((fallback.data.groups as unknown[]).length, 0);
  const serialized = JSON.stringify(fallback.specification);
  assert.match(serialized, /Sin datos para estos filtros/u);
  assert.match(serialized, /no significa que la participación sea cero/u);
  assert.doesNotMatch(serialized, /mexicoChoropleth/u);
});

test("F4 degrada sólo el nodo mapa al cruzar el contrato del backend de lectura", () => {
  const fallback = createCivicStreamFallback(patch(sharedBreakdown));
  assert.ok(fallback);
  const outbound = normalizeFrontendContractPayloadForBackend(fallback.specification) as Record<string, unknown>;
  const serialized = JSON.stringify(outbound);
  assert.doesNotMatch(serialized, /mexicoChoropleth/u);
  assert.match(serialized, /"type":"table"/u);
  assert.match(serialized, /participationPct/u);
});

test("F4 preserva la UI territorial progresiva frente al layout genérico del planner", () => {
  const source = readFileSync(new URL("../src/features/agent/server/stream-planned-agent.ts", import.meta.url), "utf8");
  assert.match(source, /preserveProgressiveCivicSpecification = fallback\.preserveSpecification/u);
  assert.match(source, /fallback\.preserveSpecification && !preserveProgressiveCivicSpecification/u);
  assert.match(source, /if \(preserveProgressiveCivicSpecification\) continue;/u);
  assert.match(source, /event\.type === "error" && preserveProgressiveCivicSpecification/u);
  assert.match(source, /message: "Mapa territorial listo"/u);
  assert.match(source, /type: "ui-completed", revision: initial\.state\.revision/u);
});

test("F4 convierte la selección del mapa en refinamiento ciudadano compatible", () => {
  const source = readFileSync(new URL("../src/features/agent/components/AgentSessionProvider.tsx", import.meta.url), "utf8");
  assert.match(source, /event\.name === "map\.entity_selected"/u);
  assert.match(source, /Profundiza en la participación de \$\{entity\}/u);
  assert.match(source, /sessionIdRef\.current = undefined/u);
  assert.match(source, /dataStateRef\.current = createDataRegistryPatchState\(\)/u);
});
