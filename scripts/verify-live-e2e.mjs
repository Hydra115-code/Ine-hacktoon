#!/usr/bin/env node

const backendBaseUrl = process.env.INE_BACKEND_BASE_URL ?? "http://127.0.0.1:3101";
const frontendBaseUrl = process.env.INE_FRONTEND_BASE_URL ?? "http://127.0.0.1:3000";
const requestTimeoutMs = 130_000;

const expectedReadyServices = ["backend", "agent", "mcp"];

async function readReadyStatus(label, url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok || !payload || payload.status !== "ok") {
    throw new Error(`${label} no está listo (${response.status}).`);
  }
  for (const service of expectedReadyServices) {
    if (payload[service] !== "ready") {
      throw new Error(`${label} reportó ${service}=${String(payload[service])}.`);
    }
  }
  return payload;
}

function parseUiMessageStream(raw) {
  const events = [];
  for (const line of raw.split(/\r?\n/u)) {
    if (!line.startsWith("data: ")) continue;
    const value = line.slice("data: ".length).trim();
    if (!value || value === "[DONE]") continue;
    events.push(JSON.parse(value));
  }
  return events;
}

function countEventTypes(events) {
  return Object.fromEntries(
    [...new Set(events.map((event) => event.type))]
      .sort()
      .map((type) => [type, events.filter((event) => event.type === type).length]),
  );
}

async function verifyCitizenQuery() {
  const response = await fetch(`${frontendBaseUrl}/api/agent`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{
        id: `e2e-user-${crypto.randomUUID()}`,
        role: "user",
        parts: [{
          type: "text",
          text: "Compara la participación nacional entre 2018 y 2024 y muéstrala en una gráfica.",
        }],
      }],
      submittedAt: Date.now(),
    }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`La consulta end-to-end falló (${response.status}).`);
  if (!response.headers.get("content-type")?.startsWith("text/event-stream")) {
    throw new Error("El frontend no devolvió el stream de UI esperado.");
  }

  const events = parseUiMessageStream(raw);
  const eventTypes = countEventTypes(events);
  const errors = events.filter((event) => event.type === "data-agentError");
  const text = events
    .filter((event) => event.type === "text-delta")
    .map((event) => event.delta ?? "")
    .join("");
  const uiStart = events.find((event) => event.type === "data-uiStarted" || event.type === "data-ui");
  const uiCompleted = events.some((event) => event.type === "data-uiCompleted");
  const hasOfficialData = events.some((event) => event.type === "data-dataPatch");

  if (errors.length > 0) throw new Error("El agente devolvió un error durante la consulta.");
  if (!text.trim()) throw new Error("La consulta no devolvió una respuesta en texto.");
  if (!hasOfficialData) throw new Error("La consulta no enlazó datos oficiales.");
  if (!uiStart || !uiCompleted) throw new Error("La interfaz generativa no llegó a completarse.");

  return {
    correlationId: response.headers.get("x-correlation-id"),
    sessionId: response.headers.get("x-session-id"),
    eventTypes,
    textCharacters: text.length,
    uiRootType: uiStart.data?.specification?.root?.type ?? null,
    uiCompleted,
  };
}

try {
  const backend = await readReadyStatus("Backend", `${backendBaseUrl}/api/system/status`);
  const frontend = await readReadyStatus("Frontend", `${frontendBaseUrl}/api/system/status`);
  if (backend.contractFingerprint !== frontend.contractFingerprint) {
    throw new Error("El frontend no confirmó el contrato publicado por el backend.");
  }
  const query = await verifyCitizenQuery();
  console.log(JSON.stringify({
    result: "ok",
    contractFingerprint: backend.contractFingerprint,
    services: { backend: backend.status, frontend: frontend.status },
    query,
  }, null, 2));
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
