import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("A11Y-02 ofrece un centro accesible en navegación pública y workspace", () => {
  const center = read("src/shared/design-system/components/AccessibilityCenter.tsx");
  const publicNav = read("src/features/workspace/components/PublicNav.tsx");
  const workspaceHeader = read("src/features/workspace/components/WorkspaceHeader.tsx");

  assert.match(publicNav, /<AccessibilityCenter \/>/u);
  assert.match(workspaceHeader, /<AccessibilityCenter \/>/u);
  assert.match(center, /aria-controls=\{panelId\}/u);
  assert.match(center, /aria-expanded=\{isOpen\}/u);
  assert.match(center, /role="dialog"/u);
  assert.match(center, /event\.key !== "Escape"/u);
  assert.match(center, /triggerRef\.current\?\.focus\(\)/u);
  assert.match(center, /aria-live="polite"/u);
});

test("A11Y-02 controla texto, contraste y movimiento sin afectar datos", () => {
  const center = read("src/shared/design-system/components/AccessibilityCenter.tsx");
  const base = read("src/shared/design-system/base.css");

  assert.match(center, /type="radio"/u);
  assert.match(center, /aria-label="Alto contraste"/u);
  assert.match(center, /aria-label="Reducir movimiento"/u);
  assert.match(center, /role="switch"/u);
  assert.match(center, /Restablecer ajustes/u);
  assert.match(base, /data-a11y-text="large"/u);
  assert.match(base, /data-a11y-text="larger"/u);
  assert.match(base, /data-a11y-contrast="high"/u);
  assert.match(base, /data-a11y-motion="reduced"/u);
});

test("A11Y-02 persiste únicamente preferencias y tolera Storage bloqueado", () => {
  const center = read("src/shared/design-system/components/AccessibilityCenter.tsx");
  assert.match(center, /const STORAGE_KEY = "ine-explora-accessibility"/u);
  assert.match(center, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(preferences\)\)/u);
  assert.match(center, /catch \{[\s\S]*preferencias siguen activas durante la sesión/u);
  assert.equal(center.match(/localStorage\.setItem/gu)?.length, 1);
});

test("A11Y-02 propaga contraste y movimiento a las gráficas y al canvas", () => {
  const visualization = read("src/features/generative-ui/visualization/Visualization.tsx");
  const canvas = read("src/features/workspace/components/GenerativeCanvas.tsx");
  assert.match(visualization, /dataset\.a11yMotion === "reduced"/u);
  assert.match(visualization, /"data-a11y-contrast", "data-a11y-motion"/u);
  assert.match(canvas, /dataset\.a11yMotion === "reduced"/u);
});

test("A11Y-02 conserva reflow y contraste forzado en su panel", () => {
  const styles = read("src/shared/design-system/components/accessibility-center.css");
  assert.match(styles, /width:\s*min\(24rem, calc\(100vw - 2rem\)\)/u);
  assert.match(styles, /\.accessibility-center__panel\s*\{[\s\S]*position:\s*fixed/u);
  assert.match(styles, /max-height:\s*calc\(100dvh - 5\.75rem\)[\s\S]*overflow-y:\s*auto/u);
  assert.match(styles, /@media \(max-width: 36rem\)[\s\S]*left:\s*var\(--space-3\)/u);
  assert.match(styles, /@media \(forced-colors: active\)/u);
  assert.match(styles, /outline:\s*3px solid var\(--color-focus-ring\)/u);
  assert.match(styles, /accessibility-center__trigger\[aria-expanded="true"\]:hover[^{]*\{[^}]*color:\s*var\(--color-text-on-brand\)/u);
});
