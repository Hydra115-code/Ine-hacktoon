import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dataPatchSchema, uiSpecificationSchema, type UINode } from "@ine/contracts";
import { adaptCivicToolOutput } from "../src/features/integration/civic-data/civic-tool-adapter.ts";
import { createCivicStreamFallback, identifyCivicTool } from "../src/features/integration/civic-data/civic-stream-fallback.ts";
import { buildCivicToolUISpecification } from "../src/features/integration/civic-data/civic-tool-ui.ts";
import { civicToolOutputSchemas, type CivicToolName } from "../src/features/integration/civic-data/civic-tool-wire.ts";

interface ReadOnlyCivicService {
  getParticipationSummary(input: { year: number }): Promise<unknown>;
  compareElections(input: { years: number[] }): Promise<unknown>;
  getParticipationBreakdown(input: { year: number; dimension: string }): Promise<unknown>;
  getSupportingRecords(input: { year: number }): Promise<unknown>;
}

const backendServiceUrl = new URL("../../back-end/dist/services/civic-data.service.js", import.meta.url).href;
const { CivicDataService } = await import(backendServiceUrl) as {
  CivicDataService: new (options?: { now?: () => Date }) => ReadOnlyCivicService;
};
const service = new CivicDataService({ now: () => new Date("2026-10-17T12:00:00.000Z") });

const outputs: Record<CivicToolName, unknown> = {
  get_participation_summary: await service.getParticipationSummary({ year: 2024 }),
  compare_elections: await service.compareElections({ years: [2018, 2024] }),
  get_participation_breakdown: await service.getParticipationBreakdown({ year: 2024, dimension: "sexo" }),
  get_supporting_records: await service.getSupportingRecords({ year: 2024 }),
};

function nodeTypes(node: UINode): string[] {
  const children = "children" in node && Array.isArray(node.children) ? node.children : [];
  return [node.type, ...children.flatMap(nodeTypes)];
}

function build(toolName: CivicToolName, output: unknown) {
  assert.doesNotThrow(() => civicToolOutputSchemas[toolName].parse(output));
  const adaptation = adaptCivicToolOutput(toolName, output);
  assert.equal(adaptation.status, "complete");
  assert.ok(adaptation.data);
  const specification = buildCivicToolUISpecification(adaptation);
  assert.doesNotThrow(() => uiSpecificationSchema.parse(specification));
  return { adaptation, specification, types: nodeTypes(specification.root) };
}

test("F5 valida las cuatro respuestas CCPC actuales sin modificar el backend", () => {
  for (const [toolName, output] of Object.entries(outputs) as Array<[CivicToolName, unknown]>) {
    const result = build(toolName, output);
    assert.ok(result.types.includes("dataQualityBadge"));
    assert.match(JSON.stringify(result.adaptation.data), /CCPC/u);
  }
});

test("F5 compone resumen verificable con evidencia, métricas y composición", () => {
  const result = build("get_participation_summary", outputs.get_participation_summary);
  assert.ok(result.types.includes("evidenceSummary"));
  assert.ok(result.types.includes("metric"));
  assert.ok(result.types.includes("table"));
  assert.match(JSON.stringify(result.specification), /summary-composition/u);
});

test("F5 compone comparación con diferencia en puntos, línea de tiempo y tabla", () => {
  const result = build("compare_elections", outputs.compare_elections);
  assert.ok(result.types.includes("electionDelta"));
  assert.ok(result.types.includes("participationTimeline"));
  assert.ok(result.types.includes("table"));
  assert.match(JSON.stringify(result.specification), /"differenceUnit":"pp"/u);
});

test("F5 compone desglose demográfico y registros de respaldo con campos CCPC", () => {
  const breakdown = build("get_participation_breakdown", outputs.get_participation_breakdown);
  const records = build("get_supporting_records", outputs.get_supporting_records);
  assert.ok(breakdown.types.includes("demographicBreakdown"));
  assert.ok(breakdown.types.includes("table"));
  assert.ok(records.types.includes("table"));
  assert.match(JSON.stringify(records.specification), /ageGroup/u);
  assert.match(JSON.stringify(records.specification), /sectionType/u);
});

test("F5 reconoce y restaura las formas actuales que llegan por streaming", () => {
  for (const [toolName, output] of Object.entries(outputs) as Array<[CivicToolName, unknown]>) {
    assert.equal(identifyCivicTool(output), toolName);
    // The HTTP stream is JSON, so optional `undefined` fields from the service
    // are absent before the payload reaches the frontend registry.
    const normalized = normalizeSharedPercentages(JSON.parse(JSON.stringify(output)) as unknown);
    const patch = dataPatchSchema.parse({ version: "1", baseRevision: 0, revision: 1, op: "add", key: "source_1", value: normalized });
    const fallback = createCivicStreamFallback(patch);
    assert.ok(fallback);
    assert.equal(fallback.adaptation.status, "complete");
    assert.equal(fallback.preserveSpecification, true);
    assert.doesNotThrow(() => uiSpecificationSchema.parse(fallback.specification));
  }
});

test("F5 trata no_data como ausencia, nunca como un valor cero", () => {
  const source = outputs.get_participation_summary as Record<string, unknown>;
  const noData = { ...source, status: "no_data", totals: null, composition: [] };
  const result = build("get_participation_summary", noData);
  const serialized = JSON.stringify(result.specification);
  assert.match(serialized, /Sin datos para estos filtros/u);
  assert.match(serialized, /no significa que la participación sea cero/u);
  assert.doesNotMatch(serialized, /evidenceSummary/u);
});

test("F5 conserva reglas responsive, foco visible, toque y movimiento reducido", () => {
  const css = readFileSync(new URL("../src/features/generative-ui/styles/civic-primitives.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 64rem\)/u);
  assert.match(css, /focus-visible/u);
  assert.match(css, /min-height: 2\.75rem/u);
  assert.match(css, /prefers-reduced-motion: reduce/u);
});

function normalizeSharedPercentages(input: unknown) {
  if (!isRecord(input)) return input;
  const percentageFields = new Set(["participationPct", "nominalParticipationPct", "abstentionPct", "unspecifiedPct", "nominalSharePct"]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (percentageFields.has(key) && typeof child === "number") value[key] = child / 100;
      else visit(child);
    }
  };
  visit(input);
  return input;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
