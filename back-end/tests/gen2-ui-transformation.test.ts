import assert from "node:assert/strict";
import test from "node:test";
import { textAgentRequestSchema, type DataRegistryValue, type UINode, type UISpecification } from "@banorte/contracts";
import { transformPersistedUi } from "../src/integration/ui-transformation.js";
import { AgentSessionStore } from "../src/integration/agent-session-store.js";
import { createTextAgentService } from "../src/integration/text-agent-service.js";
import { createSharedUiPatches } from "../src/integration/shared-ui-stream.js";
import { type SessionStore } from "../src/application/ports/session-store.js";
import { CivicHarness, queryRequest } from "./support/civic-harness.js";

const specification: UISpecification = {
  version: "1",
  root: {
    type: "section",
    id: "analysis-root",
    ariaLabel: "Participación ciudadana",
    children: [
      { type: "heading", id: "analysis-title", content: "Participación por entidad", level: 2 },
      {
        type: "visualization",
        id: "category-chart",
        ariaLabel: "Participación por entidad",
        mark: "bar",
        dataBinding: "source_1.categories",
        encoding: {
          x: { field: "entity", type: "nominal", label: "Entidad" },
          y: { field: "participationPct", type: "quantitative", label: "Participación" },
        },
      },
      {
        type: "table",
        id: "category-table",
        ariaLabel: "Detalle por entidad",
        dataBinding: "source_1.categories",
        columns: [
          { field: "entity", label: "Entidad" },
          { field: "participationPct", label: "Participación", format: "percentage" },
        ],
      },
    ],
  },
};

const dataRegistry: DataRegistryValue = {
  source_1: {
    categories: [
      { entity: "Aguascalientes", participationPct: 0.5538, difference: 2.1 },
      { entity: "Tabasco", participationPct: 0.5, difference: -0.8 },
    ],
  },
};

test("GEN2 elimina sólo la gráfica y conserva tabla, datos e identidades no afectadas", () => {
  const beforeData = structuredClone(dataRegistry);
  const result = transformPersistedUi({
    specification,
    dataRegistry,
    prompt: "Quita la gráfica; quiero conservar el detalle tabular.",
  });
  assert.ok(result);
  assert.equal(findById(result.specification.root, "category-chart"), undefined);
  assert.equal(findById(result.specification.root, "category-table")?.type, "table");
  assert.equal(findById(result.specification.root, "analysis-title")?.type, "heading");
  assert.deepEqual(dataRegistry, beforeData);
});

test("GEN2 no interpreta «conserva la tabla» como orden de eliminarla", () => {
  const result = transformPersistedUi({
    specification,
    dataRegistry,
    prompt: "Quita la gráfica de barras; conserva las métricas y la tabla con las mismas cifras.",
  });
  assert.ok(result);
  assert.equal(findById(result.specification.root, "category-chart"), undefined);
  assert.equal(findById(result.specification.root, "category-table")?.type, "table");
  assert.equal(findById(result.specification.root, "analysis-title")?.type, "heading");
});

test("GEN2 «deja solo tablas» retira también tarjetas y métricas ajenas", () => {
  const withMetric: UISpecification = {
    version: "1",
    root: { type: "section", id: "root", ariaLabel: "Participación", children: [
      { type: "metric", id: "total-participation", label: "Participación total", valueBinding: "source_1.total", format: "percentage" },
      specification.root.type === "section" ? specification.root.children[1]! : specification.root,
      specification.root.type === "section" ? specification.root.children[2]! : specification.root,
    ] },
  };
  const result = transformPersistedUi({
    specification: withMetric,
    dataRegistry,
    prompt: "Elimina las gráficas y deja solo las tablas.",
  });
  assert.ok(result);
  assert.equal(findType(result.specification.root, "visualization"), undefined);
  assert.equal(findType(result.specification.root, "metric"), undefined);
  assert.equal(findById(result.specification.root, "category-table")?.type, "table");
});

test("GEN2 conserva fuente y aviso de muestra cuando se solicitan explícitamente", () => {
  const civic: UISpecification = {
    version: "1",
    root: { type: "flex", id: "root", direction: "column", children: [
      { type: "alert", id: "sample-warning", message: "Estos datos son una muestra y no son totales nacionales.", semanticState: "status.warning" },
      { type: "alert", id: "methodology", message: "Comparación en puntos porcentuales.", semanticState: "status.info" },
      { type: "visualization", id: "chart", ariaLabel: "Participación", mark: "bar", dataBinding: "source_1.rows", encoding: { x: { field: "year", type: "nominal" }, y: { field: "value", type: "quantitative" } } },
      { type: "table", id: "table", ariaLabel: "Participación", dataBinding: "source_1.rows", columns: [{ field: "year", label: "Año" }, { field: "value", label: "Participación" }] },
      { type: "text", id: "source", content: "Fuente: CCPC, Instituto Nacional Electoral.", variant: "caption" },
    ] },
  };
  const result = transformPersistedUi({
    specification: civic,
    dataRegistry: { source_1: { rows: [{ year: 2024, value: 0.55 }] } },
    prompt: "Quita la gráfica y conserva únicamente la tabla, la fuente y el aviso de muestra.",
  });
  assert.ok(result);
  assert.equal(findById(result.specification.root, "chart"), undefined);
  assert.equal(findById(result.specification.root, "table")?.type, "table");
  assert.equal(findById(result.specification.root, "source")?.type, "text");
  assert.equal(findById(result.specification.root, "sample-warning")?.type, "alert");
  assert.equal(findById(result.specification.root, "methodology"), undefined);
  assert.doesNotMatch(result.answer, /financier/u);
});

test("GEN2 deja únicamente el cambio de mayor magnitud usando el registro existente", () => {
  const result = transformPersistedUi({
    specification,
    dataRegistry,
    prompt: "Déjame únicamente el cambio más grande.",
  });
  assert.ok(result);
  const metric = findType(result.specification.root, "metric");
  assert.ok(metric && metric.type === "metric");
  assert.equal(metric.label, "Aguascalientes");
  assert.equal(metric.valueBinding, "source_1.categories.0.difference");
  assert.equal(findType(result.specification.root, "visualization"), undefined);
  assert.equal(findType(result.specification.root, "table"), undefined);
});

test("GEN2 prioriza el mayor cambio de las filas visibles, no el total agregado", () => {
  const comparison: UISpecification = {
    version: "1",
    root: {
      type: "section", id: "comparison", ariaLabel: "Comparación por entidad", children: [
        { type: "metric", id: "total", label: "Variación total", valueBinding: "source_1.totalChange", format: "number" },
        { type: "table", id: "comparison-table", ariaLabel: "Entidades", dataBinding: "source_1.categories", columns: [
          { field: "entity", label: "Entidad" },
          { field: "absoluteChange", label: "Variación", format: "number" },
        ] },
      ],
    },
  };
  const result = transformPersistedUi({
    specification: comparison,
    dataRegistry: { source_1: { totalChange: 8.4, categories: [
      { entity: "Oaxaca", absoluteChange: 5.6 },
      { entity: "Jalisco", absoluteChange: 2.8 },
    ] } },
    prompt: "Deja únicamente el cambio más grande de esta comparación y oculta el resto de la evidencia.",
  });
  assert.ok(result);
  const metric = findType(result.specification.root, "metric");
  assert.ok(metric && metric.type === "metric");
  assert.equal(metric.label, "Oaxaca");
  assert.equal(metric.valueBinding, "source_1.categories.0.absoluteChange");
});

test("GEN2 convierte la visualización en tabla ordenable sin cambiar su binding", () => {
  const result = transformPersistedUi({
    specification,
    dataRegistry,
    prompt: "Convierte la gráfica en una tabla ordenable.",
  });
  assert.ok(result);
  const replacement = findById(result.specification.root, "category-chart");
  assert.ok(replacement && replacement.type === "table");
  assert.equal(replacement.dataBinding, "source_1.categories");
  assert.equal(replacement.sorting?.enabled, true);
  assert.ok(replacement.columns.every((column) => column.sortable));
  assert.equal(replacement.columns.find((column) => column.field === "participationPct")?.format, "percentage");
  assert.equal(replacement.columns.find((column) => column.field === "entity")?.label, "Entidad");
  assert.equal(findById(result.specification.root, "category-table")?.type, "table");
});

test("GEN2 reordena con move sin reemplazar el contenedor ni cambiar IDs", () => {
  const result = transformPersistedUi({
    specification,
    dataRegistry,
    prompt: "Mueve la tabla antes de la gráfica.",
  });
  assert.ok(result);
  assert.equal(result.operation, "reorder");
  assert.deepEqual(result.specification.root.type === "section"
    ? result.specification.root.children.map((child) => child.id) : [],
    ["analysis-title", "category-table", "category-chart"]);
  const patches = createSharedUiPatches(specification, result.specification, 5);
  assert.deepEqual(patches.map((patch) => [patch.op, patch.target, patch.baseRevision, patch.revision]),
    [["move", "category-table", 5, 6]]);
});

test("GEN2 usa ruta directa: cero modelo/MCP, revisión de datos intacta y ui-completed", async () => {
  const harness = new CivicHarness();
  const sessionId = "82000000-0000-4000-8000-000000000001";
  await harness.run(queryRequest(
    sessionId,
    "82000000-0000-4000-8000-000000000101",
    "Analiza los resultados nacionales de la elección presidencial 2024.",
  ));
  const initial = harness.sessions.latest();
  const modelCalls = harness.modelQueries.length;
  const toolCalls = harness.toolCalls.length;

  const events = await harness.run(queryRequest(
    sessionId,
    "82000000-0000-4000-8000-000000000102",
    "Elimina la gráfica y conserva el resto de esta vista.",
    initial,
  ));
  const completed = harness.sessions.latest();

  assert.equal(harness.modelQueries.length, modelCalls);
  assert.equal(harness.toolCalls.length, toolCalls);
  assert.equal(completed.dataRevision, initial.dataRevision);
  assert.deepEqual(completed.dataKeys, initial.dataKeys);
  assert.ok(events.some((event) => event.type === "ui-patch"));
  assert.ok(events.some((event) => event.type === "ui-completed"));
  assert.ok(events.some((event) => event.type === "metrics" && event.mcpLatencyMs === 0));
  assert.ok(events.some((event) => event.type === "ui-started"));
  const uiStarted = events.find((event) => event.type === "ui-started");
  const firstPatch = events.find((event) => event.type === "ui-patch");
  assert.ok(uiStarted && firstPatch && firstPatch.patch.baseRevision === uiStarted.revision);
});

test("GEN2 completa las cuatro transformaciones sin runtime, MCP ni cambio de datos", async () => {
  const prompts = [
    "Quita la gráfica y conserva la tabla.",
    "Elimina las gráficas y deja solo las tablas.",
    "Deja únicamente el cambio más grande de esta comparación.",
    "Convierte la gráfica en una tabla ordenable.",
    "Mueve la tabla antes de la gráfica.",
  ];
  for (const [index, prompt] of prompts.entries()) {
    const store = new AgentSessionStore();
    const actorId = "10000000-0000-4000-8000-000000000001";
    const sessionId = `83000000-0000-4000-8000-00000000000${index + 1}`;
    const seedCorrelationId = `83000000-0000-4000-8000-00000000010${index + 1}`;
    const correlationId = `83000000-0000-4000-8000-00000000020${index + 1}`;
    const seed = await store.begin({ actorId, sessionId, correlationId: seedCorrelationId });
    assert.equal(seed.success, true);
    await store.complete({
      actorId, sessionId, correlationId: seedCorrelationId,
      interfaceRevision: 0, dataRevision: 1, dataKeys: ["source_1"],
      dataRegistry, specification,
      prompt: "Compara los votos por partido de la elección de 2024.",
      answer: "Los votos se concentran en dos partidos.",
    });
    const service = createTextAgentService({
      sessionStore: store,
      sessionFactory: async () => ({ client: {} as never, user: { id: actorId } }),
      createRuntime: async () => { throw new Error("GEN2 no debe iniciar runtime ni MCP"); },
    });
    const request = textAgentRequestSchema.parse({
      version: "1", sessionId, correlationId, provider: "google", responseMode: "complete-ui", query: prompt,
      sessionState: { interfaceRevision: 0, dataRevision: 1, dataKeys: ["source_1"] },
    });
    const events = [];
    for await (const event of service(request)) events.push(event);
    assert.equal(events.some((event) => event.type === "error"), false, prompt);
    assert.ok(events.some((event) => event.type === "ui-started"), prompt);
    assert.ok(events.some((event) => event.type === "ui-patch"), prompt);
    assert.ok(events.some((event) => event.type === "ui-completed"), prompt);
    assert.ok(events.some((event) => event.type === "completed"), prompt);
    assert.equal(events.some((event) => event.type === "data-patch"), false, prompt);
    assert.ok(events.some((event) => event.type === "metrics" && event.mcpLatencyMs === 0), prompt);
    const inspect = await store.begin({ actorId, sessionId, correlationId: `83000000-0000-4000-8000-00000000030${index + 1}` });
    assert.equal(inspect.success, true);
    if (inspect.success) {
      assert.equal(inspect.state.dataRevision, 1, prompt);
      assert.deepEqual(inspect.state.dataRegistry, dataRegistry, prompt);
      assert.ok(inspect.state.interfaceRevision > 0, prompt);
    }
  }
});

test("GEN2 conserva la última UI y no publica parches si falla la persistencia", async () => {
  const delegate = new AgentSessionStore();
  const actorId = "10000000-0000-4000-8000-000000000001";
  const sessionId = "84000000-0000-4000-8000-000000000001";
  const initialCorrelationId = "84000000-0000-4000-8000-000000000101";
  const correlationId = "84000000-0000-4000-8000-000000000102";
  await delegate.begin({ actorId, sessionId, correlationId: initialCorrelationId });
  await delegate.complete({
    actorId, sessionId, correlationId: initialCorrelationId,
    interfaceRevision: 0, dataRevision: 1, dataKeys: ["source_1"],
    dataRegistry, specification,
    prompt: "Compara los votos por partido de la elección de 2024.",
    answer: "El análisis electoral está listo.",
  });
  const failingStore: SessionStore = {
    begin: (input) => delegate.begin(input),
    complete: async () => { throw new Error("persistencia interrumpida"); },
    release: (actor, session, correlation) => delegate.release(actor, session, correlation),
  };
  const service = createTextAgentService({
    sessionStore: failingStore,
    sessionFactory: async () => ({ client: {} as never, user: { id: actorId } }),
    createRuntime: async () => { throw new Error("No se debe iniciar el runtime"); },
  });
  const request = textAgentRequestSchema.parse({
    version: "1", sessionId, correlationId, provider: "google", responseMode: "complete-ui",
    query: "Quita la gráfica y conserva la tabla.",
    sessionState: { interfaceRevision: 0, dataRevision: 1, dataKeys: ["source_1"] },
  });
  const events = [];
  for await (const event of service(request)) events.push(event);
  assert.ok(events.some((event) => event.type === "error" && event.error.code === "ui_transform_invalid"));
  assert.equal(events.some((event) => event.type === "ui-patch"), false);
  const inspect = await delegate.begin({ actorId, sessionId, correlationId: "84000000-0000-4000-8000-000000000103" });
  assert.equal(inspect.success, true);
  if (inspect.success) {
    assert.equal(inspect.state.interfaceRevision, 0);
    assert.equal(inspect.state.dataRevision, 1);
    assert.deepEqual(inspect.state.specification, specification);
    assert.deepEqual(inspect.state.dataRegistry, dataRegistry);
  }
});

function findById(node: UINode, id: string): UINode | undefined {
  if (node.id === id) return node;
  if ("children" in node) for (const child of node.children) { const match = findById(child, id); if (match) return match; }
  return undefined;
}

function findType<T extends UINode["type"]>(node: UINode, type: T): Extract<UINode, { type: T }> | undefined {
  if (node.type === type) return node as Extract<UINode, { type: T }>;
  if ("children" in node) for (const child of node.children) { const match = findType(child, type); if (match) return match; }
  return undefined;
}
