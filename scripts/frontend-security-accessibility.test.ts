import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { auditUISpecificationAccessibility } from "../src/features/generative-ui/accessibility/audit-ui-accessibility.ts";
import { ineParticipationSpecification } from "../src/features/generative-ui/fixtures/ine-participation-fixture.ts";
import { createUIPatchState } from "../src/features/generative-ui/patches/ui-patch-engine.ts";
import { cleanGeneratedCopy } from "../src/features/generative-ui/primitives/content/clean-generated-copy.ts";
import { buildContentSecurityPolicy } from "../src/shared/security/content-security-policy.ts";
import { MAX_AGENT_REQUEST_BYTES } from "../src/shared/security/request-limits.ts";
import { shouldExposeRuntimeDiagnostics } from "../src/shared/security/runtime-diagnostics-visibility.ts";

const frontendRoot = new URL("../src/", import.meta.url);

test("la copia ciudadana oculta etiquetas internas y traduce términos de evidencia", () => {
  assert.equal(cleanGeneratedCopy("**OBSERVED:** Participación verificada."), "Participación verificada.");
  assert.equal(
    cleanGeneratedCopy("SIMULATED: numerator 50 de denominator 100."),
    "Escenario simulado: personas que votaron 50 de lista nominal 100.",
  );
  assert.equal(
    cleanGeneratedCopy("Compara resultados por partido y partidos políticos."),
    "Compara participación por territorio y opciones electorales.",
  );
  assert.doesNotMatch(cleanGeneratedCopy("Resultados por partido"), /partido/iu);
});

test("los diagnósticos internos sólo se exponen en desarrollo explícito", () => {
  assert.equal(shouldExposeRuntimeDiagnostics("development"), false);
  assert.equal(shouldExposeRuntimeDiagnostics("development", true), true);
  assert.equal(shouldExposeRuntimeDiagnostics("production", true), false);
});

test("la CSP de producción bloquea código y superficies externas", () => {
  const policy = buildContentSecurityPolicy("nonce-de-prueba", false);
  for (const directive of [
    "default-src 'self'", "script-src-attr 'none'", "object-src 'none'", "frame-src 'none'",
    "base-uri 'none'", "frame-ancestors 'none'", "connect-src 'self'", "upgrade-insecure-requests",
  ]) assert.match(policy, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/u);
});

test("el proxy frontend respeta el límite actual de 16 KiB", () => {
  assert.equal(MAX_AGENT_REQUEST_BYTES, 16_384);
  const route = readFileSync(new URL("../src/app/api/agent/route.ts", import.meta.url), "utf8");
  assert.match(route, /MAX_AGENT_REQUEST_BYTES/u);
  assert.match(route, /TextEncoder\(\)\.encode\(body\)\.byteLength/u);
});

test("la vista contractual INE no presenta faltantes de accesibilidad", () => {
  const state = createUIPatchState(ineParticipationSpecification);
  assert.equal(state.success, true);
  if (state.success) assert.deepEqual(auditUISpecificationAccessibility(state.state.specification), []);
});

test("el runtime no usa HTML ejecutable ni persiste datos en localStorage", () => {
  const files = [
    "features/generative-ui/renderer/UIRenderer.tsx",
    "features/generative-ui/runtime/LayoutRenderer.tsx",
    "features/agent/session/session-snapshot-storage.ts",
  ];
  const source = files.map((path) => readFileSync(new URL(path, frontendRoot), "utf8")).join("\n");
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|\beval\s*\(|new Function|localStorage/u);
});

test("la transcripción requiere sesión y no acepta tokens estáticos", () => {
  const route = readFileSync(new URL("../src/app/api/transcription/realtime-session/route.ts", import.meta.url), "utf8");
  assert.match(route, /readSessionCookies\(request\)/u);
  assert.match(route, /refreshSupabaseSession\(cookies\.refreshToken\)/u);
  assert.doesNotMatch(route, /AGENT_API_TOKEN|SUPABASE_ACCESS_TOKEN/u);
});
