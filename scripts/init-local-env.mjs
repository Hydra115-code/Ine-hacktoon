#!/usr/bin/env node

import { chmod, copyFile } from "node:fs/promises";
import path from "node:path";
import { exists, gitCommand, isWindows, repositoryRoot, run } from "./local-tooling.mjs";

const files = [
  [path.join(repositoryRoot, "back-end", ".env.example"), path.join(repositoryRoot, "back-end", ".env")],
  [path.join(repositoryRoot, "front-end", ".env.example"), path.join(repositoryRoot, "front-end", ".env.local")],
];

for (const [template, destination] of files) {
  const relative = path.relative(repositoryRoot, destination);
  if (await exists(destination)) {
    console.log(`Conservado: ${relative} ya existe.`);
  } else {
    await copyFile(template, destination);
    if (!isWindows) await chmod(destination, 0o600);
    console.log(`Creado: ${relative}`);
  }
  try {
    await run(gitCommand, ["check-ignore", "--quiet", relative], { cwd: repositoryRoot, stdio: "ignore" });
  } catch {
    throw new Error(`Git no está ignorando ${relative}.`);
  }
}

await run(process.execPath, [path.join(repositoryRoot, "scripts", "configure-local-env.mjs")]);

console.log(`
Configuración local conectada.
- Se generó o conservó un AGENT_API_TOKEN privado y se sincronizó sin mostrarlo.
- GEMINI_API_KEY pertenece únicamente a back-end/.env.
- No modifiques las plantillas .env.example con valores reales.`);
