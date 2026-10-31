#!/usr/bin/env node

import { corepackCommand, prepareDataRelease, run } from "./local-tooling.mjs";

const dataRelease = await prepareDataRelease();
const pnpm = (...args) => run(
  corepackCommand,
  ["pnpm@12.16.1", "--config.node-linker=hoisted", ...args],
  { cwd: dataRelease },
);

await pnpm("run", "ccpc:verify-delivery");
await pnpm("run", "typecheck");
await pnpm("test");
await pnpm("run", "ccpc:validate", "--input", "data/ccpc/sample/data02/participation.json");
await pnpm("run", "ccpc:full:verify");
await pnpm("run", "ccpc:full:audit");
await pnpm("run", "ccpc:catalog:verify");
await pnpm("run", "ccpc:catalog:audit");
await pnpm("run", "ccpc:release:verify");
await pnpm("run", "ccpc:release:audit");
await pnpm("run", "ccpc:privacy:audit");

console.log("Verificación del release de datos: OK");
