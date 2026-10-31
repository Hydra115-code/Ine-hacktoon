import { createHash } from "node:crypto";
import {
  access,
  constants,
  cp,
  mkdtemp,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const isWindows = process.platform === "win32";
export const corepackCommand = isWindows ? "corepack.cmd" : "corepack";
export const gitCommand = isWindows ? "git.exe" : "git";

export function assertSupportedNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!((major === 22 && minor >= 18) || (major === 23 && minor >= 6) || major >= 24)) {
    throw new Error("Se requiere Node.js 22.18+, 23.6+ o 24+.");
  }
}

export function assertCommand(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    shell: isWindows && /\.(cmd|bat)$/iu.test(command),
  });
  if (result.error?.code === "ENOENT") {
    throw new Error(`Falta el comando requerido: ${command.replace(/\.cmd$|\.exe$/u, "")}`);
  }
  if (result.status !== 0) {
    throw new Error(`No se pudo ejecutar ${command}: ${(result.stderr || result.stdout || "error desconocido").trim()}`);
  }
}

export function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
      windowsHide: true,
      shell: isWindows && /\.(cmd|bat)$/iu.test(command),
    });
    child.once("error", (error) => reject(new Error(`No se pudo ejecutar ${printable}: ${error.message}`)));
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${printable} terminó con ${signal ? `señal ${signal}` : `código ${code}`}.`));
    });
  });
}

export async function exists(filename) {
  try {
    await access(filename, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function sha256(filename) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filename);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

export async function prepareDataRelease(root = repositoryRoot) {
  const dataDirectory = path.join(root, "data");
  const archiveName = "Entrega-final-CCPC-1.0.0.zip";
  const archivePath = path.join(dataDirectory, archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const releaseRoot = path.join(root, "data-release");
  const releaseModule = path.join(releaseRoot, "Ine-hacktoon-DATA-06");

  if (await exists(releaseModule)) {
    console.log(`Release de datos disponible: ${path.relative(root, releaseModule)}`);
    return releaseModule;
  }
  for (const requiredFile of [archivePath, checksumPath]) {
    if (!(await exists(requiredFile))) {
      throw new Error(`Falta ${path.relative(root, requiredFile)}.`);
    }
  }
  if (await exists(releaseRoot)) {
    throw new Error(`${releaseRoot} existe pero no contiene el módulo esperado. Revísalo manualmente.`);
  }

  const checksumText = await readFile(checksumPath, "utf8");
  const expected = checksumText.trim().split(/\s+/u)[0]?.toLowerCase();
  const actual = await sha256(archivePath);
  if (!/^[a-f0-9]{64}$/u.test(expected ?? "") || actual !== expected) {
    throw new Error("El archivo de datos no coincide con su checksum SHA-256.");
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "ine-data-release-"));
  try {
    if (isWindows) {
      const escapedArchive = archivePath.replaceAll("'", "''");
      const escapedDestination = temporaryDirectory.replaceAll("'", "''");
      await run("powershell.exe", [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedDestination}' -Force`,
      ]);
    } else {
      assertCommand("unzip", ["-v"]);
      await run("unzip", ["-q", archivePath, "-d", temporaryDirectory]);
    }

    const extractedRoot = path.join(temporaryDirectory, "Entrega-final-CCPC-1.0.0");
    const expectedFiles = [
      path.join(extractedRoot, "Ine-hacktoon-DATA-06", "src", "data", "dataset-v1.ts"),
      path.join(extractedRoot, "Ine-hacktoon-DATA-06", "data", "ccpc", "full", "participation.compact.json"),
    ];
    if (!(await Promise.all(expectedFiles.map(exists))).every(Boolean)) {
      throw new Error("El ZIP verificado no contiene el módulo CCPC esperado.");
    }
    try {
      await rename(extractedRoot, releaseRoot);
    } catch (error) {
      if (error?.code !== "EXDEV") throw error;
      await cp(extractedRoot, releaseRoot, { recursive: true, errorOnExist: true });
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  console.log(`Release de datos preparado: ${path.relative(root, releaseModule)}`);
  return releaseModule;
}

export async function installDataDependencies() {
  const dataRelease = await prepareDataRelease();
  if (!(await exists(path.join(dataRelease, "pnpm-lock.yaml")))) {
    await run(corepackCommand, ["pnpm@12.16.1", "import"], { cwd: dataRelease });
  }
  await run(
    corepackCommand,
    ["pnpm@12.16.1", "install", "--frozen-lockfile", "--ignore-scripts", "--node-linker=hoisted", "--force"],
    { cwd: dataRelease },
  );
  console.log("Dependencias del release de datos instaladas con pnpm.");
}

export async function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (isWindows) {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}
