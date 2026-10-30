import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("P2 usa una presencia central de Paper durante la generación", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(canvas, /<PaperGuide/u);
  assert.match(canvas, /className="canvas-process__guide"/u);
  assert.match(canvas, /presentation=\{paperGuide\}/u);
  assert.match(canvas, /data-paper-state=\{paperGuide\.state\}/u);
});

test("P2 mantiene las etapas conectadas a estados reales", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(canvas, /const processSteps = \["Comprendiendo", "Consultando", "Construyendo"\]/u);
  assert.match(canvas, /status === "retrieving_data"/u);
  assert.match(canvas, /status === "generating_ui" \|\| status === "updating"/u);
  assert.doesNotMatch(canvas, /setTimeout\([^)]*activeProcessStep/u);
});

test("P2 conserva a Paper durante una actualización sin ocultar la vista válida", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(canvas, /canvas-result__activity-paper/u);
  assert.match(canvas, /<PaperAvatar mood=\{paperReaction\?\.mood \?\? paperGuide\.mood\} size="sm"/u);
  assert.match(canvas, /paperReaction \? "Paper ajusta la vista" : paperGuide\.title/u);
});

test("P2 transforma la presencia central en Mini Paper al terminar", () => {
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(canvas, /status !== "empty" && !isProcessing && !hasBlockingFailure/u);
  assert.match(canvas, /className="canvas-paper-help"/u);
  assert.match(canvas, /<PaperAvatar mood=\{paperReaction\?\.mood \?\? paperGuide\.mood\} size="md"/u);
  assert.match(canvas, /aria-expanded=\{isPaperHelpOpen\}/u);
});

test("P2 ofrece una composición responsive y respeta movimiento reducido", () => {
  const workspace = read("src/features/workspace/styles/workspace.css");
  const paper = read("src/features/paper/styles/paper.css");
  assert.match(workspace, /\.canvas-process__guide/u);
  assert.match(workspace, /\.canvas-process__guide \{ grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(paper, /@media \(prefers-reduced-motion: reduce\)/u);
});
