import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellFiles = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/conversar/page.tsx",
  "src/features/workspace/components/AppShell.tsx",
  "src/features/workspace/components/WorkspaceHeader.tsx",
  "src/features/workspace/components/ConversationPanel.tsx",
  "src/features/workspace/components/PromptComposer.tsx",
  "src/features/workspace/styles/workspace.css",
];

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("FRONT-01 mantiene el shell visible en lenguaje ciudadano", async () => {
  const forbiddenCopy = /banca personal|tus cuentas|movimientos|an[aá]lisis financiero|datos financieros|ejemplos? de gastos|mensajes? de pagos|beneficiarios?|saldos?|liquidez|banorte/iu;

  for (const path of shellFiles) {
    assert.doesNotMatch(await source(path), forbiddenCopy, `${path} conserva lenguaje financiero visible`);
  }
});

test("el título de Conversar delega el nombre de producto a la plantilla raíz", async () => {
  const route = await source("src/app/conversar/page.tsx");
  const layout = await source("src/app/layout.tsx");

  assert.match(route, /title:\s*"Conversar con Paper"/u);
  assert.match(layout, /template:\s*"%s \| INE Explora"/u);
  assert.doesNotMatch(route, /Conversar con Paper \| INE Explora/u);
});

test("el shell móvil conserva navegación y composición accesibles", async () => {
  const appShell = await source("src/features/workspace/components/AppShell.tsx");
  const header = await source("src/features/workspace/components/WorkspaceHeader.tsx");
  const composer = await source("src/features/workspace/components/PromptComposer.tsx");
  const css = await source("src/features/workspace/styles/workspace.css");

  assert.match(appShell, /role="tablist"/u);
  assert.match(appShell, /aria-orientation="horizontal"/u);
  assert.match(appShell, /aria-controls="conversation-pane"/u);
  assert.match(appShell, /aria-controls="result-pane"/u);
  assert.doesNotMatch(appShell, /SessionAccessGate/u);
  assert.doesNotMatch(appShell, /<WorkspaceHeader\s+onSignOut/u);
  assert.match(header, /\{onSignOut \? .*Salir.*: null\}/u);
  assert.match(composer, /aria-describedby="civic-prompt-guidance"/u);
  assert.match(css, /\.workspace\s*\{\s*grid-template-rows:\s*auto minmax\(0, 1fr\);/u);
});

test("Paper se renderiza únicamente con recursos 2D", async () => {
  const avatar = await source("src/features/paper/components/PaperAvatar.tsx");
  const packageJson = await source("package.json");

  assert.match(avatar, /\/paper\/paper_front\.png/u);
  assert.match(avatar, /\/paper\/glasses-expressions\.png/u);
  assert.doesNotMatch(avatar, /use3D|\.glb|PaperScene/u);
  assert.doesNotMatch(packageJson, /@react-three\/fiber|@types\/three|"three"/u);
});

test("Paper usa una sola mano articulada para todos sus estados", async () => {
  const avatar = await source("src/features/paper/components/PaperAvatar.tsx");
  const css = await source("src/features/paper/styles/paper.css");

  assert.equal(avatar.match(/<PaperHand\b/gu)?.length, 1);
  assert.match(avatar, /hand:\s*\{/u);
  assert.doesNotMatch(avatar, /pose\.left|pose\.right|paper-sprite__hand--left/u);
  assert.match(css, /paper-sprite__hand--active/u);
  assert.doesNotMatch(css, /paper-sprite__hand--left|paper-sprite__hand--right/u);
});

test("el cierre de QA de FE-0 conserva tablas legibles y búsqueda compacta de entidades", async () => {
  const onboarding = await source("src/features/onboarding/components/OnboardingModal.tsx");
  const onboardingCss = await source("src/features/onboarding/styles/onboarding.css");
  const tableCss = await source("src/features/generative-ui/styles/table.css");
  const workspaceCss = await source("src/features/workspace/styles/workspace.css");

  assert.match(onboarding, /type="search"/u);
  assert.match(onboarding, /role="combobox"/u);
  assert.match(onboarding, /normalizeTerritorySearch/u);
  assert.match(onboarding, /role="listbox"/u);
  assert.match(onboardingCss, /\.onboarding-state-options/u);
  assert.doesNotMatch(onboardingCss, /font-size:\s*clamp\(1\.8rem,\s*4vw,\s*3\.3rem\)/u);
  assert.match(tableCss, /text-align:\s*justify/u);
  assert.match(workspaceCss, /\.canvas-guidance[^}]+font-size:\s*clamp\(1\.125rem/u);
});

test("el catálogo GenUI existente comparte la identidad editorial de INE Explora", async () => {
  const contentCss = await source("src/features/generative-ui/styles/content-primitives.css");
  const layoutCss = await source("src/features/generative-ui/styles/layout-primitives.css");
  const tableCss = await source("src/features/generative-ui/styles/table.css");
  const visualizationCss = await source("src/features/generative-ui/styles/visualization.css");
  const interactionsCss = await source("src/features/generative-ui/styles/interactions.css");

  assert.match(contentCss, /--ui-editorial-shadow/u);
  assert.match(contentCss, /\.ui-metric[^}]+border-top:\s*3px solid/u);
  assert.match(contentCss, /\.ui-evidence-notice--source strong/u);
  assert.match(layoutCss, /\.ui-section--surface-elevated[^}]+border-top:\s*3px solid/u);
  assert.match(tableCss, /\.ui-table__viewport[^}]+var\(--ui-editorial-shadow/u);
  assert.match(visualizationCss, /\.ui-visualization[^}]+var\(--ui-editorial-shadow-accent/u);
  assert.match(interactionsCss, /\.ui-control-button--primary[^}]+box-shadow/u);
});
