import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyInteractionEvent } from "../src/features/agent/interactions/interaction-policy.ts";
import { buildPaperInteractionReaction, type PaperObservableUIEvent } from "../src/features/paper/interactions/build-paper-interaction-reaction.ts";

function event(name: string, value?: PaperObservableUIEvent["value"]): PaperObservableUIEvent & { sourceId: string } {
  return { isValid: true, name, sourceId: "p4-test", value };
}

test("P4 traduce selecciones territoriales y periodos a lenguaje ciudadano", () => {
  assert.equal(buildPaperInteractionReaction(event("map.entity_selected", "01"))?.message, "Ahora estamos observando Aguascalientes.");
  assert.equal(buildPaperInteractionReaction(event("period.changed", ["2018", "2024"]))?.message, "La vista ahora considera 2018 y 2024.");
});

test("P4 reacciona a filtros, orden, metodología y cambios de composición", () => {
  assert.match(buildPaperInteractionReaction(event("table.filter.changed", "Nayarit"))?.message ?? "", /Nayarit/u);
  assert.equal(buildPaperInteractionReaction(event("table.sort.changed", "participation"))?.kind, "table.sorted");
  assert.equal(buildPaperInteractionReaction(event("methodology.opened", true))?.kind, "methodology.opened");
  assert.equal(buildPaperInteractionReaction(event("chart.removed"))?.kind, "chart.removed");
  assert.equal(buildPaperInteractionReaction(event("view.restored"))?.kind, "view.restored");
});

test("P4 ignora ruido, eventos inválidos y contenido potencialmente inseguro", () => {
  assert.equal(buildPaperInteractionReaction(event("map.hovered", "01")), null);
  assert.equal(buildPaperInteractionReaction(event("viewport.scrolled", 120)), null);
  assert.equal(buildPaperInteractionReaction({ ...event("table.filter.changed", "<script>\nprueba"), isValid: false }), null);
  assert.doesNotMatch(buildPaperInteractionReaction(event("table.filter.changed", "<script>\nprueba"))?.message ?? "", /[<>\n]/u);
});

test("P4 mantiene periodo y metodología como exploraciones locales", () => {
  assert.equal(classifyInteractionEvent("period.changed").delivery, "local");
  assert.equal(classifyInteractionEvent("timeline.period_selected").delivery, "local");
  assert.equal(classifyInteractionEvent("map.entity_selected").delivery, "local");
  assert.equal(classifyInteractionEvent("territory.selected").delivery, "local");
  assert.equal(classifyInteractionEvent("methodology.opened").delivery, "local");
  assert.equal(classifyInteractionEvent("table.filter.changed").delivery, "local");
});

test("P4 observa una interacción una vez y luego conserva el flujo existente", () => {
  const canvas = readFileSync(new URL("../src/features/workspace/components/GenerativeCanvas.tsx", import.meta.url), "utf8");
  assert.match(canvas, /observeUIEvent\(event\);\s*handleUIEvent\(event\);/u);
  assert.match(canvas, /onEvent=\{handleCanvasUIEvent\}/u);
  assert.match(canvas, /<PaperReaction reaction=\{paperReaction\}/u);
  assert.match(canvas, /aria-live="polite"/u);
});
