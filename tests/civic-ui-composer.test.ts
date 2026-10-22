import assert from "node:assert/strict";
import test from "node:test";
import { dataRegistryContractSchema, uiSpecificationSchema } from "@banorte/contracts";
import { CIVIC_TOOL_NAMES } from "../src/agent/civic-tool-policy.js";
import { CivicMcpClient } from "../src/agent/mcp-client/civic-mcp-client.js";
import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { createUiPlanner } from "../src/agent/planning/planner-factory.js";
import { type AgentResponse } from "../src/agent/schemas/agent.schema.js";
import { adaptUiPayload } from "../src/integration/shared-contract-adapter.js";
import { crearServidor } from "../src/server.js";
import { UiDocumentSchema, type UiNode } from "../src/ui/dsl/ui.schema.js";
import { CIVIC_COMPOSITIONS, composeCivicUi, compositionOf } from "../src/ui/generation/civic-ui-composer.js";

const planner = createUiPlanner({ mode: "rules" });

async function ask(query: string): Promise<AgentResponse> {
  const tools = await CivicMcpClient.connect(crearServidor({ client: {} as never, user: { id: "10000000-0000-4000-8000-000000000001" } }), 5_000);
  const orchestrator = new AgentOrchestrator(planner, tools, {
    maxToolCalls: 4,
    maxReasoningRepairs: 1,
    currentDate: () => "2026-10-21",
    permittedToolNames: [...CIVIC_TOOL_NAMES],
  });
  try {
    for await (const event of orchestrator.stream(query)) {
      if (event.type === "completed") return event.response;
      if (event.type === "error") throw new Error(`${query}: ${event.message}`);
    }
  } finally {
    await tools.close();
  }
  throw new Error(`${query}: sin respuesta`);
}

function nodesOf(node: UiNode): UiNode[] {
  const children = node.type === "tabs" ? node.tabs.flatMap((tab) => tab.children) : "children" in node ? node.children : [];
  return [node, ...children.flatMap(nodesOf)];
}

function types(response: AgentResponse): string[] {
  return nodesOf(response.ui.root).map((node) => node.type === "chart" ? `chart:${node.chartType}` : node.type);
}

function assertContractValid(response: AgentResponse): void {
  UiDocumentSchema.parse(response.ui);
  const payload = adaptUiPayload(response.ui, response.dataSources, 1);
  uiSpecificationSchema.parse(payload.specification);
  dataRegistryContractSchema.parse(payload.dataRegistry);
}

const SCENARIOS: Array<{ query: string; composition: keyof typeof CIVIC_COMPOSITIONS; includes: string[]; excludes?: string[] }> = [
  { query: "¿Qué estado tuvo más participación en 2024?", composition: "ranking", includes: ["chart:bar", "table"] },
  { query: "¿Cómo ha evolucionado la participación en Aguascalientes?", composition: "timeline", includes: ["chart:line", "table"] },
  { query: "Participación por edad y sexo en Aguascalientes 2024", composition: "age-sex", includes: ["chart:bar", "table"] },
  { query: "Compara la participación de Aguascalientes entre 2018 y 2024", composition: "two-elections", includes: ["chart:bar", "metric", "table"] },
  { query: "¿Cómo se calcula la participación?", composition: "methodology", includes: ["text"], excludes: ["chart:bar", "table"] },
  { query: "¿Cuál fue la participación en Jalisco en 2024?", composition: "insufficient-data", includes: ["alert", "text"], excludes: ["chart:bar", "table", "metric"] },
  { query: "¿Cuál fue la participación en Aguascalientes en 2024?", composition: "summary", includes: ["metric", "table"] },
  { query: "Participación por sexo en Aguascalientes 2024", composition: "group-comparison", includes: ["chart:bar", "table"] },
  { query: "Muéstrame los registros de Aguascalientes en 2024", composition: "evidence", includes: ["table"], excludes: ["chart:bar"] },
];

test("cada intención produce su propia composición válida para el contrato", async () => {
  const roots = new Set<string>();
  for (const scenario of SCENARIOS) {
    const response = await ask(scenario.query);
    assert.equal(compositionOf(response.ui), scenario.composition, scenario.query);
    const shown = types(response);
    for (const type of scenario.includes) assert.ok(shown.includes(type), `${scenario.query} debe incluir ${type}`);
    for (const type of scenario.excludes ?? []) assert.ok(!shown.includes(type), `${scenario.query} no debe incluir ${type}`);
    assertContractValid(response);
    roots.add(response.ui.root.id);
  }
  assert.ok(roots.size >= 6, `se esperaban al menos 6 composiciones distintas y hubo ${roots.size}`);
});

test("el ranking por entidad se ordena de mayor a menor y trae tabla alternativa", async () => {
  const response = await ask("¿Qué estado tuvo más participación en 2024?");
  const chart = nodesOf(response.ui.root).find((node) => node.type === "chart");
  assert.ok(chart?.type === "chart");
  assert.equal(chart.sort, "descending");
  const payload = adaptUiPayload(response.ui, response.dataSources, 1);
  const visualization = JSON.stringify(payload.specification);
  assert.match(visualization, /"sort":\{"by":"y","direction":"descending"\}/u);
});

test("respeta las preferencias del usuario", async () => {
  const onlyTable = await ask("Participación por estado en 2024, sólo la tabla");
  assert.ok(!types(onlyTable).some((type) => type.startsWith("chart")));
  assert.ok(types(onlyTable).includes("table"));

  const noTable = await ask("Participación por estado en 2024 sin tabla");
  assert.ok(!types(noTable).includes("table"));
  assert.ok(types(noTable).includes("chart:bar"));

  const map = await ask("Muéstrame un mapa de participación por estado en 2024");
  assert.equal(compositionOf(map.ui), "ranking");
  assert.ok(nodesOf(map.ui.root).some((node) => node.id === "mapa-no-disponible"));
  assertContractValid(map);
});

test("no pide un componente si los datos no traen los campos que necesita", () => {
  const source = {
    id: "source-1",
    toolName: "get_participation_breakdown",
    data: {
      status: "ok",
      level: "nacional",
      scope: "Nacional",
      year: 2024,
      dimension: "entidad",
      filters: { entities: [] },
      source: { name: "CCPC", urls: [] },
      warnings: [],
      groups: [{ group: "Aguascalientes", value: "01", voted: 10, classified: 20, participationPct: null }],
    },
  };
  const document = composeCivicUi({
    query: "¿Qué estado tuvo más participación en 2024?",
    answer: "No hay datos suficientes de participación para comparar entidades en 2024.",
    dataSources: [source],
  });
  assert.ok(document);
  assert.equal(compositionOf(document), "insufficient-data");
  assert.ok(!nodesOf(document.root).some((node) => node.type === "chart" || node.type === "table"));
});
