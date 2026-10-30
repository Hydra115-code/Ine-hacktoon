import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("INT-06 usa autenticación servidor-a-servidor sin exponer el token al navegador", () => {
  const route = read("../src/app/api/agent/route.ts");
  const config = read("../src/features/agent/server/agent-api-config.ts");
  const example = read("../.env.example");
  assert.match(route, /AGENT_SESSION_MODE === "local_service"/u);
  assert.match(route, /!usesLocalServiceSession && !accessToken/u);
  assert.match(route, /\.\.\.\(token \? \{ accessToken: token \} : \{\}\)/u);
  assert.match(config, /import "server-only"/u);
  assert.match(config, /process\.env\.AGENT_API_TOKEN/u);
  assert.match(example, /AGENT_SESSION_MODE=local_service/u);
  assert.doesNotMatch(example, /NEXT_PUBLIC_.*TOKEN/u);
});

test("INT-06 conserva disponible el modo Supabase sin imponerlo al espacio público", () => {
  const route = read("../src/app/api/agent/route.ts");
  const shell = read("../src/features/workspace/components/AppShell.tsx");
  assert.match(route, /refreshSupabaseSession/u);
  assert.match(route, /readSessionCookies\(request\)/u);
  assert.doesNotMatch(shell, /SessionAccessGate/u);
});

test("INT-06 recupera snapshots con el mismo token local server-side", () => {
  const route = read("../src/app/api/agent/snapshot/route.ts");
  assert.match(route, /AGENT_SESSION_MODE === "local_service"/u);
  assert.match(route, /token \?\? config\.token/u);
  assert.match(route, /!usesLocalServiceSession && !accessToken/u);
  assert.doesNotMatch(route, /NEXT_PUBLIC_AGENT_API_TOKEN/u);
});
