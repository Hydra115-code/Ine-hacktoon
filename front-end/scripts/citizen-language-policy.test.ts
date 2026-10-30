import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { citizenProgressMessage, forbiddenCitizenTerms, toCitizenLanguage } from "../src/shared/citizen-language.ts";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("traduce términos internos antes de mostrarlos", () => {
  const internal = "El provider envió un patch de UI con un binding inválido desde el backend";
  const citizen = toCitizenLanguage(internal);
  for (const term of forbiddenCitizenTerms) {
    assert.doesNotMatch(citizen, new RegExp(`\\b${term}\\b`, "iu"));
  }
  assert.match(citizen, /Paper/u);
  assert.match(citizen, /vista/u);
});

test("los estados de progreso nunca nombran la implementación", () => {
  assert.equal(citizenProgressMessage("Consultando datos mediante MCP"), "Estoy consultando las fuentes oficiales");
  assert.equal(citizenProgressMessage("Preparando componentes de la interfaz"), "Estoy organizando la información");
  assert.equal(citizenProgressMessage("El planificador está trabajando"), "Estoy entendiendo tu pregunta");
});

test("las superficies públicas no contienen los mensajes técnicos conocidos", () => {
  const publicSources = [
    read("src/features/agent/recovery/agent-error-presentation.ts"),
    read("src/features/generative-ui/degradation/build-generic-ui.ts"),
    read("src/features/generative-ui/degradation/ui-degradation.tsx"),
    read("src/features/generative-ui/primitives/civic/EvidenceSummary.tsx"),
    read("src/features/workspace/components/WorkspaceErrorBoundary.tsx"),
    read("src/app/error.tsx"),
  ].join("\n");

  assert.doesNotMatch(publicSources, /datos recuperados|formato compatible|numerador o denominador|validación del servicio|parte de la interfaz necesita reconstruirse/iu);
});

test("los mensajes crudos del transporte se convierten antes de entrar al estado visible", () => {
  const provider = read("src/features/agent/components/AgentSessionProvider.tsx");
  assert.match(provider, /setActivityMessage\(citizenProgressMessage\(part\.data\.message\)\)/u);
  assert.match(provider, /setError\(presentation\.message, scope\)/u);
  assert.doesNotMatch(provider, /setActivityMessage\(part\.data\.message\)/u);
});

test("el texto generado se limpia también en tablas, gráficas y componentes ciudadanos", () => {
  const renderingBoundaries = [
    read("src/features/generative-ui/table/Table.tsx"),
    read("src/features/generative-ui/visualization/Visualization.tsx"),
    read("src/features/generative-ui/visualization/VisualizationCompiler.ts"),
    read("src/features/generative-ui/visualization/VisualizationDataTable.tsx"),
    read("src/features/generative-ui/primitives/content/Metric.tsx"),
    read("src/features/generative-ui/primitives/content/Badge.tsx"),
    read("src/features/generative-ui/primitives/civic/MexicoChoropleth.tsx"),
    read("src/features/generative-ui/runtime/LayoutRenderer.tsx"),
  ];

  for (const source of renderingBoundaries) assert.match(source, /cleanGeneratedCopy/u);
});
