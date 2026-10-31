#!/usr/bin/env node

import path from "node:path";
import {
  assertCommand,
  assertSupportedNode,
  corepackCommand,
  gitCommand,
  installDataDependencies,
  repositoryRoot,
  run,
} from "./local-tooling.mjs";

const allowedArguments = new Set(["--verify"]);
const unknown = process.argv.slice(2).filter((argument) => !allowedArguments.has(argument));
if (unknown.length > 0) {
  console.error("Uso: node setup.mjs [--verify]");
  process.exit(2);
}

assertSupportedNode();
assertCommand(corepackCommand);
assertCommand(gitCommand);

console.log("\n[1/5] Preparando los datos oficiales...");
await installDataDependencies();

console.log("\n[2/5] Instalando el backend con pnpm...");
await run(corepackCommand, ["pnpm", "install", "--frozen-lockfile"], {
  cwd: path.join(repositoryRoot, "back-end"),
});

console.log("\n[3/5] Instalando el frontend con pnpm...");
await run(corepackCommand, ["pnpm", "install", "--frozen-lockfile"], {
  cwd: path.join(repositoryRoot, "front-end"),
});

console.log("\n[4/5] Compilando los contratos compartidos...");
await run(corepackCommand, ["pnpm", "contracts:build"], {
  cwd: path.join(repositoryRoot, "back-end"),
});
await run(corepackCommand, ["pnpm", "contracts:build"], {
  cwd: path.join(repositoryRoot, "front-end"),
});

console.log("\n[5/5] Creando y validando la configuración privada...");
await run(process.execPath, [path.join(repositoryRoot, "scripts", "init-local-env.mjs")]);
await run(process.execPath, [path.join(repositoryRoot, "scripts", "check-local-config.mjs")]);
await run(process.execPath, [path.join(repositoryRoot, "scripts", "check-repository-safety.mjs")]);

if (process.argv.includes("--verify")) {
  console.log("\nEjecutando la verificación integral...");
  await run(process.execPath, [path.join(repositoryRoot, "scripts", "verify-all.mjs")]);
}

console.log(`
Instalación local terminada.

Para iniciar el producto completo:
  node start.mjs

Después abre:
  http://127.0.0.1:3000`);
