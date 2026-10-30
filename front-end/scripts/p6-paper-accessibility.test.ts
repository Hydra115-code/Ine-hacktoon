import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("P6 gestiona apertura, Escape y devolución de foco del panel de Paper", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(canvas, /paperHelpPanelRef\.current\?\.focus\(\)/u);
  assert.match(canvas, /paperHelpButtonRef\.current\?\.focus\(\)/u);
  assert.match(canvas, /event\.key === "Escape"/u);
  assert.match(canvas, /aria-haspopup="dialog"/u);
  assert.match(canvas, /role="dialog"[^>]*tabIndex=\{-1\}/u);
});

test("P6 utiliza identificadores únicos para regiones de sugerencias", () => {
  const suggestions = read("src/features/paper/components/PaperSuggestions.tsx");
  assert.match(suggestions, /const titleId = useId\(\)/u);
  assert.match(suggestions, /aria-labelledby=\{titleId\}/u);
  assert.match(suggestions, /aria-describedby=\{descriptionId\}/u);
});

test("P6 respeta movimiento reducido y contraste forzado", () => {
  const paper = read("src/features/paper/styles/paper.css");
  const workspace = read("src/features/workspace/styles/workspace.css");
  assert.match(paper, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.paper-suggestions li button/u);
  assert.match(paper, /@media \(forced-colors: active\)/u);
  assert.match(workspace, /\.canvas-paper-reaction \{\s*animation: none/u);
  assert.match(workspace, /@media \(forced-colors: active\)/u);
});

test("P6 ofrece un harness completo sin depender del backend", () => {
  const page = read("src/app/dev/paper-journey-harness/page.tsx");
  const probe = read("src/app/dev/paper-journey-harness/PaperJourneyProbe.tsx");
  assert.match(page, /<PaperJourneyProbe/u);
  assert.match(probe, /paperStates\.map/u);
  assert.match(probe, /<PaperGuide/u);
  assert.match(probe, /<PaperResultIntro/u);
  assert.match(probe, /<PaperSuggestions/u);
  assert.match(probe, /<PaperReaction/u);
  assert.match(probe, /<PaperDialogue/u);
  assert.match(probe, /Sin conexión al backend/u);
});

test("P6 conserva la decisión humana y oculta detalles técnicos en recuperación", () => {
  const probe = read("src/app/dev/paper-journey-harness/PaperJourneyProbe.tsx");
  assert.match(probe, /No pude completar ese cambio con suficiente evidencia/u);
  assert.doesNotMatch(probe, /stack trace|payload|schema|MCP|HTTP 5\d\d/iu);
  const suggestions = read("src/features/paper/components/PaperSuggestions.tsx");
  assert.match(suggestions, /tú decides si la envías/u);
});
