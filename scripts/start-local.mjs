#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import {
  corepackCommand,
  exists,
  isWindows,
  repositoryRoot,
  run,
  terminateProcessTree,
} from "./local-tooling.mjs";

const requiredPaths = [
  path.join(repositoryRoot, "back-end", ".env"),
  path.join(repositoryRoot, "front-end", ".env.local"),
  path.join(repositoryRoot, "back-end", "node_modules"),
  path.join(repositoryRoot, "front-end", "node_modules"),
  path.join(repositoryRoot, "data-release", "Ine-hacktoon-DATA-06"),
];
for (const requiredPath of requiredPaths) {
  if (!(await exists(requiredPath))) {
    throw new Error("La instalación local está incompleta. Ejecuta primero: node setup.mjs");
  }
}

await run(process.execPath, [path.join(repositoryRoot, "scripts", "check-local-config.mjs")]);

console.log("Preparando contratos compartidos...");
await run(corepackCommand, ["pnpm", "contracts:build"], {
  cwd: path.join(repositoryRoot, "back-end"),
});
await run(corepackCommand, ["pnpm", "contracts:build"], {
  cwd: path.join(repositoryRoot, "front-end"),
});

const children = [];
let shuttingDown = false;

function startService(name, directory, script) {
  console.log(`Iniciando ${name}...`);
  const child = spawn(corepackCommand, ["pnpm", script], {
    cwd: directory,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
    detached: !isWindows,
    shell: isWindows,
  });
  children.push(child);
  return {
    child,
    completion: new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ name, code, signal }));
    }),
  };
}

async function stopAll(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all(children.map(terminateProcessTree));
  process.exitCode = exitCode;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => void stopAll(0));
}

const backend = startService("backend", path.join(repositoryRoot, "back-end"), "api");
const frontend = startService("frontend", path.join(repositoryRoot, "front-end"), "dev");

try {
  await run(process.execPath, [path.join(repositoryRoot, "scripts", "wait-for-local-services.mjs")]);
  console.log(`
INE Explora con Paper está listo:
  http://127.0.0.1:3000

Presiona Ctrl+C para cerrar frontend y backend.`);

  const ended = await Promise.race([backend.completion, frontend.completion]);
  if (!shuttingDown) {
    console.error(`${ended.name} se cerró${ended.signal ? ` por ${ended.signal}` : ` con código ${ended.code}`}.`);
    await stopAll(ended.code || 1);
  }
} catch (error) {
  await stopAll(1);
  throw error;
}
