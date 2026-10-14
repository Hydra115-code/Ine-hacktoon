import assert from "node:assert/strict";
import test from "node:test";
import { type FinancialToolClient } from "../src/agent/mcp-client/financial-mcp-client.js";
import { validateToolOutput } from "../src/agent/mcp-client/tool-output-validator.js";
import { type ModelGateway } from "../src/agent/model/model.js";
import { AgentOrchestrator } from "../src/agent/orchestrator.js";
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

const service = new CivicDataService({ now: () => new Date("2026-10-08T12:00:00.000Z") });
const query = "¿Cómo cambió la participación nacional entre 2018 y 2024?";

async function summarySource(): Promise<UiDataSource> {
  const data = await service.getParticipationSummary({ year: 2024, office: "presidencia", entity: "Nacional" });
  return { id: "source-1", toolName: "get_participation_summary", data };
}

async function comparisonSource(): Promise<UiDataSource> {
  const data = await service.compareElections({ office: "presidencia", entity: "Nacional", baseYear: 2018, compareYear: 2024 });
  return { id: "source-1", toolName: "compare_elections", data };
}

const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

// ---------- Reglas una por una ----------

test("acepta una respuesta con cifras de los datos, base y redondeos", async () => {
  const answer = "En 2024 la participación nacional fue de 61.2 %: 60 millones de votos de una lista nominal de 98,000,000. Partido A obtuvo 50 % de los votos.";
  assert.deepEqual(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] }), []);
});

test("no inventar datos: rechaza cifras que no salen de las tools", async () => {
  const answer = "La participación fue de 61.22 % (60 millones de votos de una lista nominal de 98 millones) y Partido A obtuvo 47 % de los votos.";
  assert.deepEqual(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })), ["unsupported_number"]);
});

test("no inferir causalidad", async () => {
  const answer = "Partido A obtuvo 50 % de los votos porque hubo más campañas.";
  assert.ok(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })).includes("causal_claim"));
});

test("diferenciar porcentaje y puntos porcentuales", async () => {
  const sources = [await comparisonSource()];
  const wrong = "La participación bajó 1.7 % entre 2018 y 2024; la lista nominal cambió, así que compara porcentajes.";
  const right = "La participación bajó 1.7 puntos porcentuales entre 2018 y 2024; la lista nominal cambió, así que compara porcentajes.";
  assert.ok(codes(validateCivicReasoning({ query, answer: wrong, dataSources: sources })).includes("points_as_percentage"));
  assert.ok(!codes(validateCivicReasoning({ query, answer: right, dataSources: sources })).includes("points_as_percentage"));
});

test("no describir datos agregados como personas individuales", async () => {
  const answer = "Los mexicanos prefieren a Partido A, que tuvo 50 % de los votos.";
  assert.ok(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })).includes("individual_attribution"));
});

test("conservar numerador y denominador junto a la participación", async () => {
  const answer = "La participación nacional fue de 61.22 %.";
  assert.deepEqual(codes(validateCivicReasoning({ query, answer, dataSources: [await summarySource()] })), ["missing_numerator_denominator"]);
});

test("advertir diferencias metodológicas al comparar procesos", async () => {
  const answer = "La participación pasó de 62.92 % a 61.22 % y bajó 1.7 puntos porcentuales (56 y 60 millones de votos).";
  assert.ok(codes(validateCivicReasoning({ query, answer, dataSources: [await comparisonSource()] })).includes("missing_methodology_warning"));
});

test("conservar fuente: agrega la fuente y el aviso de datos de ejemplo", async () => {
  const grounded = groundCivicAnswer("Partido A obtuvo 50 % de los votos.", [await summarySource()]);
  assert.match(grounded, /Datos de ejemplo, no oficiales/u);
  assert.match(grounded, /Fuente: Datos de ejemplo \(no oficiales\)/u);
});

test("sin datos (por ejemplo, un saludo) no hay nada que validar", () => {
  assert.deepEqual(validateCivicReasoning({ query: "Hola", answer: "Hola, pregúntame por la participación de 2024.", dataSources: [] }), []);
});

test("el preparador de datos quita repetidos y pone lo nacional al final", async () => {
  const national = await summarySource();
  const state: UiDataSource = {
    id: "source-2",
    toolName: "get_participation_summary",
    data: await service.getParticipationSummary({ year: 2024, office: "presidencia", entity: "Jalisco" }),
  };
  const shaped = shapeCivicDataForUi([national, state, { ...national, id: "source-3" }, { id: "x", toolName: "get_accounts", data: {} }]);
  assert.deepEqual(shaped.map((source) => source.id), ["source-2", "source-1"]);
});

// ---------- DoD de BACK-03: rechazar o reparar antes del frontend ----------

function createOrchestrator(answers: string[], maxReasoningRepairs = 1) {
  const feedbacks: (string | undefined)[] = [];
  const model: ModelGateway = {
    createSession: () => {
      let turn = 0;
      return {
        next: async (_results, _signal, feedback) => {
          turn += 1;
          if (turn === 1) {
            return {
              text: "",
              toolCalls: [{
                name: "compare_elections",
                arguments: { office: "presidencia", entity: "Nacional", baseYear: 2018, compareYear: 2024 },
              }],
            };
          }
          feedbacks.push(feedback);
          return { text: answers[Math.min(turn - 2, answers.length - 1)]!, toolCalls: [] };
        },
      };
    },
  };
  const tools: FinancialToolClient = {
    listTools: async () => [
      { name: "compare_elections", description: "Comparar procesos", inputSchema: { type: "object" } },
      { name: "get_participation_summary", description: "Resumen", inputSchema: { type: "object" } },
    ],
    callTool: async (call) => {
      if (call.name === "compare_elections") {
        return validateToolOutput(call.name, await service.compareElections(CompareElectionsInputSchema.parse(call.arguments)));
      }
      return validateToolOutput(call.name, await service.getParticipationSummary(GetParticipationSummaryInputSchema.parse(call.arguments)));
    },
  };
  const ui: UiGenerator = {
    generate: async () => ({
      version: "1.0",
      root: { id: "respuesta", type: "text", text: "Respuesta", variant: "body" },
    }),
  };
  const orchestrator = new AgentOrchestrator(model, tools, ui, {
    maxToolCalls: 3,
    maxReasoningRepairs,
    currentDate: () => "2026-10-08",
  });
  return { orchestrator, feedbacks };
}

async function collect(orchestrator: AgentOrchestrator): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const event of orchestrator.stream(query)) events.push(event);
  return events;
}

const WRONG = "La participación bajó 1.7 % porque hubo menos interés.";
const RIGHT = "La participación pasó de 62.92 % a 61.22 %: bajó 1.7 puntos porcentuales (56 y 60 millones de votos). La lista nominal cambió, así que conviene comparar porcentajes, no votos.";

test("una respuesta estadísticamente incorrecta se repara antes de llegar al frontend", async () => {
  const { orchestrator, feedbacks } = createOrchestrator([WRONG, RIGHT]);
  const events = await collect(orchestrator);
  const completed = events.find((event) => event.type === "completed");

  assert.ok(completed && completed.type === "completed");
  assert.match(completed.response.answer, /1\.7 puntos porcentuales/u);
  assert.match(completed.response.answer, /Fuente:/u);
  assert.doesNotMatch(completed.response.answer, /porque/u);
  // El modelo recibió las instrucciones de reparación.
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
