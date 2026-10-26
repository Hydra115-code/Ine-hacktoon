import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("el workspace cambia entre conversación y resultado sin desbordar la página", () => {
  const workspace = source("src/features/workspace/styles/workspace.css");

  assert.match(workspace, /\.workspace\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/su);
  assert.match(workspace, /\.workspace__pane\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/u);
  assert.match(workspace, /\.conversation\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/u);
  assert.match(workspace, /\.conversation__header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/u);
  assert.match(workspace, /\.conversation__header > span\s*\{[^}]*max-width:\s*100%;[^}]*white-space:\s*normal;/u);
  assert.match(workspace, /\.composer-context > span\s*\{[^}]*max-width:\s*100%;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/u);
  assert.match(workspace, /\.canvas__header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/u);
  assert.match(workspace, /@media \(max-width:\s*58rem\)[\s\S]*?\.workspace__tabs\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*1fr 1fr;/u);
  assert.match(workspace, /\.workspace__tabs button\s*\{[^}]*min-height:\s*2\.75rem;/u);
  assert.match(workspace, /\.workspace__main\[data-mobile-pane="conversation"\][\s\S]*?\.workspace__pane--result[\s\S]*?display:\s*none;/u);
});

test("el panel de conversación puede ampliarse con puntero y teclado", () => {
  const shell = source("src/features/workspace/components/AppShell.tsx");
  const workspace = source("src/features/workspace/styles/workspace.css");

  assert.match(shell, /role="separator"/u);
  assert.match(shell, /aria-label="Ajustar ancho de la conversación"/u);
  assert.match(shell, /onPointerMove=\{\(event\)[\s\S]*?resizeSidebar\(event\.clientX - mainLeft\)/u);
  assert.match(shell, /\["ArrowLeft",\s*"ArrowRight",\s*"Home",\s*"End"\]/u);
  assert.match(shell, /onDoubleClick=\{\(\) => resizeSidebar/u);
  assert.match(workspace, /\.workspace__sidebar-resizer\s*\{[^}]*cursor:\s*col-resize;[^}]*touch-action:\s*none;/u);
  assert.match(workspace, /\.workspace__sidebar-resizer\[data-collapsed="true"\]\s*\{\s*display:\s*none;/u);
});

test("las composiciones generativas apilan columnas en pantallas angostas", () => {
  const layouts = source("src/features/generative-ui/styles/layout-primitives.css");
  const civic = source("src/features/generative-ui/styles/civic-primitives.css");

  assert.match(layouts, /@media \(max-width:\s*64rem\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/u);
  assert.match(layouts, /@media \(max-width:\s*40rem\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/u);
  assert.match(civic, /@media \(max-width:\s*64rem\)[\s\S]*?\.ui-mexico-map__body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/u);
  assert.match(civic, /@media \(max-width:\s*40rem\)[\s\S]*?\.ui-election-delta__periods\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/u);
});

test("tablas y visualizaciones contienen el desplazamiento horizontal", () => {
  const table = source("src/features/generative-ui/table/Table.tsx");
  const tableStyles = source("src/features/generative-ui/styles/table.css");
  const visualizations = source("src/features/generative-ui/styles/visualization.css");
  const civic = source("src/features/generative-ui/styles/civic-primitives.css");

  assert.match(table, /aria-label=\{`Tabla desplazable:/u);
  assert.match(table, /className="ui-table__viewport"[\s\S]*?role="region"[\s\S]*?tabIndex=\{0\}/u);
  assert.match(tableStyles, /\.ui-table__viewport\s*\{[^}]*max-width:\s*100%;[^}]*overflow:\s*auto;/u);
  assert.match(visualizations, /overflow-x:\s*auto;/u);
  assert.match(civic, /\.ui-comparison-matrix__scroller\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;/u);
});

test("los controles principales conservan objetivos táctiles de al menos 44 px", () => {
  const workspace = source("src/features/workspace/styles/workspace.css");
  const tables = source("src/features/generative-ui/styles/table.css");

  assert.match(workspace, /\.canvas-guidance__conversation button\s*\{[^}]*min-height:\s*2\.75rem;/u);
  assert.match(workspace, /\.composer button\s*\{[^}]*width:\s*2\.75rem;/u);
  assert.match(tables, /\.ui-table__period-filter\s*\{[^}]*min-height:\s*2\.75rem;/u);
  assert.match(tables, /\.ui-table__pagination button\s*\{[^}]*min-width:\s*2\.75rem;[^}]*min-height:\s*2\.75rem;/u);
});

test("la vista amplia aumenta la legibilidad de datos en lugar de estirarlos", () => {
  const workspace = source("src/features/workspace/styles/workspace.css");
  const tables = source("src/features/generative-ui/styles/table.css");
  const visualizations = source("src/features/generative-ui/styles/visualization.css");
  const civic = source("src/features/generative-ui/styles/civic-primitives.css");

  for (const stylesheet of [workspace, tables, visualizations, civic]) {
    assert.match(stylesheet, /@media \(min-width:\s*90rem\)/u);
  }
  assert.match(tables, /@media \(min-width:\s*90rem\)[\s\S]*?font-size:\s*1\.0625rem;/u);
});
