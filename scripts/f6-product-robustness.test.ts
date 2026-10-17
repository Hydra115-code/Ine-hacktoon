import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { presentAgentFailure } from "../src/features/agent/recovery/agent-error-presentation.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("F6 no muestra mensajes técnicos crudos en errores públicos", () => {
  const secret = "postgres://admin:secret@internal/db stack trace token=abc";
  const cases = [
    presentAgentFailure({ code: "form_validation_failed", message: secret, recoverable: false }),
    presentAgentFailure({ code: "authoritative_action_failed", message: secret, recoverable: false }),
    presentAgentFailure({ code: "network_connection_failed", message: secret, recoverable: true }),
    presentAgentFailure({ code: "unknown_internal_error", message: secret, recoverable: true }),
    presentAgentFailure({ code: "revision_conflict", message: secret, recoverable: false, hasPartialData: true }),
  ];
  for (const presentation of cases) {
    assert.doesNotMatch(presentation.title, /postgres|secret|token|stack/iu);
    assert.doesNotMatch(presentation.message, /postgres|secret|token|stack/iu);
    assert.doesNotMatch(presentation.message, /snapshot|patch|integración/iu);
  }
  assert.equal(cases.at(-1)?.canContinue, false);
});

test("F6 conserva la última UI válida cuando falla una actualización", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(canvas, /hasBlockingFailure = hasAnyFailure && !generatedInterface/u);
  assert.match(canvas, /Última vista válida disponible/u);
  assert.match(canvas, /canvas-result__degradation-paper/u);
  assert.match(canvas, /PaperAvatar mood=\{status === "partial" \? "thinking" : "surprised"\}/u);
});

test("F6 nunca imprime errorMessage sin sanitizar en el resultado conservado", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.doesNotMatch(canvas, /failure\?\.message \?\? errorMessage/u);
  assert.match(canvas, /preservedFailureMessage/u);
  assert.match(canvas, /Recuperar vista/u);
  assert.doesNotMatch(canvas, /Sincronizar UI y datos/u);
  assert.match(canvas, /role="alert" tabIndex=\{-1\}/u);
});

test("F6 mantiene controles táctiles, layout móvil, foco y movimiento reducido", () => {
  const workspace = read("src/features/workspace/styles/workspace.css");
  const civic = read("src/features/generative-ui/styles/civic-primitives.css");
  assert.match(workspace, /@media \(max-width: 44rem\)/u);
  assert.match(workspace, /\.composer button \{ width: 2\.75rem/u);
  assert.match(workspace, /\.canvas-result__degradation \{ align-items: stretch; flex-direction: column; \}/u);
  assert.match(workspace, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(civic, /focus-visible/u);
  assert.match(civic, /min-height: 2\.75rem/u);
  assert.match(civic, /prefers-reduced-motion: reduce/u);
});

test("F6 conserva una recuperación ciudadana ante una caída total de React", () => {
  const boundary = read("src/features/workspace/components/WorkspaceErrorBoundary.tsx");
  assert.match(boundary, /Tu consulta permanece intacta/u);
  assert.match(boundary, /Restaurar interfaz/u);
  assert.doesNotMatch(boundary, /error\.message|error\.stack|digest/u);
});

test("F6 explica una recuperación no disponible sin términos internos", () => {
  const provider = read("src/features/agent/components/AgentSessionProvider.tsx");
  assert.match(provider, /Paper no pudo recuperar esa revisión/u);
  assert.match(provider, /El resultado anterior sigue visible/u);
  assert.doesNotMatch(provider, /Snapshot no disponible; conservamos/u);
  assert.doesNotMatch(provider, /UI y datos sincronizados con el backend/u);
});
