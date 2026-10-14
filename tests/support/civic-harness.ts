import {
  textAgentRequestSchema,
  textAgentStreamEventSchema,
  type TextAgentRequest,
  type TextAgentStreamEvent,
  type UIEvent,
} from "@banorte/contracts";
import { CIVIC_TOOL_NAMES } from "../../src/agent/civic-tool-policy.js";
import { type FinancialToolClient } from "../../src/agent/mcp-client/financial-mcp-client.js";
import { validateToolOutput } from "../../src/agent/mcp-client/tool-output-validator.js";
import { type ModelGateway } from "../../src/agent/model/model.js";
import { AgentOrchestrator } from "../../src/agent/orchestrator.js";
import { type AgentToolCall, type AgentToolResult } from "../../src/agent/schemas/agent.schema.js";
import {
  type BeginSessionInput,
  type BeginSessionResult,
  type CompleteSessionInput,
  type SessionStore,
} from "../../src/application/ports/session-store.js";
import { AgentSessionStore } from "../../src/integration/agent-session-store.js";
import { createTextAgentService, type TextAgentService } from "../../src/integration/text-agent-service.js";
import {
  GetParticipationSummaryInputSchema,
  type GetParticipationSummaryOutput,
} from "../../src/schemas/civic.schema.js";
import { CivicDataService } from "../../src/services/civic-data.service.js";
import { UiDocumentSchema, type UiDocument } from "../../src/ui/dsl/ui.schema.js";
import { type UiGenerator } from "../../src/ui/generation/ui-generator.js";

export const ACTOR_ID = "10000000-0000-4000-8000-000000000001";
export const ENTITY_FILTER_ID = "entity-select";
export const ENTITY_FILTER_EVENT = "filters.value.changed";
const QUERIED_AT = "2026-10-08T12:00:00.000Z";
export const SUMMARY_TOOL = "get_participation_summary";
const ENTITIES = [
  { value: "nacional", label: "Nacional" },
  { value: "jalisco", label: "Jalisco" },
  { value: "nuevo-leon", label: "Nuevo León" },
  { value: "oaxaca", label: "Oaxaca" },
] as const;

export interface RecordedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Arma el servicio de texto completo (sesiones, streaming, patches) con un
 * modelo falso y la tool cívica de ejemplo, para probar el motor sin Gemini.
 */
export class CivicHarness {
  readonly sessions = new RecordingSessionStore();
  readonly toolCalls: RecordedToolCall[] = [];
  readonly modelQueries: string[] = [];
  readonly service: TextAgentService;

  constructor(options: { uiGenerationDelayMs?: number } = {}) {
    const uiGenerator: UiGenerator = options.uiGenerationDelayMs
      ? {
        generate: async (input, signal) => {
          await new Promise((resolve) => setTimeout(resolve, options.uiGenerationDelayMs));
          return civicUiGenerator.generate(input, signal);
        },
      }
      : civicUiGenerator;
    this.service = createTextAgentService({
      sessionStore: this.sessions,
      sessionFactory: async () => ({ client: {} as never, user: { id: ACTOR_ID } }),
      createRuntime: async () => {
        const orchestrator = new AgentOrchestrator(
          createCivicModel(this.modelQueries),
          new CivicToolClient(this.toolCalls),
          uiGenerator,
          {
            maxToolCalls: 4,
            maxReasoningRepairs: 0,
            currentDate: () => "2026-10-08",
            userId: ACTOR_ID,
            permittedToolNames: [...CIVIC_TOOL_NAMES],
          },
        );
        return { orchestrator, close: async () => undefined };
      },
    });
  }

  async run(request: unknown): Promise<TextAgentStreamEvent[]> {
    const parsed = textAgentRequestSchema.parse(request);
    const events: TextAgentStreamEvent[] = [];
    for await (const event of this.service(parsed)) {
      events.push(textAgentStreamEventSchema.parse(event));
    }
    return events;
  }
}

export class RecordingSessionStore implements SessionStore {
  private readonly delegate = new AgentSessionStore(() => Date.parse(QUERIED_AT));
  readonly completions: CompleteSessionInput[] = [];

  begin(input: BeginSessionInput): Promise<BeginSessionResult> {
    return this.delegate.begin(input);
  }

  async complete(input: CompleteSessionInput): Promise<void> {
    await this.delegate.complete(input);
    this.completions.push(structuredClone(input));
  }

  release(actorId: string, sessionId: string, correlationId: string): Promise<void> {
    return this.delegate.release(actorId, sessionId, correlationId);
  }

  latest(): CompleteSessionInput {
    const completion = this.completions.at(-1);
    if (!completion) throw new Error("La sesión no tiene una finalización registrada");
    return completion;
  }
}

class CivicToolClient implements FinancialToolClient {
  private readonly service = new CivicDataService({ now: () => new Date(QUERIED_AT) });

  constructor(private readonly calls: RecordedToolCall[]) {}

  async listTools() {
    return CIVIC_TOOL_NAMES.map((name) => ({
      name,
      description: `Herramienta cívica ${name}`,
      inputSchema: { type: "object" },
    }));
  }

  async callTool(call: AgentToolCall): Promise<unknown> {
    if (call.name !== SUMMARY_TOOL) throw new Error(`Herramienta inesperada: ${call.name}`);
    this.calls.push({ name: call.name, arguments: structuredClone(call.arguments) });
    const input = GetParticipationSummaryInputSchema.parse(call.arguments);
    return validateToolOutput(call.name, await this.service.getParticipationSummary(input));
  }
}

function createCivicModel(recordedQueries: string[]): ModelGateway {
  return {
    createSession: ({ query }) => {
      recordedQueries.push(query);
      const calls = callsForQuery(query);
      let requestedTools = false;
      return {
        next: async (results: AgentToolResult[] = []) => {
          if (!requestedTools) {
            requestedTools = true;
            return { text: "", toolCalls: calls };
          }
          return { text: answerFor(results), toolCalls: [] };
        },
      };
    },
  };
}

function callsForQuery(query: string): AgentToolCall[] {
  const selected = /"intent":"filters\.value\.changed","value":"([^"]+)"/u.exec(query)?.[1];
  const entity = ENTITIES.find((candidate) => candidate.value === selected)?.label
    ?? findEntity(latestRequest(query))
    ?? "Nacional";
  const call = (name: string): AgentToolCall => ({
    name: SUMMARY_TOOL,
    arguments: { year: 2024, office: "presidencia", entity: name },
  });
  return entity === "Nacional" ? [call("Nacional")] : [call(entity), call("Nacional")];
}

function answerFor(results: AgentToolResult[]): string {
  const output = results[0]?.output as GetParticipationSummaryOutput | undefined;
  if (!output) throw new Error(`No se recibió el resultado de ${SUMMARY_TOOL}`);
  const [top] = [...output.results].sort((left, right) => right.votes - left.votes);
  return `En ${output.entity}, ${top!.party} obtuvo ${top!.percentage} % de los votos y la participación fue de ${output.participation.turnoutPercentage} % (datos de ejemplo).`;
}

const civicUiGenerator: UiGenerator = {
  generate: async (input) => {
    const source = input.dataSources.find((candidate) => candidate.toolName === SUMMARY_TOOL);
    if (!source) throw new Error("El escenario no produjo datos para la interfaz");
    const chart = {
      id: "results-chart",
      type: "chart" as const,
      title: "Votos por partido",
      chartType: "bar" as const,
      data: { sourceId: source.id, path: "results" },
      categoryKey: "party",
      series: [{ key: "votes", label: "Votos" }],
    };
    // Una petición explícita de gráfica produce una vista mínima; el resto
    // usa la vista completa con filtro de entidad, participación y tabla.
    const document: UiDocument = /gr[aá]fica/iu.test(latestRequest(input.query))
      ? { version: "1.0", root: chart }
      : {
        version: "1.0",
        root: {
          id: "election-results",
          type: "card",
          title: "Resultados electorales",
          children: [
            {
              id: "entity-filter",
              type: "filters",
              fields: [{
                id: ENTITY_FILTER_ID,
                type: "select",
                label: "Entidad",
                options: ENTITIES.map((entity) => ({ label: entity.label, value: entity.value })),
              }],
            },
            {
              id: "turnout",
              type: "metric",
              label: "Participación",
              value: { sourceId: source.id, path: "participation.turnoutPercentage" },
              format: "percentage",
            },
            chart,
            {
              id: "results-table",
              type: "table",
              title: "Detalle por partido",
              data: { sourceId: source.id, path: "results" },
              columns: [
                { key: "party", label: "Partido" },
                { key: "votes", label: "Votos" },
                { key: "percentage", label: "Porcentaje" },
              ],
              maxRows: 10,
            },
          ],
        },
      };
    return UiDocumentSchema.parse(document);
  },
};

export function queryRequest(
  sessionId: string,
  correlationId: string,
  query: string,
  sessionState?: CompleteSessionInput,
): TextAgentRequest {
  return textAgentRequestSchema.parse({
    version: "1",
    sessionId,
    correlationId,
    provider: "google",
    responseMode: "complete-ui",
    query,
    ...(sessionState ? { sessionState: referenceFrom(sessionState) } : {}),
  });
}

export function interactionRequest(
  sessionId: string,
  correlationId: string,
  state: CompleteSessionInput,
  event: UIEvent["event"],
  revisionOffset = 0,
): TextAgentRequest {
  return textAgentRequestSchema.parse({
    version: "1",
    sessionId,
    correlationId,
    provider: "google",
    responseMode: "complete-ui",
    uiEvent: {
      version: "1",
      sessionId,
      correlationId,
      interfaceRevision: state.interfaceRevision + revisionOffset,
      dataRevision: state.dataRevision,
      dataKeys: state.dataKeys,
      event,
    },
  });
}

export function referenceFrom(state: CompleteSessionInput) {
  return {
    interfaceRevision: state.interfaceRevision,
    dataRevision: state.dataRevision,
    dataKeys: [...state.dataKeys],
  };
}

function latestRequest(query: string): string {
  return query.split(/nueva solicitud del usuario:/iu).at(-1) ?? query;
}

function findEntity(text: string): string | undefined {
  const normalized = normalize(text);
  return ENTITIES.find((entity) => entity.value !== "nacional" && normalized.includes(normalize(entity.label)))?.label;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
