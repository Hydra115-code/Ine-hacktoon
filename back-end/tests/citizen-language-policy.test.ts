import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("los eventos públicos del agente no exponen vocabulario de implementación", () => {
  const source = [
    read("src/agent/orchestrator.ts"),
    read("src/http/system-api.ts"),
    read("src/integration/text-agent-service.ts"),
  ].join("\n");
  const messages = [...source.matchAll(/message:\s*"([^"]+)"/gu)].map((match) => match[1]);
  const forbidden = /\b(?:MCP|interfaz|UI|planificador|provider|backend|patch|revisi[oó]n|herramienta|contrato|schema|binding|payload|runtime)\b/iu;

  assert.ok(messages.length > 0);
  for (const message of messages) assert.doesNotMatch(message, forbidden);
});

test("los errores del agente siempre explican el problema como una acción ciudadana", () => {
  const orchestrator = read("src/agent/orchestrator.ts");
  assert.match(orchestrator, /Me falta información para responder con confianza/u);
  assert.match(orchestrator, /No pude consultar una de las fuentes necesarias/u);
  assert.match(orchestrator, /Paper no pudo terminar esta consulta/u);
  assert.doesNotMatch(orchestrator, /message:\s*error\.message/u);
});

test("las selecciones visuales no invocan al modelo aunque lleguen al backend", () => {
  const service = read("src/integration/text-agent-service.ts");
  assert.match(service, /timeline\\\.period_selected/u);
  assert.match(service, /Interacción visual resuelta localmente sin invocar al modelo/u);
  assert.match(service, /yield event\(\{ type: "completed" \}\)/u);
});
