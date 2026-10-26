import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("la tabla compacta conserva palabras y densidad en pantallas angostas", () => {
  const styles = source("src/features/generative-ui/styles/table.css");

  assert.match(styles, /\.ui-table\[data-column-count="3"\] table\s*\{[^}]*min-width:\s*32rem;[^}]*table-layout:\s*fixed;/u);
  assert.match(styles, /\.ui-table\[data-column-count="3"\] th,[\s\S]*?td\s*\{[^}]*overflow-wrap:\s*break-word;/u);
  assert.match(styles, /\.ui-table__status\s*\{[^}]*white-space:\s*nowrap;/u);
  assert.doesNotMatch(styles, /\.ui-table\[data-column-count="3"\][^{]*\{[^}]*min-width:\s*0;/u);
});

test("el desbordamiento de datos permanece dentro del componente", () => {
  const table = source("src/features/generative-ui/table/Table.tsx");
  const styles = source("src/features/generative-ui/styles/table.css");

  assert.match(table, /className="ui-table__viewport"[\s\S]*?role="region"[\s\S]*?tabIndex=\{0\}/u);
  assert.match(styles, /\.ui-table__viewport\s*\{[^}]*max-width:\s*100%;[^}]*overflow:\s*auto;/u);
  assert.match(styles, /@media \(max-width:\s*40rem\)[\s\S]*?\.ui-table__pagination\s*\{[^}]*flex-direction:\s*column;/u);
});

test("las densidades cómoda y compacta mantienen ritmos distintos", () => {
  const styles = source("src/features/generative-ui/styles/table.css");

  assert.match(styles, /\.ui-table th,[\s\S]*?\.ui-table td\s*\{[^}]*padding:\s*var\(--space-3\) var\(--space-4\);/u);
  assert.match(styles, /\.ui-table--compact th,[\s\S]*?\.ui-table--compact td\s*\{[^}]*padding-block:\s*var\(--space-2\);/u);
  assert.match(styles, /@media \(min-width:\s*90rem\)[\s\S]*?\.ui-table--compact th,[\s\S]*?padding-block:\s*0\.7rem;/u);
});

test("el justificado se reserva para texto narrativo", () => {
  const component = source("src/features/generative-ui/table/Table.tsx");
  const styles = source("src/features/generative-ui/styles/table.css");

  assert.match(component, /const narrativeColumnPattern/u);
  assert.match(component, /column\.format === undefined \|\| column\.format === "text"/u);
  assert.match(component, /className=\{tableCellClass\(column\)\}/u);
  assert.match(styles, /\.ui-table tbody \.ui-table__cell--start\s*\{[^}]*text-align:\s*start;/u);
  assert.match(styles, /\.ui-table tbody \.ui-table__cell--narrative\s*\{[^}]*text-align:\s*justify;/u);
});
