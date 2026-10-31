#!/usr/bin/env node

const services = [
  { name: "backend", url: "http://127.0.0.1:3101/api/system/status" },
  { name: "frontend", url: "http://127.0.0.1:3000/api/system/status" },
];
for (const service of services) {
  const deadline = Date.now() + 90_000;
  let lastError = "sin respuesta";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(service.url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2_000),
      });
      const payload = await response.json().catch(() => undefined);
      if (response.ok && payload?.status === "ok") {
        console.log(`${service.name}: listo`);
        lastError = "";
        break;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (lastError) {
    console.error(`ERROR: ${service.name} no inició a tiempo (${lastError}).`);
    process.exit(1);
  }
}
