import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  textAgentRequestSchema,
  type SessionReference,
  type TextAgentStreamEvent,
  type UINode,
  type UISpecification,
} from "@banorte/contracts";
import { type SessionStore } from "../src/application/ports/session-store.js";
import { classifyCivicQuery } from "../src/agent/security/civic-scope-policy.js";
import { AgentSessionStore } from "../src/integration/agent-session-store.js";
import { createTextAgentService } from "../src/integration/text-agent-service.js";
import { transformPersistedUi } from "../src/integration/ui-transformation.js";
import { SqliteSessionStore } from "../src/repositories/sqlite-session.repository.js";

const ACTOR_ID = "10000000-0000-4000-8000-000000000001";
const RANKING_QUERY = "¿Qué estado tuvo más participación en 2024?";
let sequence = 0;

class Conversation {
  readonly sessionId = uuid("92");
  private state: SessionReference | undefined;
  private readonly service;

  constructor(readonly store: SessionStore = new AgentSessionStore()) {
    this.service = createTextAgentService({
      sessionStore: store,
      sessionFactory: async () => ({ client: {} as never, user: { id: ACTOR_ID } }),
    });
  }

  async ask(query: string): Promise<{ events: TextAgentStreamEvent[]; answer: string }> {
    const request = textAgentRequestSchema.parse({
      version: "1",
      sessionId: this.sessionId,
      correlationId: uuid("93"),
      provider: "google",
      responseMode: "complete-ui",
      query,
      ...(this.state ? { sessionState: this.state } : {}),
    });
    const events: TextAgentStreamEvent[] = [];
    for await (const event of this.service(request)) events.push(event);
    const error = events.find((event) => event.type === "error");
    assert.equal(error, undefined, `${query}: ${JSON.stringify(error)}`);
    const completed = events.findLast((event) => event.type === "ui-completed");
    assert.ok(completed?.type === "ui-completed", `${query}: sin ui-completed`);
    const dataPatches = events.flatMap((event) => event.type === "data-patch" ? [event.patch] : []);
    this.state = {
      interfaceRevision: completed.revision,
      dataRevision: dataPatches.at(-1)?.revision ?? this.state?.dataRevision ?? 0,
      dataKeys: [...new Set([...(this.state?.dataKeys ?? []), ...dataPatches.map((patch) => patch.key)])],
    };
    const answer = events.flatMap((event) => event.type === "text-delta" ? [event.delta] : []).join("");
    return { events, answer };
  }

  async view(): Promise<UISpecification> {
    const correlationId = uuid("94");
    const begun = await this.store.begin({ actorId: ACTOR_ID, sessionId: this.sessionId, correlationId });
    assert.ok(begun.success && begun.state.specification);
    await this.store.release(ACTOR_ID, this.sessionId, correlationId);
    return begun.state.specification;
  }
}

function uuid(prefix: string): string {
  sequence += 1;
  return `${prefix}000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function nodes(node: UINode): UINode[] {
  const children = "children" in node ? node.children : [];
  return [node, ...children.flatMap(nodes)];
}

function find(specification: UISpecification, predicate: (node: UINode) => boolean): UINode | undefined {
  return nodes(specification.root).find(predicate);
}

function patchCount(events: TextAgentStreamEvent[]): number {
  return events.filter((event) => event.type === "ui-patch").length;
}

test("las ediciones de vista dentro de una conversación electoral no se bloquean", () => {
  const context = `${RANKING_QUERY}\nNueva solicitud del usuario: `;
  for (const request of ["ordénalo de menor a mayor", "muéstrame la fuente", "regresa a la vista anterior", "cambia a gráfica de líneas", "quita el mapa"]) {
    assert.deepEqual(classifyCivicQuery(`${context}${request}`), { allowed: true, category: "ui-transform" }, request);
  }
  assert.deepEqual(classifyCivicQuery(`${context}compara sólo mujeres y hombres`), { allowed: true, category: "civic" });
  assert.deepEqual(classifyCivicQuery("compara sólo mujeres y hombres"), { allowed: false, reason: "out-of-scope" });
  assert.deepEqual(classifyCivicQuery("muéstrame la fuente"), { allowed: false, reason: "out-of-scope" });
});

test("«ordénalo de menor a mayor» ordena gráfica y tabla sin consultar de nuevo", async () => {
  const conversation = new Conversation();
  await conversation.ask(RANKING_QUERY);
  const { events, answer } = await conversation.ask("ordénalo de menor a mayor");
  assert.match(answer, /menor a mayor/u);
  assert.equal(events.some((event) => event.type === "data-patch"), false);
  const view = await conversation.view();
  const chart = find(view, (node) => node.type === "territoryRanking");
  const table = find(view, (node) => node.type === "table");
  assert.ok(chart?.type === "territoryRanking" && table?.type === "table");
  assert.equal(chart.order, "ascending");
  assert.equal(table.sorting?.default?.direction, "ascending");
  assert.equal(table.columns.find((column) => column.field === table.sorting?.default?.field)?.sortable, true);
});

test("«cambia a gráfica de líneas» cambia el tipo de gráfica y conserva los datos", async () => {
  const conversation = new Conversation();
  await conversation.ask(RANKING_QUERY);
  const before = await conversation.view();
  const { events } = await conversation.ask("cambia a gráfica de líneas");
  assert.equal(patchCount(events), 1);
  const view = await conversation.view();
  const chart = find(view, (node) => node.type === "visualization");
  assert.ok(chart?.type === "visualization");
  assert.equal(chart.mark, "line");
  const beforeChart = find(before, (node) => node.type === "territoryRanking");
  assert.ok(beforeChart?.type === "territoryRanking");
  assert.equal(chart.dataBinding, beforeChart.dataBinding);
});

test("«quita el mapa» retira el aviso del mapa y conserva ranking y tabla", async () => {
  const conversation = new Conversation();
  await conversation.ask("Muéstrame un mapa de participación por estado en 2024");
  assert.ok(find(await conversation.view(), (node) => node.type === "mexicoChoropleth"));
  const { answer } = await conversation.ask("quita el mapa");
  assert.match(answer, /Quité el mapa/u);
  const view = await conversation.view();
  assert.equal(find(view, (node) => node.type === "mexicoChoropleth"), undefined);
  assert.ok(find(view, (node) => node.type === "territoryRanking"));
  assert.ok(find(view, (node) => node.type === "table"));

  const { answer: again } = await conversation.ask("quita el mapa");
  assert.match(again, /no incluye un mapa/u);
});

test("«compara sólo mujeres y hombres» vuelve a consultar por sexo con el contexto anterior", async () => {
  const conversation = new Conversation();
  await conversation.ask(RANKING_QUERY);
  const { events, answer } = await conversation.ask("compara sólo mujeres y hombres");
  assert.ok(events.some((event) => event.type === "data-patch"));
  assert.match(answer, /Mujeres/u);
  assert.match(answer, /Hombres/u);
  assert.doesNotMatch(answer, /Sólo puedo ayudarte/u);
  assert.ok(find(await conversation.view(), (node) => node.id === "composicion-group-comparison"));
});

test("«muéstrame la fuente» la describe o la vuelve a agregar si se había quitado", async () => {
  const conversation = new Conversation();
  await conversation.ask(RANKING_QUERY);
  const shown = await conversation.ask("muéstrame la fuente");
  assert.match(shown.answer, /Conteos Censales/u);
  assert.equal(patchCount(shown.events), 0);

  await conversation.ask("deja sólo la tabla");
  assert.equal(find(await conversation.view(), (node) => node.id === "fuente"), undefined);
  const restored = await conversation.ask("muéstrame la fuente");
  assert.match(restored.answer, /Agregué la fuente/u);
  const source = find(await conversation.view(), (node) => node.id === "fuente");
  assert.ok(source?.type === "text");
  assert.match(source.content, /Conteos Censales/u);
});

test("«regresa a la vista anterior» deshace la última edición, también con SQLite", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ine-ui-edits-"));
  const store = new SqliteSessionStore(path.join(directory, "sessions.sqlite"));
  try {
    const conversation = new Conversation(store);
    await conversation.ask(RANKING_QUERY);
    const original = await conversation.view();
    await conversation.ask("deja sólo la tabla");
    assert.equal(find(await conversation.view(), (node) => node.type === "visualization"), undefined);
    const { answer } = await conversation.ask("regresa a la vista anterior");
    assert.match(answer, /Regresé a la vista anterior/u);
    assert.deepEqual(await conversation.view(), original);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("sin vista anterior, «regresa» deja la vista igual y lo explica", () => {
  const specification: UISpecification = {
    version: "1",
    root: { type: "section", id: "vista", ariaLabel: "Vista", children: [{ type: "text", id: "texto", content: "Participación" }] },
  };
  const result = transformPersistedUi({ specification, dataRegistry: {}, prompt: "regresa a la vista anterior" });
  assert.ok(result);
  assert.equal(result.operation, "preserve");
  assert.deepEqual(result.specification, specification);
  assert.match(result.answer, /No hay una vista anterior/u);
});

test("aceptación final: compara, conserva sólo la tabla y recupera fuente y metodología en la misma sesión", async () => {
  const conversation = new Conversation();
  const initial = await conversation.ask(
    "Compara la participación de Aguascalientes entre 2018 y 2024. Elige la forma más clara de mostrarlo y deja visible la evidencia que sustenta la comparación.",
  );
  assert.ok(initial.events.some((event) => event.type === "data-patch"));
  let view = await conversation.view();
  assert.ok(find(view, (node) => node.type === "table"));
  assert.ok(find(view, (node) => node.type === "visualization" || node.type === "electionDelta"));

  const tableOnly = await conversation.ask("Quita la gráfica y conserva únicamente la tabla.");
  assert.equal(tableOnly.events.some((event) => event.type === "data-patch"), false);
  view = await conversation.view();
  assert.ok(find(view, (node) => node.type === "table"));
  assert.equal(find(view, (node) => node.type === "visualization"), undefined);
  assert.equal(find(view, (node) => node.type === "participationTimeline"), undefined);
  assert.equal(find(view, (node) => node.type === "mexicoChoropleth"), undefined);

  const provenance = await conversation.ask("Muéstrame la fuente y la metodología de esta comparación.");
  assert.equal(provenance.events.some((event) => event.type === "data-patch"), false);
  view = await conversation.view();
  assert.ok(find(view, (node) => node.type === "table"));
  const renderedCopy = nodes(view.root)
    .flatMap((node) => node.type === "text" || node.type === "heading" ? [node.content] : [])
    .join(" ");
  assert.match(renderedCopy, /Conteos Censales/u);
  assert.match(renderedCopy, /Metodolog/u);
});
