import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContextFollowUp,
  requestedContextFields,
  USE_AVAILABLE_DATA_PROMPT,
  WHY_CONTEXT_PROMPT,
} from "../src/features/workspace/presentation/guidance-context.ts";

test("detecta los datos electorales que Paper necesita para continuar", () => {
  assert.deepEqual(
    requestedContextFields("Necesito tu estado, grupo de edad, sexo y año de la elección."),
    ["territory", "age", "sex", "year"],
  );
  assert.deepEqual(requestedContextFields("¿En qué entidad quieres comparar?"), ["territory"]);
});

test("mantiene la aclaración como conversación y sólo analiza por petición explícita", () => {
  assert.match(WHY_CONTEXT_PROMPT, /no hagas el análisis todavía/u);
  assert.match(USE_AVAILABLE_DATA_PROMPT, /Haz el análisis sólo con la información disponible/u);
  assert.match(USE_AVAILABLE_DATA_PROMPT, /No inventes/u);
});

test("la respuesta libre, la explicación y el análisis limitado son alternativas explícitas", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/features/workspace/components/GuidanceContextForm.tsx", import.meta.url), "utf8"),
  );
  assert.match(source, /Responder con mis palabras/u);
  assert.match(source, /¿Por qué lo necesitas\?/u);
  assert.match(source, /Trabaja sólo con lo disponible/u);
  assert.doesNotMatch(source, /\*\*Tu/u);
});

test("construye un seguimiento explícito sin sintaxis Markdown", () => {
  const prompt = buildContextFollowUp({ territory: "Jalisco", age: "20–24", sex: "Mujeres", year: "2024" });
  assert.match(prompt, /estado: Jalisco/u);
  assert.match(prompt, /grupo de edad: 20–24/u);
  assert.match(prompt, /sexo: Mujeres/u);
  assert.match(prompt, /año electoral: 2024/u);
  assert.doesNotMatch(prompt, /[*`#]/u);
});
