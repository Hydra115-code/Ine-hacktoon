import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  VERIFIED_STORY_AUDIENCE,
  VERIFIED_STORY_CHAPTERS,
  VERIFIED_STORY_MESSAGE,
} from "../src/features/electoral-story/verified-story-journey.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("la historia define un mensaje, una audiencia y tres capítulos distintos", () => {
  assert.ok(VERIFIED_STORY_MESSAGE.length >= 80);
  assert.match(VERIFIED_STORY_AUDIENCE, /ciudadan|personas/u);
  assert.equal(VERIFIED_STORY_CHAPTERS.length, 3);
  assert.equal(new Set(VERIFIED_STORY_CHAPTERS.map(({ id }) => id)).size, 3);
  assert.equal(new Set(VERIFIED_STORY_CHAPTERS.map(({ prompt }) => prompt)).size, 3);
});

test("cada capítulo exige evidencia y evita conclusiones no sustentadas", () => {
  for (const chapter of VERIFIED_STORY_CHAPTERS) {
    assert.match(chapter.prompt, /fuente|evidencia/u, `${chapter.id} debe pedir evidencia`);
    assert.match(chapter.prompt, /limitaciones|advertencias metodológicas/u, `${chapter.id} debe explicar límites`);
    assert.match(chapter.prompt, /no (?:atribuyas|juzgar|hagas)|sin (?:juzgar|inventar)/iu, `${chapter.id} debe impedir sobreinterpretaciones`);
    assert.doesNotMatch(chapter.prompt, /\b\d+(?:[.,]\d+)?\s*%/u, `${chapter.id} no debe fijar resultados`);
  }
});

test("la página precarga el capítulo en Paper y conserva accesibilidad básica", () => {
  const component = read("src/features/electoral-story/components/VerifiedStoryPage.tsx");
  const styles = read("src/features/electoral-story/styles/verified-story.css");
  const navigation = read("src/features/workspace/components/PublicNav.tsx");
  assert.match(component, /setDraft\(chapter\.prompt\)[\s\S]*router\.push\("\/conversar"\)/u);
  assert.match(component, /aria-labelledby="verified-story-title"/u);
  assert.match(component, /id="main-content" tabIndex=\{-1\}/u);
  assert.match(navigation, /href="\/historias"[\s\S]*Historia guiada/u);
  assert.match(styles, /@media \(max-width: 44rem\)/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
});
