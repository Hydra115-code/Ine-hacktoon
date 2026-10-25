import assert from "node:assert/strict";
import test from "node:test";
import {
  uiEventSchema,
  type TextAgentStreamEvent,
  type UIEvent,
  type UISpecification,
} from "@banorte/contracts";
import { createUiEventQuery, reconcileUiEventControl, SharedUiEventValidationError } from "../src/integration/shared-ui-event.js";
import { interpretCivicQuery } from "../src/agent/planning/civic-query-interpreter.js";
import { adaptUiDataSource } from "../src/integration/shared-contract-adapter.js";
import {
  ACTOR_ID,
  CivicHarness,
  ENTITY_FILTER_EVENT,
  ENTITY_FILTER_ID,
  interactionRequest,
  queryRequest,
  referenceFrom,
} from "./support/civic-harness.js";

const SESSION_ID = "34000000-0000-4000-8000-000000000001";

const controls: UISpecification = {
  version: "1",
  root: {
    type: "stack",
    id: "interaction-controls",
    gap: "md",
    children: [
      {
        type: "dateRange",
        id: "period-control",
        label: "Periodo",
        event: "period.changed",
        min: "2026-01-01",
        max: "2026-12-31",
        required: true,
      },
      {
        type: "select",
        id: "entity-control",
        label: "Entidad",
        event: "entity.changed",
        options: [
          { value: "jalisco", label: "Jalisco" },
          { value: "oaxaca", label: "Oaxaca" },
        ],
        required: true,
      },
      {
        type: "slider",
        id: "age-control",
        label: "Edad mínima",
        event: "age.changed",
        min: 18,
        max: 100,
        step: 1,
      },
      {
        type: "button",
        id: "refresh-control",
        label: "Actualizar",
        event: "analysis.refresh.requested",
      },
    ],
  },
};

test("DateRange, Select, Slider y Button producen intención semántica sin seleccionar herramientas", () => {
  const events: UIEvent["event"][] = [
    { name: "period.changed", sourceId: "period-control", value: { start: "2026-08-01", end: "2026-08-31" } },
    { name: "entity.changed", sourceId: "entity-control", value: "oaxaca" },
    { name: "age.changed", sourceId: "age-control", value: 30 },
    { name: "analysis.refresh.requested", sourceId: "refresh-control" },
  ];

  for (const [index, event] of events.entries()) {
    const interaction = uiEventSchema.parse({
      version: "1",
      sessionId: SESSION_ID,
      correlationId: `35000000-0000-4000-8000-00000000000${index + 1}`,
      interfaceRevision: 2,
      dataRevision: 3,
      dataKeys: ["source_1"],
      event,
    });
    const query = createUiEventQuery(interaction, controls, "Analiza los resultados electorales");
    assert.match(query, new RegExp(event.name.replaceAll(".", "\\."), "u"));
    assert.doesNotMatch(query, /"toolName"/u);
    assert.match(query, /Decide qué herramientas MCP son necesarias/u);
    assert.match(query, /selección absoluta/u);
  }
});

test("la UI recompuesta conserva el valor absoluto validado aunque el planner proponga otro", () => {
  const reconciled = reconcileUiEventControl(controls, {
    name: "age.changed",
    sourceId: "age-control",
    value: 40,
  });
  const slider = reconciled.root.type === "stack"
    ? reconciled.root.children.find((node) => node.id === "age-control")
    : undefined;
  assert.equal(slider?.type, "slider");
  if (slider?.type === "slider") assert.equal(slider.initialValue, 40);
});

test("un cambio numérico conserva identidad y validación de borradores locales sin mutar el snapshot", () => {
  const previous = structuredClone(controls);
  if (previous.root.type !== "stack") throw new Error("Expected stack");
  const note = { type: "input" as const, id: "school-note", label: "Notas", event: "form.value.changed", initialValue: "", validation: { maxLength: 500 } };
  previous.root.children.push(note);
  const generated = structuredClone(previous);
  if (generated.root.type !== "stack") throw new Error("Expected stack");
  generated.root.children[generated.root.children.length - 1] = { ...note, id: "new-note", validation: { maxLength: 1000 } };
  const result = reconcileUiEventControl(generated, { name: "age.changed", sourceId: "age-control", value: 40 }, previous);
  if (result.root.type !== "stack") throw new Error("Expected stack");
  assert.deepEqual(result.root.children.at(-1), note);
  assert.equal(generated.root.children.at(-1)?.id, "new-note");
  assert.deepEqual(previous.root.children.at(-1), note);
});

test("controles que comparten evento no sobrescriben selecciones ajenas", () => {
  const specification = structuredClone(controls);
  if (specification.root.type !== "stack") throw new Error("Expected stack");
  specification.root.children.push({
    type: "slider", id: "other-age", label: "Edad máxima",
    event: "age.changed", min: 18, max: 100, step: 1, initialValue: 60,
  });
  const reconciled = reconcileUiEventControl(specification, {
    name: "age.changed", sourceId: "age-control", value: 40,
  });
  if (reconciled.root.type !== "stack") throw new Error("Expected stack");
  const other = reconciled.root.children.find((node) => node.id === "other-age");
  if (other?.type !== "slider") throw new Error("Expected slider");
  assert.equal(other.initialValue, 60);
  assert.deepEqual(reconcileUiEventControl(specification, {
    name: "age.changed", sourceId: "unknown", value: 40,
  }), specification);
});

test("los porcentajes de participación llegan como fracciones y los puntos porcentuales no se dividen", () => {
  const value = adaptUiDataSource({
    id: "source-1",
    toolName: "compare_elections",
    data: {
      elections: [{ year: 2018, voted: 7_288, classified: 14_585, participationPct: 49.97, nominalParticipationPct: 48.89 }],
      changes: [{ year: 2024, baselineYear: 2018, participationPoints: -3.61 }],
    },
  }, 0).value as Record<string, unknown>;
  const election = (value.elections as Array<Record<string, unknown>>)[0]!;
  const change = (value.changes as Array<Record<string, unknown>>)[0]!;

  assert.equal(election.participationPct, 0.4997);
  assert.equal(election.nominalParticipationPct, 0.4889);
  assert.equal(election.voted, 7_288);
  assert.equal(change.participationPoints, -3.61);
  assert.equal(value.dataType, "OBSERVED");
});

test("los identificadores públicos de la fuente se conservan y los privados no", () => {
  const value = adaptUiDataSource({
    id: "source-1",
    toolName: "get_supporting_records",
    data: {
      userId: "10000000-0000-4000-8000-000000000001",
      records: [{ entity: "Aguascalientes", sourceId: "ccpc-2024-01", sourceRows: 12, ownerId: "x" }],
      sources: [{ id: "ccpc-2024-01", year: 2024, url: "https://example.org/ccpc.zip" }],
    },
  }, 0).value as Record<string, unknown>;
  const record = (value.records as Array<Record<string, unknown>>)[0]!;
  const source = (value.sources as Array<Record<string, unknown>>)[0]!;

  assert.equal(record.sourceId, "ccpc-2024-01");
  assert.equal(source.id, "ccpc-2024-01");
  assert.equal("userId" in value, false);
  assert.equal("ownerId" in record, false);
});

test("rechaza eventos fabricados o valores que no pertenecen al control", () => {
  const forged = uiEventSchema.parse({
    version: "1",
    sessionId: SESSION_ID,
    correlationId: "35000000-0000-4000-8000-000000000010",
    interfaceRevision: 2,
    dataRevision: 3,
    dataKeys: ["source_1"],
    event: { name: "entity.changed", sourceId: "period-control", value: "oaxaca" },
  });
  assert.throws(() => createUiEventQuery(forged, controls), SharedUiEventValidationError);

  const invalidSlider = uiEventSchema.parse({
    ...forged,
    correlationId: "35000000-0000-4000-8000-000000000011",
    event: { name: "age.changed", sourceId: "age-control", value: 150 },
  });
  assert.throws(() => createUiEventQuery(invalidSlider, controls), SharedUiEventValidationError);
});

test("mapa y línea del tiempo producen intención cívica sólo para valores visibles", () => {
  const civicControls: UISpecification = {
    version: "1",
    root: {
      type: "stack",
      id: "civic-interactions",
      gap: "md",
      children: [
        {
          type: "mexicoChoropleth",
          id: "participation-map",
          ariaLabel: "Mapa de participación",
          title: "Participación por entidad",
          dataBinding: "territories",
          entityCodeField: "code",
          entityNameField: "name",
          valueField: "participation",
          selectionEvent: "map.entity_selected",
        },
        {
          type: "participationTimeline",
          id: "participation-timeline",
          ariaLabel: "Evolución de participación",
          title: "Participación por elección",
          dataBinding: "timeline",
          periodField: "year",
          valueField: "participation",
          selectionEvent: "timeline.period_selected",
        },
      ],
    },
  };
  const registry = {
    territories: [{ code: "01", name: "Aguascalientes", participation: 0.587 }],
    timeline: [{ year: 2018, participation: 0.58 }, { year: 2024, participation: 0.587 }],
  };
  const interaction = (event: UIEvent["event"], correlationId: string) => uiEventSchema.parse({
    version: "1", sessionId: SESSION_ID, correlationId, interfaceRevision: 2,
    dataRevision: 3, dataKeys: ["territories", "timeline"], event,
  });

  const mapQuery = createUiEventQuery(interaction(
    { name: "map.entity_selected", sourceId: "participation-map", value: "01" },
    "35000000-0000-4000-8000-000000000012",
  ), civicControls, "Compara la participación nacional", registry);
  assert.match(mapQuery, /"dimension":"entity","entityCode":"01","entityName":"Aguascalientes"/u);
  assert.deepEqual(interpretCivicQuery(mapQuery).entityCodes, ["01"]);

  const timelineQuery = createUiEventQuery(interaction(
    { name: "timeline.period_selected", sourceId: "participation-timeline", value: "2024" },
    "35000000-0000-4000-8000-000000000013",
  ), civicControls, "Compara la participación nacional", registry);
  assert.match(timelineQuery, /"dimension":"period","period":"2024"/u);
  assert.deepEqual(interpretCivicQuery(timelineQuery).years, [2024]);

  assert.throws(() => createUiEventQuery(interaction(
    { name: "map.entity_selected", sourceId: "participation-map", value: "99" },
    "35000000-0000-4000-8000-000000000014",
  ), civicControls, undefined, registry), SharedUiEventValidationError);
  assert.throws(() => createUiEventQuery(interaction(
    { name: "timeline.period_selected", sourceId: "participation-timeline", value: "2030" },
    "35000000-0000-4000-8000-000000000015",
  ), civicControls, undefined, registry), SharedUiEventValidationError);
});

test("un selector de entidad vuelve al Agent, consulta MCP y produce DataPatch/UIPatch sin prompt nuevo", async () => {
  const harness = new CivicHarness();
  await harness.run(queryRequest(
    SESSION_ID,
    "35000000-0000-4000-8000-000000000020",
    "Muéstrame los resultados de Aguascalientes en 2024.",
  ));
  const initial = harness.sessions.latest();

  const events = await harness.run(interactionRequest(
    SESSION_ID,
    "35000000-0000-4000-8000-000000000021",
    initial,
    { name: ENTITY_FILTER_EVENT, sourceId: ENTITY_FILTER_ID, value: "tabasco" },
  ));

  assertSuccessful(events);
  assert.ok(events.some((event) => event.type === "data-patch"));
  assert.ok(events.some((event) => event.type === "ui-patch"));
  const requestedEntities = harness.toolCalls.flatMap((call) => (call.arguments.entities as string[] | undefined) ?? []);
  assert.ok(requestedEntities.slice(-2).includes("Tabasco"));
  const completed = harness.sessions.latest();
  assert.equal(completed.prompt, undefined);
  assert.equal(completed.interaction?.name, ENTITY_FILTER_EVENT);
  assert.equal(completed.interaction?.value, "tabasco");
  assert.ok(completed.interfaceRevision > initial.interfaceRevision);
  assert.ok(completed.dataRevision > initial.dataRevision);

  const inspectionCorrelationId = "35000000-0000-4000-8000-000000000022";
  const inspection = await harness.sessions.begin({
    actorId: ACTOR_ID,
    sessionId: SESSION_ID,
    correlationId: inspectionCorrelationId,
    reference: referenceFrom(completed),
  });
  assert.equal(inspection.success, true);
  if (!inspection.success) return;
  assert.equal(inspection.state.turns.length, 1, "la interacción no debe fingir un prompt escrito");
  assert.equal(inspection.state.interactionState[ENTITY_FILTER_EVENT], "tabasco");
  await harness.sessions.release(ACTOR_ID, SESSION_ID, inspectionCorrelationId);
});

test("una revisión obsoleta se rechaza antes de invocar MCP", async () => {
  const harness = new CivicHarness();
  await harness.run(queryRequest(
    SESSION_ID,
    "35000000-0000-4000-8000-000000000030",
    "Muéstrame los resultados de Aguascalientes en 2024.",
  ));
  const current = harness.sessions.latest();
  const callsBefore = harness.toolCalls.length;
  const events = await harness.run(interactionRequest(
    SESSION_ID,
    "35000000-0000-4000-8000-000000000031",
    current,
    { name: ENTITY_FILTER_EVENT, sourceId: ENTITY_FILTER_ID, value: "tabasco" },
    -1,
  ));

  assert.equal(errorCode(events), "session_revision_conflict");
  const conflict = events.find((event) => event.type === "error");
  assert.equal(conflict?.type === "error" ? conflict.error.hasPartialData : undefined, true);
  assert.equal(harness.toolCalls.length, callsBefore);
});

test("una interacción manipulada conserva la vista y libera la sesión para el siguiente intento", async () => {
  const harness = new CivicHarness();
  await harness.run(queryRequest(
    SESSION_ID,
    "35000000-0000-4000-8000-000000000040",
    "Muéstrame los resultados de Aguascalientes en 2024.",
  ));
  const current = harness.sessions.latest();
  const callsBefore = harness.toolCalls.length;
  const rejected = await harness.run(interactionRequest(
    SESSION_ID,
    "35000000-0000-4000-8000-000000000041",
    current,
    { name: ENTITY_FILTER_EVENT, sourceId: "control-inexistente", value: "tabasco" },
  ));

  const failure = rejected.find((event) => event.type === "error");
  assert.equal(failure?.type === "error" ? failure.error.code : undefined, "ui_event_invalid");
  assert.equal(failure?.type === "error" ? failure.error.hasPartialData : undefined, true);
  assert.equal(harness.toolCalls.length, callsBefore, "un evento inválido no consulta MCP");

  const accepted = await harness.run(interactionRequest(
    SESSION_ID,
    "35000000-0000-4000-8000-000000000042",
    current,
    { name: ENTITY_FILTER_EVENT, sourceId: ENTITY_FILTER_ID, value: "tabasco" },
  ));
  assertSuccessful(accepted);
});

function assertSuccessful(events: TextAgentStreamEvent[]) {
  assert.equal(events[0]?.type, "started");
  assert.equal(events.at(-1)?.type, "completed");
  assert.equal(events.some((event) => event.type === "error"), false);
}

function errorCode(events: TextAgentStreamEvent[]) {
  const error = events.find((event) => event.type === "error");
  return error?.type === "error" ? error.error.code : undefined;
}
