import assert from "node:assert/strict";
import test from "node:test";
import { CIVIC_TOOL_NAMES } from "../src/agent/civic-tool-policy.js";
import { FinancialMcpClient } from "../src/agent/mcp-client/financial-mcp-client.js";
import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { rulesQueryInterpreter } from "../src/agent/planning/civic-query-interpreter.js";
import { LocalModelQueryInterpreter } from "../src/agent/planning/local-model-interpreter.js";
import { createUiPlanner, readPlannerStatus } from "../src/agent/planning/planner-factory.js";
import { PlannerConfigurationError } from "../src/agent/planning/planner-result.js";
import { type UiPlanner } from "../src/agent/planning/ui-planner.js";
import { type AgentStreamEvent } from "../src/agent/stream/agent-stream.schema.js";
import { createSystemStatus, plannerHeaderValue } from "../src/http/system-status.js";
import { crearServidor } from "../src/server.js";

const ACTOR_ID = "10000000-0000-4000-8000-000000000001";

async function run(planner: UiPlanner, query: string): Promise<AgentStreamEvent[]> {
  const tools = await FinancialMcpClient.connect(crearServidor({ client: {} as never, user: { id: ACTOR_ID } }), 5_000);
  const orchestrator = new AgentOrchestrator(planner, tools, {
    maxToolCalls: 4,
    maxReasoningRepairs: 1,
    currentDate: () => "2026-10-21",
    permittedToolNames: [...CIVIC_TOOL_NAMES],
  });
  const events: AgentStreamEvent[] = [];
  try {
    for await (const event of orchestrator.stream(query)) events.push(event);
  } finally {
    await tools.close();
  }
  return events;
}

function completed(events: readonly AgentStreamEvent[]) {
  const last = events.at(-1);
  assert.equal(last?.type, "completed", JSON.stringify(last));
  return (last as Extract<AgentStreamEvent, { type: "completed" }>).response;
}

test("UI_PLANNER_MODE=rules responde sin Gemini y consulta la tool de resumen", async () => {
  const planner = createUiPlanner({ mode: "rules" });
  assert.equal(planner.mode, "rules");
  const response = completed(await run(planner, "¿Cuál fue la participación en Aguascalientes en 2024?"));
  assert.deepEqual(response.toolsUsed, ["get_participation_summary"]);
  assert.match(response.answer, /Aguascalientes/u);
  assert.match(response.answer, /participación oficial fue de \d+(?:\.\d+)? %/u);
  assert.match(response.answer, /registros clasificados/u);
  assert.match(response.answer, /Fuente:/u);
});

test("el planificador por reglas elige la tool según la intención", async () => {
  const planner = createUiPlanner({ mode: "rules" });
  const cases: Array<[string, string]> = [
    ["Compara la participación de Aguascalientes entre 2018 y 2024", "compare_elections"],
    ["¿Cómo votaron mujeres y hombres en Aguascalientes en 2024?", "get_participation_breakdown"],
    ["Muéstrame los registros de Aguascalientes en 2024", "get_supporting_records"],
  ];
  for (const [query, tool] of cases) {
    const response = completed(await run(planner, query));
    assert.deepEqual(response.toolsUsed, [tool], query);
  }
});

test("las preguntas de metodología y los años sin conteo no llaman herramientas", async () => {
  const planner = createUiPlanner({ mode: "rules" });
  const methodology = completed(await run(planner, "¿Cómo se calcula la participación ciudadana?"));
  assert.deepEqual(methodology.toolsUsed, []);
  assert.match(methodology.answer, /registros clasificados/u);

  const clarification = completed(await run(planner, "¿Cuál fue la participación en Jalisco en 2019?"));
  assert.deepEqual(clarification.toolsUsed, []);
  assert.match(clarification.answer, /2009, 2012, 2015, 2018, 2021, 2024/u);
  assert.match(clarification.answer, /\?$/u);
});

test("UI_PLANNER_MODE=gemini sin clave no impide arrancar, pero marca el agente como no disponible", () => {
  assert.throws(() => createUiPlanner({ mode: "gemini" }), PlannerConfigurationError);
  const planner = readPlannerStatus({ mode: "gemini" });
  assert.deepEqual(planner, { mode: "gemini", ready: false });
  const status = createSystemStatus({ isAgentReady: false, isMcpReady: true, planner });
  assert.equal(status.agent, "unavailable");
  assert.equal(plannerHeaderValue({ isAgentReady: false, isMcpReady: true, planner }), "gemini; unavailable");
  assert.equal(plannerHeaderValue({ isAgentReady: true, isMcpReady: true, planner: readPlannerStatus({ mode: "rules" }) }), "rules; ready");
});

test("UI_PLANNER_MODE=local-model sin configuración usa reglas", async () => {
  const planner = createUiPlanner({ mode: "local-model" });
  assert.equal(planner.mode, "local-model");
  assert.deepEqual(readPlannerStatus({ mode: "local-model" }), { mode: "local-model", ready: true });
  const response = completed(await run(planner, "Participación en Tabasco 2024"));
  assert.deepEqual(response.toolsUsed, ["get_participation_summary"]);
});

test("el modelo local usa su plan válido y cae a reglas si falla o inventa", async () => {
  const config = { url: "http://127.0.0.1:11434", model: "modelo-prueba", timeoutMs: 200 };
  const reply = (content: string): typeof fetch => async () => new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), { status: 200 });
  const valid = {
    analysis: "summary", indicator: "participation", years: [2018], entityCodes: ["27"],
    sexes: [], ageGroups: [], sectionTypes: [], presentation: [],
  };
  const query = "Participación en Veracruz 2024";

  const accepted = new LocalModelQueryInterpreter(config, rulesQueryInterpreter, reply(JSON.stringify(valid)));
  assert.deepEqual(await accepted.interpret(query), valid);

  const invented = new LocalModelQueryInterpreter(config, rulesQueryInterpreter, reply(JSON.stringify({ ...valid, years: [2019] })));
  const fallback = await rulesQueryInterpreter.interpret(query);
  assert.deepEqual(await invented.interpret(query), fallback);

  const offline = new LocalModelQueryInterpreter(config, rulesQueryInterpreter, async () => {
    throw new TypeError("fetch failed");
  });
  assert.deepEqual(await offline.interpret(query), fallback);

  const slow = new LocalModelQueryInterpreter(config, rulesQueryInterpreter, (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  }));
  assert.deepEqual(await slow.interpret(query), fallback);
});
