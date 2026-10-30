import assert from "node:assert/strict";
import test from "node:test";
import { type CivicToolClient } from "../src/agent/mcp-client/civic-mcp-client.js";
import { validateToolOutput } from "../src/agent/mcp-client/civic-tool-output-validator.js";
import { type ModelGateway } from "../src/agent/model/model.js";
import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { createModelUiPlanner } from "../src/agent/planning/ui-planner.js";
import { shapeCivicDataForUi } from "../src/agent/reasoning/civic-data-shaper.js";
import {
  groundCivicAnswer,
  validateCivicReasoning,
} from "../src/agent/reasoning/civic-reasoning-validator.js";
import { type AgentStreamEvent } from "../src/agent/stream/agent-stream.schema.js";
import { CompareElectionsInputSchema, GetParticipationSummaryInputSchema } from "../src/schemas/civic.schema.js";
import { CivicDataService } from "../src/services/civic-data.service.js";
import { type UiDataSource } from "../src/ui/dsl/ui.schema.js";
import { type UiGenerator } from "../src/ui/generation/ui-generator.js";

const service = new CivicDataService({ now: () => new Date("2026-10-15T12:00:00.000Z") });
const query = "¿Cómo cambió la participación de los jóvenes de Aguascalientes entre 2018 y 2024?";
const GROUP = { entities: ["Aguascalientes"], sexes: ["hombre" as const], ageGroups: ["18-19" as const], sectionTypes: ["urbana" as const] };

async function summarySource(): Promise<UiDataSource> {
  return { id: "source-1", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, ...GROUP }) };
}

async function comparisonSource(): Promise<UiDataSource> {
  return { id: "source-1", toolName: "compare_elections", data: await service.compareElections({ years: [2018, 2024], ...GROUP }) };
}

const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

test("acepta una respuesta con cifras de los datos, base y redondeos", async () => {
  const answer = "En 2024 la participación oficial fue de 50 %: votaron 7,288 de 14,585 registros clasificados (lista nominal de 14,908).";
  assert.deepEqual(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] }), []);
});

test("no inventar datos: rechaza cifras que no salen de las tools", async () => {
  const answer = "La participación oficial fue de 49.97 % (7,288 de 14,585) y la de las mujeres fue de 61 %.";
  assert.deepEqual(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })), ["unsupported_number"]);
});

test("no inferir causalidad", async () => {
  const answer = "Votaron 7,288 personas porque hubo más campañas.";
  assert.ok(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })).includes("causal_claim"));
});

test("diferenciar porcentaje y puntos porcentuales", async () => {
  const sources = [await comparisonSource()];
  const wrong = "La participación oficial bajó 3.61 % entre 2018 y 2024.";
  const right = "La participación oficial bajó 3.61 puntos porcentuales entre 2018 y 2024.";
  assert.ok(codes(validateCivicReasoning({ query, answer: wrong, dataSources: sources })).includes("points_as_percentage"));
  assert.ok(!codes(validateCivicReasoning({ query, answer: right, dataSources: sources })).includes("points_as_percentage"));
});

test("no describir datos agregados como personas individuales", async () => {
  const answer = "Los jóvenes eligieron no votar: votaron 7,288.";
  assert.ok(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })).includes("individual_attribution"));
});

test("conservar numerador y denominador junto a la participación", async () => {
  const answer = "La participación oficial fue de 49.97 %.";
  assert.deepEqual(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })), ["missing_numerator_denominator"]);
});

test("ausencia de datos no es cero", async () => {
  const empty: UiDataSource = { id: "source-1", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024, entities: ["Jalisco"] }) };
  assert.deepEqual(codes(validateCivicReasoning({ query, answer: "En Jalisco la participación fue de 0 %.", dataSources: [empty] })), ["no_data_as_zero"]);
  assert.deepEqual(validateCivicReasoning({ query, answer: "No hay datos de Jalisco en 2024 en la muestra.", dataSources: [empty] }), []);
});

test("conservar fuente y advertir diferencias metodológicas: se agregan solas", async () => {
  const grounded = groundCivicAnswer("La participación oficial bajó 3.61 puntos porcentuales.", [await comparisonSource()]);
  assert.match(grounded, /Datos de muestra/u);
  assert.match(grounded, /Fuente: Conteos Censales de Participación Ciudadana/u);
  assert.match(grounded, /no prueba causas/u);
});

test("sin datos (por ejemplo, un saludo) no hay nada que validar", () => {
  assert.deepEqual(validateCivicReasoning({ query: "Hola", answer: "Hola, pregúntame por la participación de 2024.", dataSources: [] }), []);
});

test("el preparador de datos quita repetidos y pone lo nacional al final", async () => {
  const national: UiDataSource = { id: "source-1", toolName: "get_participation_summary", data: await service.getParticipationSummary({ year: 2024 }) };
  const state = await summarySource();
  const shaped = shapeCivicDataForUi([national, { ...state, id: "source-2" }, { ...national, id: "source-3" }, { id: "x", toolName: "get_accounts", data: {} }]);
  assert.deepEqual(shaped.map((source) => source.id), ["source-2", "source-1"]);
});

function createOrchestrator(answers: string[]) {
  const feedbacks: (string | undefined)[] = [];
  const model: ModelGateway = {
    createSession: () => {
      let turn = 0;
      return {
        next: async (_results, _signal, feedback) => {
          turn += 1;
          if (turn === 1) {
            return { text: "", toolCalls: [{ name: "compare_elections", arguments: { years: [2018, 2024], ...GROUP } }] };
          }
          feedbacks.push(feedback);
          return { text: answers[Math.min(turn - 2, answers.length - 1)]!, toolCalls: [] };
        },
      };
    },
  };
  const tools: CivicToolClient = {
    listTools: async () => [
      { name: "compare_elections", description: "Comparar elecciones", inputSchema: { type: "object" } },
      { name: "get_participation_summary", description: "Resumen", inputSchema: { type: "object" } },
    ],
    callTool: async (toolCall) => (toolCall.name === "compare_elections"
      ? validateToolOutput(toolCall.name, await service.compareElections(CompareElectionsInputSchema.parse(toolCall.arguments)))
      : validateToolOutput(toolCall.name, await service.getParticipationSummary(GetParticipationSummaryInputSchema.parse(toolCall.arguments)))),
  };
  const ui: UiGenerator = {
    generate: async () => ({ version: "1.0", root: { id: "respuesta", type: "text", text: "Respuesta", variant: "body" } }),
  };
  const orchestrator = new AgentOrchestrator(createModelUiPlanner("gemini", model, ui), tools, { maxToolCalls: 3, maxReasoningRepairs: 1, currentDate: () => "2026-10-15" });
  return { orchestrator, feedbacks };
}

async function collect(orchestrator: AgentOrchestrator): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const event of orchestrator.stream(query)) events.push(event);
  return events;
}

const WRONG = "La participación oficial bajó 3.61 % porque hubo menos interés.";
const RIGHT = "La participación oficial pasó de 53.58 % a 49.97 %: bajó 3.61 puntos porcentuales (7,727 de 14,421 y 7,288 de 14,585 registros clasificados).";

test("una respuesta estadísticamente incorrecta se repara antes de llegar al frontend", async () => {
  const { orchestrator, feedbacks } = createOrchestrator([WRONG, RIGHT]);
  const events = await collect(orchestrator);
  const completed = events.find((event) => event.type === "completed");

  assert.ok(completed && completed.type === "completed");
  assert.match(completed.response.answer, /3\.61 puntos porcentuales/u);
  assert.match(completed.response.answer, /Fuente:/u);
  assert.match(completed.response.answer, /no prueba causas/u);
  assert.doesNotMatch(completed.response.answer, /porque/u);
  assert.match(feedbacks[1] ?? "", /puntos porcentuales/u);
  assert.match(feedbacks[1] ?? "", /causas/u);
});

test("si no se puede reparar, se rechaza y el frontend recibe un error, no la respuesta", async () => {
  const { orchestrator } = createOrchestrator([WRONG, WRONG]);
  const events = await collect(orchestrator);

  assert.equal(events.some((event) => event.type === "completed"), false);
  const error = events.find((event) => event.type === "error");
  assert.ok(error && error.type === "error");
  assert.equal(error.recoverable, true);
  assert.equal(events.some((event) => event.type === "ui-snapshot"), false);
});
