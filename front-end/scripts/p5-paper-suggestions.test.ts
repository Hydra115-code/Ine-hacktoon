import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UISpecification } from "@ine/contracts";
import { buildPaperSuggestions } from "../src/features/paper/presentation/build-paper-suggestions.ts";

const specification = {
  version: "1",
  root: {
    type: "stack",
    children: [
      {
        type: "mexicoChoropleth",
        id: "p5-map",
        title: "Participación por entidad",
        ariaLabel: "Mapa de participación",
        dataBinding: "territories",
        entityCodeField: "code",
        entityNameField: "name",
        valueField: "value",
        selectionEvent: "map.entity_selected",
      },
      {
        type: "participationTimeline",
        title: "Evolución",
        ariaLabel: "Evolución por periodo",
        dataBinding: "periods",
        periodField: "period",
        valueField: "value",
        selectionEvent: "timeline.period_selected",
      },
      {
        type: "visualization",
        ariaLabel: "Comparación gráfica",
        mark: "bar",
        dataBinding: "territories",
        encoding: { x: { field: "name", type: "nominal" }, y: { field: "value", type: "quantitative" } },
      },
      {
        type: "table",
        ariaLabel: "Tabla por entidad",
        dataBinding: "territories",
        columns: [{ field: "name", label: "Entidad" }, { field: "value", label: "Participación" }],
      },
    ],
  },
} as UISpecification;

test("P5 deriva sugerencias únicamente de capacidades presentes", () => {
  const suggestions = buildPaperSuggestions(specification, { hasBoundData: true });
  assert.deepEqual(suggestions.map(({ focus }) => focus), ["territory", "period", "presentation"]);
  assert.equal(suggestions.length, 3);
  assert.match(suggestions[0]?.prompt ?? "", /entidades/u);
  assert.match(suggestions[2]?.prompt ?? "", /Quita la gráfica/u);
});

test("P5 propone evidencia cuando hay datos enlazados y no hay una vista rica", () => {
  const metricOnly = {
    version: "1",
    root: { type: "metric", label: "Participación", valueBinding: "summary.value" },
  } as UISpecification;
  const suggestions = buildPaperSuggestions(metricOnly, { hasBoundData: true });
  assert.equal(suggestions[0]?.focus, "evidence");
  assert.match(suggestions[0]?.prompt ?? "", /fuente/u);
});

test("P5 no ofrece acciones cuando todavía no existe interfaz", () => {
  assert.deepEqual(buildPaperSuggestions(null), []);
});

test("P5 limita opciones, evita resultados inventados y conserva decisión humana", () => {
  const suggestions = buildPaperSuggestions(specification, { hasBoundData: true, maximum: 20 });
  assert.ok(suggestions.length <= 3);
  suggestions.forEach((suggestion) => {
    assert.ok(suggestion.prompt.length > 20);
    assert.doesNotMatch(suggestion.prompt, /\b\d+(?:[.,]\d+)?\s*%/u);
  });
  const component = readFileSync(new URL("../src/features/paper/components/PaperSuggestions.tsx", import.meta.url), "utf8");
  assert.match(component, /Paper prepara la pregunta; tú decides si la envías/u);
});

test("P5 integra las sugerencias en el resultado y en la ayuda de Paper", () => {
  const canvas = readFileSync(new URL("../src/features/workspace/components/GenerativeCanvas.tsx", import.meta.url), "utf8");
  assert.match(canvas, /buildPaperSuggestions\(generatedInterface\?\.specification/u);
  assert.match(canvas, /<PaperSuggestions suggestions=\{paperSuggestions\} onSelect=\{prepareSuggestion\}/u);
  assert.match(canvas, /setDraft\(prompt\)/u);
  assert.doesNotMatch(canvas, /sendPrompt\(suggestion\.prompt\)/u);
});
