import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const retiredPublicRoutes = ["src/app/explorar/page.tsx"] as const;

test("las rutas editoriales con maquetas ya no publican cifras demostrativas", () => {
  for (const path of retiredPublicRoutes) {
    const source = read(path);
    assert.match(source, /redirect\("\/conversar"\)/u, `${path} debe dirigir al flujo CCPC verificado`);
    assert.doesNotMatch(source, /civic-data-fixtures|STATE_TURNOUT_DATA|AGE_GROUP_DATA|GENDER_TURNOUT_DATA/u);
    assert.doesNotMatch(source, /\b\d+(?:[.,]\d+)?\s*%/u);
  }
});

test("las entradas públicas activas no importan fixtures cívicos", () => {
  for (const path of ["src/app/page.tsx", "src/app/conversar/page.tsx", "src/app/historias/page.tsx"] as const) {
    assert.doesNotMatch(read(path), /civic-data-fixtures/u, path);
  }
});

test("la historia pública abre el recorrido verificado sin anticipar resultados", () => {
  const page = read("src/app/historias/page.tsx");
  const story = read("src/features/electoral-story/components/VerifiedStoryPage.tsx");
  assert.match(page, /<VerifiedStoryPage/u);
  assert.match(story, /setDraft\(chapter\.prompt\)/u);
  assert.match(story, /router\.push\("\/conversar"\)/u);
  assert.doesNotMatch(story, /\b\d+(?:[.,]\d+)?\s*%/u);
});

test("el recorrido público conserva como destino el backend verificado", () => {
  const home = read("src/app/page.tsx");
  const conversation = read("src/app/conversar/page.tsx");
  const appShell = read("src/features/workspace/components/AppShell.tsx");
  assert.match(home, /router\.push\("\/conversar"\)/u);
  assert.match(conversation, /<AppShell/u);
  assert.match(appShell, /<AgentSessionProvider/u);
});
