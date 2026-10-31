#!/usr/bin/env node

import path from "node:path";
import {
  assertCommand,
  assertSupportedNode,
  corepackCommand,
  installDataDependencies,
  prepareDataRelease,
  repositoryRoot,
  run,
} from "./local-tooling.mjs";

const allowedArguments = new Set(["--install"]);
const unknown = process.argv.slice(2).filter((argument) => !allowedArguments.has(argument));
if (unknown.length > 0) {
  console.error("Uso: node verify.mjs [--install]");
  process.exit(2);
}

assertSupportedNode();
assertCommand(corepackCommand);
await run(process.execPath, [path.join(repositoryRoot, "scripts", "check-repository-safety.mjs")]);
await prepareDataRelease();
await run(process.execPath, [path.join(repositoryRoot, "scripts", "check-local-config.mjs")]);

if (process.argv.includes("--install")) {
  await installDataDependencies();
  await run(corepackCommand, ["pnpm", "install", "--frozen-lockfile"], {
    cwd: path.join(repositoryRoot, "back-end"),
  });
  await run(corepackCommand, ["pnpm", "install", "--frozen-lockfile"], {
    cwd: path.join(repositoryRoot, "front-end"),
  });
}

await run(process.execPath, [path.join(repositoryRoot, "scripts", "verify-data.mjs")]);
await run(process.execPath, ["--test", path.join(repositoryRoot, "scripts", "contract-fingerprint-portability.test.mjs")]);
await run(corepackCommand, ["pnpm", "int-08:verify"], { cwd: path.join(repositoryRoot, "back-end") });
await run(corepackCommand, ["pnpm", "int-08:verify"], { cwd: path.join(repositoryRoot, "front-end") });

console.log("Verificación integral: OK");
