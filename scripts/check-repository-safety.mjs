#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { gitCommand, repositoryRoot } from "./local-tooling.mjs";
import { spawnSync } from "node:child_process";

const result = spawnSync(gitCommand, ["ls-files", "-z"], {
  cwd: repositoryRoot,
  encoding: "buffer",
  windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr.toString("utf8").trim() || "No se pudo consultar Git.");

const trackedFiles = result.stdout.toString("utf8").split("\0").filter(Boolean);
const failures = [];
const localArtifact = /(^|\/)(node_modules|\.next|dist|coverage|\.local)(\/|$)|\.(sqlite|sqlite-shm|sqlite-wal|db)$/u;
const secretPattern = /AIza[0-9A-Za-z_-]{30,}|github_pat_[0-9A-Za-z_]{20,}|gh[pousr]_[0-9A-Za-z]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}/u;

for (const trackedFile of trackedFiles) {
  const normalized = trackedFile.replaceAll("\\", "/");
  const basename = path.posix.basename(normalized);
  const isEnvironment = basename === ".env" || basename.startsWith(".env.");
  const isTemplate = basename.endsWith(".example");
  if (isEnvironment && !isTemplate) failures.push(`archivo de entorno rastreado: ${trackedFile}`);
  if (localArtifact.test(normalized)) failures.push(`artefacto local rastreado: ${trackedFile}`);

  const contents = await readFile(path.join(repositoryRoot, trackedFile));
  if (!contents.includes(0) && secretPattern.test(contents.toString("utf8"))) {
    failures.push(`posible secreto en archivo rastreado: ${trackedFile}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Seguridad del repositorio: OK");
}
