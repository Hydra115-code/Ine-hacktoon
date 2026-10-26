import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("la conversación anuncia mensajes y actividad sin interrumpir", () => {
  const conversation = source("src/features/workspace/components/ConversationPanel.tsx");

  assert.match(conversation, /role="log"/u);
  assert.match(conversation, /aria-live="polite"/u);
  assert.match(conversation, /aria-relevant="additions text"/u);
  assert.match(conversation, /conversation__activity" role="status"/u);
  assert.match(conversation, /aria-busy=\{isBusy\}/u);
});

test("el lienzo comunica carga, resultado y progreso con contexto", () => {
  const canvas = source("src/features/workspace/components/GenerativeCanvas.tsx");

  assert.match(canvas, /aria-busy=\{isProcessing\}/u);
  assert.match(canvas, /role="progressbar"/u);
  assert.match(canvas, /aria-valuetext=\{`\$\{content\.label\}\. \$\{content\.detail\}`\}/u);
  assert.match(canvas, /aria-label=\{isHistoricalView \? "Interfaz anterior de solo lectura" : "Resultado visual de la consulta"\}/u);
  assert.match(canvas, /role="alert" tabIndex=\{-1\}/u);
});

test("un fallo global se anuncia y recibe foco recuperable", () => {
  const boundary = source("src/features/workspace/components/WorkspaceErrorBoundary.tsx");
  const applicationError = source("src/app/error.tsx");

  assert.match(boundary, /createRef<HTMLElement>/u);
  assert.match(boundary, /componentDidUpdate/u);
  assert.match(boundary, /this\.errorRef\.current\?\.focus/u);
  assert.match(boundary, /className="workspace-failure" role="alert" aria-atomic="true" tabIndex=\{-1\}/u);
  assert.match(boundary, /Intentar de nuevo/u);
  assert.match(applicationError, /errorRef\.current\?\.focus/u);
  assert.match(applicationError, /className="workspace-failure" role="alert" aria-atomic="true" tabIndex=\{-1\}/u);
});

test("las tablas anuncian filtro, orden y paginación", () => {
  const table = source("src/features/generative-ui/table/Table.tsx");
  const pagination = source("src/features/generative-ui/table/TablePagination.tsx");

  assert.match(table, /role="status" aria-live="polite" aria-atomic="true">\{tableAnnouncement\}/u);
  assert.match(table, /resultado.*para \$\{query\.trim\(\)\}/su);
  assert.match(table, /Tabla ordenada por/u);
  assert.match(table, /aria-sort=\{ariaSort\}/u);
  assert.match(pagination, /aria-live="polite"/u);
});

test("mapa, línea del tiempo y gráficas conservan alternativas accesibles", () => {
  const map = source("src/features/generative-ui/primitives/civic/MexicoChoropleth.tsx");
  const timeline = source("src/features/generative-ui/primitives/civic/ParticipationTimeline.tsx");
  const visualization = source("src/features/generative-ui/visualization/Visualization.tsx");
  const visualizationTable = source("src/features/generative-ui/visualization/VisualizationDataTable.tsx");

  assert.match(map, /role="group"/u);
  assert.match(map, /role="button"/u);
  assert.match(map, /tabIndex=\{state\.code === keyboardEntryCode \? 0 : -1\}/u);
  assert.match(map, /aria-live="polite"/u);
  assert.match(timeline, /role="radiogroup"/u);
  assert.match(timeline, /role="radio"/u);
  assert.match(visualization, /role="img"/u);
  assert.match(visualizationTable, /Consultar datos de la gráfica/u);
  assert.match(visualizationTable, /<table>/u);
});

test("los controles compuestos exponen navegación por teclado", () => {
  const tabs = source("src/features/generative-ui/primitives/layout/Tabs.tsx");
  const shell = source("src/features/workspace/components/AppShell.tsx");

  assert.match(tabs, /role="tablist"/u);
  assert.match(tabs, /ArrowRight/u);
  assert.match(tabs, /ArrowLeft/u);
  assert.match(shell, /role="tablist"/u);
  assert.match(shell, /tabIndex=\{mobilePane === "conversation" \? 0 : -1\}/u);
  assert.match(shell, /tabIndex=\{mobilePane === "result" \? 0 : -1\}/u);
});
