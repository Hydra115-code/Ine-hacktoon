import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const coreFiles = [
  "package.json",
  "packages/contracts/package.json",
  "packages/contracts/src/index.ts",
  "packages/contracts/src/protocol.ts",
  "packages/contracts/src/generative-ui/schemas/content-node.ts",
  "src/features/agent/planner/ui-planner.ts",
  "src/features/agent/interactions/interaction-policy.ts",
  "src/features/agent/interactions/form-submission.ts",
  "src/features/workspace/state/experience-state-machine.ts",
  "src/features/agent/session/session-snapshot-storage.ts",
  "src/features/generative-ui/degradation/build-generic-ui.ts",
  "src/features/generative-ui/data-binding/formatting/format-data-value.ts",
  "src/features/generative-ui/data-binding/formatting/mask-sensitive-identifier.ts",
  "src/features/generative-ui/visualization/VisualizationCompiler.ts",
  "src/features/generative-ui/visualization/VisualizationDataTable.tsx",
];

const forbidden = [
  /@banorte\/contracts/u,
  /financial\.(?:positive|negative|neutral|warning)/u,
  /banorte:/u,
  /PAYMENT_(?:CONFIRMATION_REQUIRED|CONFIRMED|COMPLETED)/u,
  /\bPaymentStatus\b/u,
  /financial_action/u,
  /mask-financial-identifier/u,
];

test("FRONT-02 mantiene el runtime principal libre de contratos bancarios", async () => {
  for (const path of coreFiles) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${path} contiene ${pattern}`);
    }
  }
});

test("el entrypoint contractual sólo publica primitivas neutrales", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../packages/contracts/package.json", import.meta.url), "utf8"));
  const index = await readFile(new URL("../packages/contracts/src/index.ts", import.meta.url), "utf8");
  assert.equal(packageJson.name, "@ine/contracts");
  assert.doesNotMatch(index, /financial-domain|fixtures/u);
  assert.equal(packageJson.exports["./legacy-financial"].import, "./dist/legacy/financial-protocol.js");
});
