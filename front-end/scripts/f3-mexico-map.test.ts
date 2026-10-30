import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dataRegistrySchema, uiSpecificationSchema } from "@ine/contracts";
import {
  f3MexicoMapData,
  f3MexicoMapRows,
  f3MexicoMapSpecification,
} from "../src/features/generative-ui/fixtures/f3-mexico-map-fixture.ts";

const mapAsset = JSON.parse(readFileSync(new URL(
  "../src/features/generative-ui/geography/mexico-states.paths.json",
  import.meta.url,
), "utf8")) as { source: string; sourceUrl: string; states: Array<{ code: string; name: string; path: string }> };
const componentSource = readFileSync(new URL(
  "../src/features/generative-ui/primitives/civic/MexicoChoropleth.tsx",
  import.meta.url,
), "utf8");

test("F3 conserva una geometría oficial, local y completa de México", () => {
  assert.equal(mapAsset.states.length, 32);
  assert.equal(new Set(mapAsset.states.map((state) => state.code)).size, 32);
  assert.deepEqual(mapAsset.states.map((state) => state.code), Array.from({ length: 32 }, (_, index) => String(index + 1).padStart(2, "0")));
  assert.equal(mapAsset.states.every((state) => state.path.startsWith("M") && state.path.endsWith("Z")), true);
  assert.match(mapAsset.source, /INEGI.*Marco Geoestadístico/u);
  assert.equal(mapAsset.sourceUrl, "https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgee/");
});

test("F3 valida el nodo mexicoChoropleth y su registro de datos", () => {
  assert.equal(uiSpecificationSchema.safeParse(f3MexicoMapSpecification).success, true);
  assert.equal(dataRegistrySchema.safeParse(f3MexicoMapData).success, true);
  assert.equal(f3MexicoMapRows.length, 32);
  assert.equal(new Set(f3MexicoMapRows.map((row) => row.entityCode)).size, 32);
  assert.match(JSON.stringify(f3MexicoMapSpecification), /map\.entity_selected/u);
});

test("F3 ofrece búsqueda, mapa SVG, zoom, filtro por rangos y tabla alternativa", () => {
  assert.match(componentSource, /type="search"/u);
  assert.match(componentSource, /<svg/u);
  assert.match(componentSource, /ZOOM_LEVELS/u);
  assert.match(componentSource, /activeFilter/u);
  assert.match(componentSource, /Filtrar entidades sin dato/u);
  assert.match(componentSource, /Ver los datos del mapa en tabla/u);
  assert.match(componentSource, /<table>/u);
});

test("F3 permite seleccionar las entidades con teclado y emitir intención", () => {
  assert.match(componentSource, /role="button"/u);
  assert.match(componentSource, /tabIndex=\{0\}/u);
  assert.match(componentSource, /ArrowRight/u);
  assert.match(componentSource, /ArrowLeft/u);
  assert.match(componentSource, /emitSelection\(code\)/u);
});

test("F3 mantiene separados la geometría y los valores electorales", () => {
  const serializedGeometry = JSON.stringify(mapAsset);
  assert.doesNotMatch(serializedGeometry, /participation|votesObserved|nominalList/u);
  assert.match(JSON.stringify(f3MexicoMapData), /Valores sintéticos/u);
  assert.doesNotMatch(componentSource, /STATE_TURNOUT_DATA/u);
});
