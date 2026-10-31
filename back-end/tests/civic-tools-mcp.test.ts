import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CIVIC_TOOL_NAMES, selectAllowedTools } from "../src/agent/civic-tool-policy.js";
import { type CivicDataSource } from "../src/application/ports/civic-data.js";
import { readToolErrorDetails } from "../src/application/tool-error-result.js";
import { ToolRateLimiter } from "../src/application/tool-rate-limiter.js";
import { CivicDataService } from "../src/services/civic-data.service.js";
import { registerCompareElectionsTool } from "../src/tools/compare-elections.tool.js";
import { registerGetParticipationBreakdownTool } from "../src/tools/get-participation-breakdown.tool.js";
import { registerGetParticipationSummaryTool } from "../src/tools/get-participation-summary.tool.js";
import { registerGetSupportingRecordsTool } from "../src/tools/get-supporting-records.tool.js";
import { crearServidor } from "../src/server.js";

async function connect(service = new CivicDataService(), maxCalls = 60) {
  const server = new McpServer({ name: "civic-test", version: "0.0.0" });
  const limiter = new ToolRateLimiter({ maxCalls, windowMs: 60_000 });
  registerGetParticipationSummaryTool(server, service, limiter);
  registerCompareElectionsTool(server, service, limiter);
  registerGetParticipationBreakdownTool(server, service, limiter);
  registerGetSupportingRecordsTool(server, service, limiter);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "civic-test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

test("listTools ofrece exactamente las 4 tools cívicas y ninguna financiera", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...CIVIC_TOOL_NAMES].sort());
  await client.close();
});

test("una tool devuelve JSON con datos de la muestra", async () => {
  const client = await connect();
  const result = await client.callTool({
    name: "get_participation_summary",
    arguments: { year: 2024, entities: ["Aguascalientes"] },
  });
  assert.notEqual(result.isError, true);
  const output = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
  assert.equal(output.scope, "Aguascalientes");
  assert.equal(output.isSampleData, true);
  await client.close();
});

test("entidad desconocida: error amable que no se reintenta", async () => {
  const client = await connect();
  const result = await client.callTool({
    name: "compare_elections",
    arguments: { years: [2018, 2024], entities: ["Atlantis"] },
  });
  assert.equal(result.isError, true);
  assert.match((result.content as Array<{ text: string }>)[0]!.text, /No reconozco la entidad/u);
  assert.deepEqual(readToolErrorDetails(result._meta), { code: "invalid_input", retryable: false });
  await client.close();
});

test("timeout: si la fuente tarda demasiado, corta y permite reintentar", async () => {
  const slowSource: CivicDataSource = {
    getParticipationSummary: () => new Promise(() => {}),
    compareElections: () => new Promise(() => {}),
    getParticipationBreakdown: () => new Promise(() => {}),
    getSupportingRecords: () => new Promise(() => {}),
  };
  const client = await connect(new CivicDataService({ dataSource: slowSource, timeoutMs: 20 }));
  const result = await client.callTool({
    name: "get_supporting_records",
    arguments: { year: 2024 },
  });
  assert.equal(result.isError, true);
  assert.deepEqual(readToolErrorDetails(result._meta), { code: "temporarily_unavailable", retryable: true });
  await client.close();
});

test("rate limit: al pasar el límite responde que se intente más tarde", async () => {
  const client = await connect(new CivicDataService(), 1);
  const args = { year: 2024, dimension: "sexo" };
  const first = await client.callTool({ name: "get_participation_breakdown", arguments: args });
  const second = await client.callTool({ name: "get_participation_breakdown", arguments: args });
  assert.notEqual(first.isError, true);
  assert.equal(second.isError, true);
  assert.deepEqual(readToolErrorDetails(second._meta), { code: "rate_limited", retryable: true });
  await client.close();
});

test("el agente sólo ve tools cívicas aunque el servidor ofrezca otras", () => {
  const definitions = ["get_participation_summary", "compare_elections", "get_accounts", "confirm_payment"]
    .map((name) => ({ name, description: name, inputSchema: { type: "object" } }));
  assert.deepEqual(
    selectAllowedTools(definitions).map((tool) => tool.name),
    ["get_participation_summary", "compare_elections"],
  );
});

test("el servidor ofrece los recursos de referencia cívicos", async () => {
  const server = crearServidor({ client: {} as never, user: { id: "user-a" } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "civic-test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  const { resources } = await client.listResources();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...CIVIC_TOOL_NAMES].sort());
  assert.deepEqual(resources.map((resource) => resource.uri).sort(), ["civic://coverage", "civic://metric-definitions"]);
  await client.close();
});
