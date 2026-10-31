import assert from "node:assert/strict";
import test from "node:test";
import type { UISpecification } from "@ine/contracts";
import { buildPaperResultIntro } from "../src/features/paper/presentation/build-paper-result-intro.ts";

const richSpecification = {
  version: "1",
  root: {
    type: "stack",
    children: [
      { type: "heading", content: "Participación por entidad", level: 2 },
      { type: "text", content: "La participación presenta diferencias entre los territorios observados. Esta segunda frase no debe mostrarse.", tone: "primary" },
      {
        type: "mexicoChoropleth",
        id: "map-test",
        title: "Participación por entidad",
        ariaLabel: "Mapa de participación",
        dataBinding: "territories",
        entityCodeField: "code",
        entityNameField: "name",
        valueField: "value",
        selectionEvent: "territory.selected",
      },
      {
        type: "table",
        ariaLabel: "Datos por entidad",
        dataBinding: "territories",
        columns: [{ field: "name", label: "Entidad" }],
      },
      { type: "metric", label: "Participación", valueBinding: "summary.value" },
    ],
  },
} as UISpecification;

test("P3 resume una observación validada en una sola frase", () => {
  const intro = buildPaperResultIntro(richSpecification, { hasBoundData: true });
  assert.ok(intro);
  assert.equal(intro.summary, "La participación presenta diferencias entre los territorios observados.");
  assert.equal(intro.summaryKind, "observation");
  assert.doesNotMatch(intro.summary, /segunda frase/u);
  assert.equal(intro.sourceLabel, "Datos vinculados a esta vista");
});

test("P3 describe únicamente componentes presentes en la interfaz", () => {
  const intro = buildPaperResultIntro(richSpecification);
  assert.ok(intro);
  assert.match(intro.presentationReason, /un mapa/u);
  assert.match(intro.presentationReason, /una tabla verificable/u);
  assert.match(intro.presentationReason, /indicadores clave/u);
  assert.doesNotMatch(intro.presentationReason, /línea de tiempo|una gráfica/u);
  assert.equal(intro.evidenceCount, 3);
});

test("P3 usa una orientación neutral cuando no existe conclusión textual", () => {
  const specification = {
    version: "1",
    root: {
      type: "participationTimeline",
      title: "Evolución",
      ariaLabel: "Evolución de participación",
      dataBinding: "periods",
      periodField: "year",
      valueField: "value",
      selectionEvent: "timeline.period_selected",
    },
  } as UISpecification;
  const intro = buildPaperResultIntro(specification);
  assert.ok(intro);
  assert.equal(intro.summaryKind, "orientation");
  assert.match(intro.summary, /por periodo/u);
  assert.match(intro.presentationReason, /línea de tiempo/u);
});

test("P3 descarta vocabulario técnico de la introducción pública", () => {
  const specification = {
    version: "1",
    root: {
      type: "stack",
      children: [
        { type: "text", content: "El payload JSON del registry contiene datos internos que no deben mostrarse." },
        { type: "table", ariaLabel: "Resultados", dataBinding: "rows", columns: [{ field: "name", label: "Nombre" }] },
      ],
    },
  } as UISpecification;
  const intro = buildPaperResultIntro(specification);
  assert.ok(intro);
  assert.equal(intro.summaryKind, "orientation");
  assert.doesNotMatch(`${intro.summary} ${intro.presentationReason}`, /payload|json|registry/iu);
});

test("P3 no inventa una introducción cuando no existe interfaz", () => {
  assert.equal(buildPaperResultIntro(null), null);
});
