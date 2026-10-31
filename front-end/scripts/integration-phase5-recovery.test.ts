import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { presentAgentFailure } from "../src/features/agent/recovery/agent-error-presentation.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Fase 5 traduce fallos de interacción y sesión sin exponer detalles técnicos", () => {
  const secret = "SQLITE_BUSY stack trace token=abc";
  const cases = [
    presentAgentFailure({ code: "ui_event_invalid", message: secret, recoverable: true, hasPartialData: true }),
    presentAgentFailure({ code: "session_busy", message: secret, recoverable: true, hasPartialData: true }),
    presentAgentFailure({ code: "session_not_found", message: secret, recoverable: true, hasPartialData: true }),
    presentAgentFailure({ code: "session_forbidden", message: secret, recoverable: false, hasPartialData: true }),
    presentAgentFailure({ code: "network_lost", message: secret, recoverable: true, hasPartialData: true }),
  ];

  for (const presentation of cases) {
    assert.equal(presentation.canContinue, true);
    assert.doesNotMatch(`${presentation.title} ${presentation.message}`, /sqlite|stack|token|snapshot|patch/iu);
  }
  assert.equal(cases[0]?.canRetry, false, "un evento rechazado no debe repetirse automáticamente");
  assert.equal(cases[1]?.canRetry, false, "una sesión ocupada no debe duplicar la solicitud");
});

test("Fase 5 conserva la última vista, limpia pendientes y bloquea sólo conflictos de revisión", () => {
  const provider = read("src/features/agent/components/AgentSessionProvider.tsx");
  const graceful = provider.slice(provider.indexOf("const failGracefully ="), provider.indexOf("const { messages"));
  assert.match(graceful, /Boolean\(patchStateRef\.current\)/u);
  assert.match(graceful, /preserveForDegradation\("partial_data"\)/u);
  assert.match(graceful, /setPendingNodeIds\(new Set\(\)\)/u);
  assert.match(graceful, /interactionRegistryRef\.current\.clear\(\)/u);
  assert.match(graceful, /code\.includes\("revision_conflict"\)/u);
});

test("Fase 5 recupera UI y datos de manera atómica sin repetir la interacción", () => {
  const provider = read("src/features/agent/components/AgentSessionProvider.tsx");
  const recovery = provider.slice(provider.indexOf("const recoverSnapshot ="), provider.indexOf("const continueWithPartialData ="));
  assert.match(recovery, /restoreSessionUiSnapshot/u);
  assert.match(recovery, /patchStateRef\.current = restored\.ui/u);
  assert.match(recovery, /dataStateRef\.current = restored\.data/u);
  assert.match(recovery, /epoch !== recoveryEpochRef\.current \|\| sessionIdRef\.current !== sessionId/u);
  assert.doesNotMatch(recovery, /sendMessage|dispatchAgentInteraction/u);
});

test("Fase 5 mantiene el resultado visible y deja que Paper explique el problema", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(canvas, /hasBlockingFailure = hasAnyFailure && !generatedInterface/u);
  assert.match(canvas, /Vista disponible/u);
  assert.match(canvas, /canvas-result__degradation-paper/u);
  assert.match(canvas, /PaperAvatar mood=/u);
  assert.doesNotMatch(canvas, /failure\?\.message \?\? errorMessage/u);
});

test("Fase 5 evita comprimir piezas analíticas dentro de grids o flex estrechos", () => {
  const layouts = read("src/features/generative-ui/styles/layout-primitives.css");
  const civic = read("src/features/generative-ui/styles/civic-primitives.css");
  for (const type of ["evidenceSummary", "mexicoChoropleth", "comparisonMatrix", "participationTimeline", "table", "visualization"]) {
    assert.match(layouts, new RegExp(`data-node-type=["']${type}["']`, "u"), type);
  }
  assert.match(layouts, /grid-column:\s*1 \/ -1/u);
  assert.match(layouts, /flex:\s*1 1 30rem/u);
  assert.match(civic, /ui-evidence-summary__equation \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/su);
  assert.match(civic, /white-space:\s*nowrap/u);
});
