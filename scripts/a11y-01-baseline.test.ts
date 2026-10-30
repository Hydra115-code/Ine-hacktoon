import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? [...value].map((character) => character.repeat(2)).join("") : value;
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
}

function luminance(hex: string) {
  const channels = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function token(block: string, name: string) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`, "u"));
  assert.ok(match, `No se encontró el token --${name}`);
  return match[1];
}

test("A11Y-01 mantiene contraste AA en los textos y estados principales", () => {
  const colors = read("src/shared/design-system/tokens/colors.css");
  const [light, dark] = colors.split(":root[data-theme=\"dark\"]");
  assert.ok(dark, "Falta el tema oscuro");

  const themes = [
    { name: "claro", block: light, surface: "color-surface-page" },
    { name: "oscuro", block: dark, surface: "color-surface-page" },
  ];
  const readableTokens = [
    "color-text-primary", "color-text-secondary", "color-text-muted", "color-brand-primary",
    "color-civic-accent", "color-status-success", "color-status-warning", "color-status-error", "color-status-info",
  ];

  for (const theme of themes) {
    const background = token(theme.block, theme.surface);
    for (const name of readableTokens) {
      assert.ok(
        contrast(token(theme.block, name), background) >= 4.5,
        `${name} no alcanza 4.5:1 en el tema ${theme.name}`,
      );
    }
    assert.ok(
      contrast(token(theme.block, "color-focus-ring"), background) >= 3,
      `El indicador de foco no alcanza 3:1 en el tema ${theme.name}`,
    );
    assert.ok(
      contrast(token(theme.block, "color-text-on-brand"), token(theme.block, "color-brand-primary")) >= 4.5,
      `El texto sobre la acción principal no alcanza 4.5:1 en el tema ${theme.name}`,
    );
  }
});

test("A11Y-01 conserva un tamaño mínimo legible para texto auxiliar", () => {
  const typography = read("src/shared/design-system/tokens/typography.css");
  assert.match(typography, /--font-size-caption:\s*0\.9375rem/u);
  assert.match(typography, /--font-size-label:\s*1rem/u);

  const chartCompiler = read("src/features/generative-ui/visualization/VisualizationCompiler.ts");
  assert.doesNotMatch(chartCompiler, /fontSize:\s*(?:11|12)\b/u);
  assert.match(chartCompiler, /fontSize:\s*14/u);
});

test("A11Y-01 permite saltar navegación y enfoca destinos reales", () => {
  const publicNav = read("src/features/workspace/components/PublicNav.tsx");
  const appShell = read("src/features/workspace/components/AppShell.tsx");
  const publicPagePaths = ["src/app/page.tsx", "src/app/explorar/page.tsx", "src/app/historias/page.tsx"];
  const base = read("src/shared/design-system/base.css");

  assert.match(publicNav, /className="skip-link" href="#main-content"/u);
  for (const path of publicPagePaths) {
    assert.match(read(path), /id="main-content" tabIndex=\{-1\}/u, `${path} no expone el destino principal`);
  }
  assert.match(appShell, /className="skip-link" href="#workspace-content"/u);
  assert.match(appShell, /id="workspace-content" tabIndex=\{-1\}/u);
  assert.match(base, /\.skip-link:focus-visible[\s\S]*transform:\s*translateY\(0\)/u);
});

test("A11Y-01 conserva foco visible con contraste en controles personalizados", () => {
  const colors = read("src/shared/design-system/tokens/colors.css");
  const base = read("src/shared/design-system/base.css");
  const workspace = read("src/features/workspace/styles/workspace.css");
  const paper = read("src/features/paper/styles/paper.css");
  const civic = read("src/features/generative-ui/styles/civic-primitives.css");

  assert.doesNotMatch(colors, /--color-focus-ring:\s*rgb\([^;]+\/\s*(?:2[0-9]|3[0-9])%\)/u);
  assert.match(base, /:focus-visible\s*\{[\s\S]*outline:\s*3px solid/u);
  assert.match(workspace, /\.composer:focus-within[^{]*\{[^}]*var\(--color-focus-ring\)/u);
  assert.match(workspace, /\.canvas-paper-help-panel__actions button:focus-visible[\s\S]*outline:\s*3px solid var\(--color-focus-ring\)/u);
  assert.match(paper, /\.paper-suggestions li button:focus-visible[\s\S]*?outline:\s*3px solid var\(--color-focus-ring\)/u);
  assert.match(civic, /\.ui-mexico-map__state\[data-selected="true"\]:focus-visible[\s\S]*stroke:\s*var\(--color-focus-ring\)/u);
});

test("A11Y-01 ofrece un único punto de entrada por teclado al mapa", () => {
  const map = read("src/features/generative-ui/primitives/civic/MexicoChoropleth.tsx");
  assert.match(map, /role="group"/u);
  assert.match(map, /const renderedStates = mexicoMapAsset\.states;/u);
  assert.doesNotMatch(map, /renderedStates[^;]*\.sort/u);
  assert.match(map, /tabIndex=\{state\.code === keyboardEntryCode \? 0 : -1\}/u);
  assert.match(map, /event\.key === "ArrowRight"[\s\S]*event\.key === "ArrowLeft"/u);
  assert.match(map, /event\.key === "Enter" \|\| event\.key === " "/u);
  assert.match(map, /aria-live="polite"/u);
  assert.doesNotMatch(map, /role="img"[\s\S]*role="button"/u);
});

test("A11Y-01 mantiene alternativas accesibles y reflujo para zoom", () => {
  const viewport = read("src/app/layout.tsx");
  const visualization = read("src/features/generative-ui/visualization/Visualization.tsx");
  const table = read("src/features/generative-ui/table/Table.tsx");
  const layouts = read("src/features/generative-ui/styles/layout-primitives.css");
  const workspace = read("src/features/workspace/styles/workspace.css");

  assert.doesNotMatch(viewport, /maximumScale|userScalable/u);
  assert.match(visualization, /role="img"/u);
  assert.match(visualization, /<VisualizationDataTable/u);
  assert.match(table, /role="region"[\s\S]*tabIndex=\{0\}/u);
  assert.match(table, /<table aria-label=/u);
  assert.match(table, /aria-sort=/u);
  assert.match(layouts, /@media \(max-width: 40rem\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.match(workspace, /@media \(max-width: 58rem\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
});

test("A11Y-01 respeta movimiento reducido y contraste forzado", () => {
  const base = read("src/shared/design-system/base.css");
  const workspace = read("src/features/workspace/styles/workspace.css");
  const interactions = read("src/features/generative-ui/styles/interactions.css");
  assert.match(base, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(workspace, /@media \(forced-colors: active\)/u);
  assert.match(interactions, /@media \(forced-colors: active\)/u);
});
