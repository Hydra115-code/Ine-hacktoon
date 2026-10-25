import assert from "node:assert/strict";
import { type AddressInfo } from "node:net";
import test from "node:test";
import { createSystemApi } from "../src/http/system-api.js";

const documents = {
  capabilities: { schemaVersion: "ccpc-capabilities/v1", catalogVersion: "1.0.0" },
  dataset: { schemaVersion: "ccpc-frontend-metadata/v1", datasetVersion: "1.0.0" },
  release: { schemaVersion: "ccpc-dataset-release/v1", datasetVersion: "1.0.0" },
};

test("publica catálogo, metadatos y release desde el mismo preflight", async (context) => {
  const api = createSystemApi({
    dataReady: true,
    datasetDocuments: documents,
    readCapabilities: () => ({ isAgentReady: true, isMcpReady: true, isDataReady: true }),
  });
  context.after(() => api.close());
  const baseUrl = await listen(api);

  for (const [path, expected] of [
    ["/api/capabilities", documents.capabilities],
    ["/api/dataset", documents.dataset],
    ["/api/release", documents.release],
  ] as const) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  }

  const status = await fetch(`${baseUrl}/api/system/status`);
  assert.equal((await status.json() as { status: string }).status, "ok");
});

test("sin publicación verificada informa estado degradado y no inventa metadatos", async (context) => {
  const api = createSystemApi({ dataReady: false });
  context.after(() => api.close());
  const baseUrl = await listen(api);

  const status = await fetch(`${baseUrl}/api/system/status`);
  assert.equal(status.status, 200);
  const body = await status.json() as { status: string; agent: string; mcp: string };
  assert.deepEqual(
    { status: body.status, agent: body.agent, mcp: body.mcp },
    { status: "degraded", agent: "unavailable", mcp: "unavailable" },
  );

  for (const path of ["/api/capabilities", "/api/dataset", "/api/release"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, "dataset_unavailable");
  }
});

async function listen(api: ReturnType<typeof createSystemApi>): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", resolve);
  });
  const address = api.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
