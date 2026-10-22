import { randomUUID } from "node:crypto";
import { z } from "zod";
import { logger } from "../config/logger.js";
import {
  FinancialToolError,
  FinancialToolTransportError,
  type FinancialToolClient,
} from "./mcp-client/financial-mcp-client.js";
import {
  PlannerConfigurationError,
  PlannerProviderError,
  PlannerResultSchema,
  UiCompositionError,
  UiSemanticCompositionError,
} from "./planning/planner-result.js";
import { type UiPlanner } from "./planning/ui-planner.js";
import { createCivicSystemPrompt } from "./prompts/civic-system-prompt.js";
import {
  CivicReasoningError,
  createCivicReasoningRepairPrompt,
  groundCivicAnswer,
  validateCivicReasoning,
} from "./reasoning/civic-reasoning-validator.js";
import { shapeCivicDataForUi } from "./reasoning/civic-data-shaper.js";
import {
  AgentQuerySchema,
  AgentResponseSchema,
  AgentToolResultSchema,
  type AgentResponse,
  type AgentToolResult,
  type AgentToolDefinition,
  type AgentToolCall,
} from "./schemas/agent.schema.js";
import {
  isAllowedTool,
  selectAllowedTools,
  toolCallFingerprint,
} from "./civic-tool-policy.js";
import {
  type UiDataSource,
  type UiDocument,
  type UiNode,
} from "../ui/dsl/ui.schema.js";
import { type AgentStreamBuffer } from "./stream/agent-stream-buffer.js";
import {
  AgentStreamEventSchema,
  type AgentStreamEvent,
} from "./stream/agent-stream.schema.js";
import {
  createTraceContext,
  runWithTraceContext,
  telemetry,
  type TraceContext,
} from "../observability/telemetry.js";
import {
  classifyCivicQuery,
  createCivicScopeResponse,
  isCivicResponseSafe,
  type CivicScopeBlockReason,
} from "./security/civic-scope-policy.js";
import type { FinancialExperienceScope } from "./security/financial-scope-policy.js";

interface AgentOrchestratorConfig {
  maxToolCalls: number;
  maxToolRetries?: number;
  retryDelayMs?: number;
  currentDate?: () => string;
  delay?: (milliseconds: number) => Promise<void>;
  userId?: string;
  maxReasoningRepairs?: number;
  permittedToolNames?: readonly string[];
  experienceScope?: FinancialExperienceScope;
}

export interface AgentStreamOptions {
  signal?: AbortSignal;
  streamId?: string;
  replayBuffer?: AgentStreamBuffer;
}

type AgentStreamEventPayload = AgentStreamEvent extends infer TEvent
  ? TEvent extends AgentStreamEvent
    ? Omit<TEvent, "streamId" | "sequence">
    : never
  : never;

export class AgentOrchestrator {
  private readonly currentDate: () => string;
  private readonly delay: (milliseconds: number) => Promise<void>;
  private toolDefinitions: AgentToolDefinition[] | undefined;

  constructor(
    private readonly planner: UiPlanner,
    private readonly tools: FinancialToolClient,
    private readonly config: AgentOrchestratorConfig,
  ) {
    this.currentDate = config.currentDate ?? (() => new Date().toISOString().slice(0, 10));
    this.delay = config.delay ?? wait;
  }

  async answer(rawQuery: string, options: AgentStreamOptions = {}): Promise<AgentResponse> {
    for await (const event of this.stream(rawQuery, options)) {
      if (event.type === "completed") return event.response;
      if (event.type === "error") throw new AgentExecutionError(event.message);
      if (event.type === "cancelled") {
        throw new AgentExecutionError("La ejecución del agente fue cancelada");
      }
    }
    throw new AgentExecutionError("El stream finalizó sin una respuesta");
  }

  async *stream(
    rawQuery: string,
    options: AgentStreamOptions = {},
  ): AsyncGenerator<AgentStreamEvent> {
    const streamId = options.streamId ?? randomUUID();
    const traceContext = createTraceContext(streamId, this.config.userId);
    const requestSpan = telemetry.startSpan(
      { component: "agent", operation: "civic-request" },
      traceContext,
    );
    let sequence = 0;
    const publish = (payload: AgentStreamEventPayload): AgentStreamEvent => {
      const event = AgentStreamEventSchema.parse({
        ...payload,
        streamId,
        sequence: sequence += 1,
      });
      options.replayBuffer?.append(event);
      return event;
    };
    const toolsUsed: string[] = [];
    const dataSources: UiDataSource[] = [];
    let attemptedToolCalls = 0;
    let reasoningRepairs = 0;
    let reasoningFeedback: string | undefined;

    try {
      yield publish({ type: "stream-started" });
      const query = AgentQuerySchema.parse(rawQuery);
      throwIfCancelled(options.signal);
      yield publish({
        type: "status",
        stage: "planning",
        message: "Analizando la consulta",
      });
      const scopeDecision = classifyCivicQuery(query);
      if (!scopeDecision.allowed) {
        logger.warn("Agente: consulta bloqueada por política de ámbito", {
          reason: scopeDecision.reason,
        });
        const response = createScopeAgentResponse(scopeDecision.reason);
        yield publish({
          type: "status",
          stage: "rendering-ui",
          message: "Aplicando la política de seguridad",
        });
        yield publish({ type: "ui-snapshot", ui: response.ui, dataSources: [] });
        requestSpan.complete({ toolCallCount: 0 });
        yield publish({ type: "completed", response });
        return;
      }
      const definitions = await this.getToolDefinitions(traceContext, options.signal);
      const knownTools = new Set(definitions.map((tool) => tool.name));
      const session = this.planner.createSession({
        query,
        tools: definitions,
        systemInstruction: createCivicSystemPrompt(this.currentDate()),
      });
      const executedCalls = new Set<string>();
      let pendingResults: AgentToolResult[] = [];

      while (true) {
        throwIfCancelled(options.signal);
        const planned = PlannerResultSchema.safeParse(await runWithTraceContext(traceContext, () => telemetry.observe(
          { component: "agent", operation: "model-decision" },
          () => session.next(pendingResults, options.signal, reasoningFeedback),
          (result) => ({ toolCallCount: result.kind === "tools" ? result.toolCalls.length : 0 }),
        )));
        if (!planned.success) throw new PlannerProviderError("El planificador devolvió un resultado inválido");
        const turn = planned.data;
        pendingResults = [];
        reasoningFeedback = undefined;
        throwIfCancelled(options.signal);

        if (turn.kind === "answer") {
          if (!isCivicResponseSafe(turn.text)) {
            logger.warn("Agente: respuesta bloqueada por política de ámbito", {
              reason: "unsafe-response",
              toolCallCount: toolsUsed.length,
            });
            const response = createScopeAgentResponse("unsafe-response", toolsUsed);
            yield publish({
              type: "status",
              stage: "rendering-ui",
              message: "Aplicando la política de seguridad",
            });
            yield publish({ type: "ui-snapshot", ui: response.ui, dataSources: [] });
            requestSpan.complete({ toolCallCount: attemptedToolCalls });
            yield publish({ type: "completed", response });
            return;
          }
          const uiDataSources = shapeCivicDataForUi(dataSources);
          const reasoningIssues = validateCivicReasoning({
            query,
            answer: turn.text,
            dataSources: uiDataSources,
          });
          if (reasoningIssues.length > 0) {
            if (reasoningRepairs >= (this.config.maxReasoningRepairs ?? 1)) {
              throw new CivicReasoningError(reasoningIssues);
            }
            logger.info("Respuesta rechazada por el validador cívico", {
              issues: reasoningIssues.map((issue) => issue.code),
              attempt: reasoningRepairs + 1,
            });
            reasoningRepairs += 1;
            reasoningFeedback = createCivicReasoningRepairPrompt(reasoningIssues);
            yield publish({
              type: "status",
              stage: "planning",
              message: "Verificando que las cifras estén respaldadas por los datos",
            });
            continue;
          }
          const groundedAnswer = groundCivicAnswer(turn.text, uiDataSources);
          yield publish({
            type: "status",
            stage: "generating-ui",
            message: "Generando la interfaz",
          });
          const ui = await runWithTraceContext(traceContext, () => telemetry.observe(
            { component: "ui", operation: "generate" },
            () => this.planner.composeUi({
              query,
              answer: groundedAnswer,
              dataSources: uiDataSources,
            }, options.signal),
            (document) => ({ outputBytes: serializedSize(document) }),
          ));
          throwIfCancelled(options.signal);
          yield publish({
            type: "status",
            stage: "rendering-ui",
            message: "Preparando componentes de la interfaz",
          });
          for (const update of createUiUpdates(ui, uiDataSources)) {
            yield publish(update);
          }
          const response = AgentResponseSchema.parse({
            answer: groundedAnswer,
            toolsUsed,
            ui,
            dataSources: uiDataSources,
          });
          requestSpan.complete({ toolCallCount: attemptedToolCalls });
          yield publish({ type: "completed", response });
          return;
        }

        if (toolsUsed.length + turn.toolCalls.length > this.config.maxToolCalls) {
          throw new AgentExecutionError("El agente alcanzó el límite de herramientas");
        }

        yield publish({
          type: "status",
          stage: "consulting-tools",
          message: "Consultando datos mediante MCP",
        });
        validateToolCalls(turn.toolCalls, knownTools, executedCalls);
        attemptedToolCalls += turn.toolCalls.length;
        const sourceOffset = dataSources.length;
        for (const [callIndex, call] of turn.toolCalls.entries()) {
          yield publish({ type: "tool-started", toolName: call.name });
          logger.info("Agente: ejecutando herramienta MCP", {
            toolName: call.name,
            callNumber: toolsUsed.length + callIndex + 1,
          });
        }

        const batchResults: Array<AgentToolResult | undefined> = turn.toolCalls.map(() => undefined);
        for await (const completed of this.executeToolBatch(
          turn.toolCalls,
          traceContext,
          options.signal,
        )) {
          throwIfCancelled(options.signal);
          batchResults[completed.index] = AgentToolResultSchema.parse({
            call: completed.call,
            output: completed.output,
          });
          const source = {
            id: `source-${sourceOffset + completed.index + 1}`,
            toolName: completed.call.name,
            data: completed.output,
          };
          dataSources.push(source);
          yield publish({ type: "tool-completed", source });
        }
        pendingResults = requireCompletedResults(batchResults);
        toolsUsed.push(...turn.toolCalls.map((call) => call.name));
        dataSources.sort(compareSourceIds);
        yield publish({
          type: "status",
          stage: "planning",
          message: "Interpretando los datos electorales",
        });
      }
    } catch (error) {
      requestSpan.fail(error, { toolCallCount: attemptedToolCalls });
      if (options.signal?.aborted) {
        yield publish({
          type: "cancelled",
          hasPartialData: dataSources.length > 0,
        });
        return;
      }
      yield publish(createErrorEvent(error, dataSources.length > 0));
    } finally {
      requestSpan.fail(new AgentExecutionError("La solicitud no terminó"), {
        toolCallCount: attemptedToolCalls,
      });
    }
  }

  private async getToolDefinitions(
    traceContext: TraceContext,
    signal?: AbortSignal,
  ): Promise<AgentToolDefinition[]> {
    throwIfCancelled(signal);
    if (this.toolDefinitions) return this.toolDefinitions;
    const definitions = selectAllowedTools(await runWithTraceContext(
      traceContext,
      () => telemetry.observe(
        { component: "mcp", operation: "list-tools" },
        () => this.tools.listTools(signal),
        (tools) => ({ resultCount: tools.length }),
      ),
    ), this.config.permittedToolNames);
    throwIfCancelled(signal);
    this.toolDefinitions = definitions;
    return this.toolDefinitions;
  }

  private async *executeToolBatch(
    calls: AgentToolCall[],
    traceContext: TraceContext,
    signal?: AbortSignal,
  ): AsyncGenerator<CompletedToolCall> {
    const pending = calls.map((call, index) => ({
      index,
      execution: runWithTraceContext(traceContext, () => telemetry.observe(
        { component: "mcp", operation: "tool-call", toolName: call.name },
        () => this.executeTool(call, signal),
        (output) => ({ outputBytes: serializedSize(output) }),
      ))
        .then((output): ToolExecutionOutcome => ({ status: "fulfilled", index, call, output }))
        .catch((error: unknown): ToolExecutionOutcome => ({ status: "rejected", index, error })),
    }));
    let firstError: unknown;

    while (pending.length > 0) {
      const outcome = await Promise.race(pending.map((item) => item.execution));
      const pendingIndex = pending.findIndex((item) => item.index === outcome.index);
      pending.splice(pendingIndex, 1);
      if (outcome.status === "fulfilled") {
        yield outcome;
      } else {
        firstError ??= outcome.error;
      }
    }

    if (firstError) throw firstError;
  }

  private async executeTool(
    call: Parameters<FinancialToolClient["callTool"]>[0],
    signal?: AbortSignal,
  ): Promise<unknown> {
    const maxRetries = this.config.maxToolRetries ?? 1;
    const retryDelayMs = this.config.retryDelayMs ?? 200;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.tools.callTool(call, signal);
      } catch (error) {
        if (
          signal?.aborted
          || !isRetryableToolError(error)
          || attempt === maxRetries
        ) {
          throw error;
        }
        logger.warn("Agente: reintentando herramienta MCP", {
          toolName: call.name,
          retryNumber: attempt + 1,
        });
        await this.delay(retryDelayMs * 2 ** attempt);
        throwIfCancelled(signal);
      }
    }

    throw new AgentExecutionError("No fue posible ejecutar la herramienta");
  }
}

function createScopeAgentResponse(
  reason: CivicScopeBlockReason | "unsafe-response",
  toolsUsed: readonly string[] = [],
): AgentResponse {
  const safe = createCivicScopeResponse(reason);
  return AgentResponseSchema.parse({
    answer: safe.answer,
    toolsUsed: [...toolsUsed],
    ui: safe.ui,
    dataSources: [],
  });
}

function isRetryableToolError(error: unknown): boolean {
  return error instanceof FinancialToolTransportError
    || (error instanceof FinancialToolError && error.retryable);
}

function validateToolCall(
  toolName: string,
  call: Parameters<FinancialToolClient["callTool"]>[0],
  knownTools: ReadonlySet<string>,
  executedCalls: Set<string>,
): void {
  if (!isAllowedTool(toolName) || !knownTools.has(toolName)) {
    throw new AgentExecutionError("El modelo solicitó una herramienta no disponible");
  }
  const fingerprint = toolCallFingerprint(call);
  if (executedCalls.has(fingerprint)) {
    throw new AgentExecutionError("El modelo repitió una llamada sin modificar sus argumentos");
  }
  executedCalls.add(fingerprint);
}

function validateToolCalls(
  calls: AgentToolCall[],
  knownTools: ReadonlySet<string>,
  executedCalls: Set<string>,
): void {
  for (const call of calls) {
    validateToolCall(call.name, call, knownTools, executedCalls);
  }
}

function createUiUpdates(
  ui: UiDocument,
  dataSources: readonly UiDataSource[],
): AgentStreamEventPayload[] {
  const root = ui.root;

  if (hasChildren(root)) {
    const firstChild = root.children[0];
    if (!firstChild) return [{ type: "ui-snapshot", ui, dataSources: [...dataSources] }];
    return [
      {
        type: "ui-snapshot",
        ui: { version: ui.version, root: { ...root, children: [firstChild] } },
        dataSources: [...dataSources],
      },
      ...root.children.slice(1).map((node): AgentStreamEventPayload => ({
        type: "ui-patch",
        operation: { type: "append-child", parentId: root.id, node },
      })),
    ];
  }

  if (root.type === "tabs") {
    return [{ type: "ui-snapshot", ui, dataSources: [...dataSources] }];
  }

  return [{ type: "ui-snapshot", ui, dataSources: [...dataSources] }];
}

interface CompletedToolCall {
  status: "fulfilled";
  index: number;
  call: AgentToolCall;
  output: unknown;
}

interface RejectedToolCall {
  status: "rejected";
  index: number;
  error: unknown;
}

type ToolExecutionOutcome = CompletedToolCall | RejectedToolCall;

function requireCompletedResults(
  results: Array<AgentToolResult | undefined>,
): AgentToolResult[] {
  if (results.some((result) => result === undefined)) {
    throw new AgentExecutionError("Una herramienta no entregó su resultado");
  }
  return results as AgentToolResult[];
}

function compareSourceIds(left: UiDataSource, right: UiDataSource): number {
  return Number(left.id.slice("source-".length)) - Number(right.id.slice("source-".length));
}

function serializedSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

type ContainerNode = Extract<
  UiNode,
  { type: "dashboard" | "stack" | "grid" | "card" }
>;

function hasChildren(node: UiNode): node is ContainerNode {
  return node.type === "dashboard"
    || node.type === "stack"
    || node.type === "grid"
    || node.type === "card";
}

function createErrorEvent(
  error: unknown,
  hasPartialData: boolean,
): AgentStreamEventPayload {
  if (error instanceof z.ZodError) {
    return {
      type: "error",
      code: "invalid-request",
      message: "La solicitud no cumple el formato esperado",
      recoverable: false,
      hasPartialData,
    };
  }
  if (error instanceof UiSemanticCompositionError) {
    return {
      type: "error",
      code: "semantic-ui-error",
      message: "No encontramos una interfaz que respetara todas tus indicaciones",
      recoverable: true,
      hasPartialData,
    };
  }
  if (error instanceof CivicReasoningError) {
    return {
      type: "error",
      code: "financial-reasoning-error",
      message: "No pudimos respaldar la respuesta con evidencia suficiente",
      recoverable: true,
      hasPartialData,
    };
  }
  if (error instanceof UiCompositionError) {
    return {
      type: "error",
      code: "ui-error",
      message: "No fue posible generar una interfaz válida",
      recoverable: true,
      hasPartialData,
    };
  }
  if (error instanceof PlannerConfigurationError) {
    return {
      type: "error",
      code: "provider-error",
      message: "El planificador configurado no está disponible",
      recoverable: false,
      hasPartialData,
    };
  }
  if (error instanceof PlannerProviderError) {
    return {
      type: "error",
      code: "provider-error",
      message: "El planificador no pudo completar la solicitud",
      recoverable: true,
      hasPartialData,
    };
  }
  if (error instanceof FinancialToolError || error instanceof FinancialToolTransportError) {
    return {
      type: "error",
      code: "tool-error",
      message: "Una herramienta de datos no pudo completar la solicitud",
      recoverable: error instanceof FinancialToolTransportError,
      hasPartialData,
    };
  }
  if (error instanceof AgentExecutionError) {
    return {
      type: "error",
      code: "agent-error",
      message: error.message,
      recoverable: false,
      hasPartialData,
    };
  }
  return {
    type: "error",
    code: "internal-error",
    message: "No fue posible completar la consulta",
    recoverable: false,
    hasPartialData,
  };
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AgentExecutionError("La ejecución fue cancelada");
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class AgentExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentExecutionError";
  }
}
