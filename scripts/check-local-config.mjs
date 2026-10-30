import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDirectory = path.join(repositoryRoot, "back-end");
const backendFile = path.join(backendDirectory, ".env");
const frontendFile = path.join(repositoryRoot, "front-end", ".env.local");

const [backendText, frontendText] = await Promise.all([
  readFile(backendFile, "utf8"),
  readFile(frontendFile, "utf8"),
]);
const backend = parseEnv(backendText);
const frontend = parseEnv(frontendText);

await assertPrivate(backendFile, "back-end/.env");
await assertPrivate(frontendFile, "front-end/.env.local");
assertNoPublicSecrets(backend, "back-end/.env");
assertNoPublicSecrets(frontend, "front-end/.env.local");

expect(backend, "AUTH_MODE", "local_sqlite", "backend");
expect(backend, "CCPC_DATA_DIR", "../data-release/Ine-hacktoon-DATA-06", "backend");
expect(backend, "CCPC_DATASET_PATH", "data/ccpc/full/participation.compact.json", "backend");
expect(backend, "AGENT_API_HOST", "127.0.0.1", "backend");
expect(backend, "AGENT_API_PORT", "3101", "backend");
expect(frontend, "AGENT_API_URL", "http://127.0.0.1:3101/api/agent", "frontend");
expect(frontend, "AGENT_SESSION_MODE", "local_service", "frontend");

const backendToken = backend.get("AGENT_API_TOKEN") ?? "";
const frontendToken = frontend.get("AGENT_API_TOKEN") ?? "";
if (backendToken.length < 32 || backendToken !== frontendToken || isPlaceholder(backendToken)) {
  throw new Error("AGENT_API_TOKEN debe ser privado, robusto e idéntico en backend y frontend");
}

const dataRoot = path.resolve(backendDirectory, backend.get("CCPC_DATA_DIR"));
const dataset = path.resolve(dataRoot, backend.get("CCPC_DATASET_PATH"));
await access(path.join(dataRoot, "src", "data", "dataset-v1.ts"));
await access(dataset);

const planner = backend.get("UI_PLANNER_MODE") || "rules";
if (planner === "gemini") {
  const key = backend.get("GEMINI_API_KEY") ?? "";
  if (!key || isPlaceholder(key)) throw new Error("El modo gemini requiere una GEMINI_API_KEY real en el backend");
}

console.log(`Configuración local: OK (datos completos, planificador ${planner}, secretos privados).`);

function parseEnv(source) {
  const result = new Map();
  for (const line of source.split(/\r?\n/u)) {
    if (!line || /^\s*#/u.test(line)) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    result.set(match[1], decodeValue(match[2].trim()));
  }
  return result;
}

function decodeValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function expect(environment, key, expected, label) {
  if (environment.get(key) !== expected) throw new Error(`${label}: ${key} no coincide con la integración local`);
}

function isPlaceholder(value) {
  return /(replace|reemplaza|mismo|same|example|ejemplo|pega-aqui|tu-clave)/iu.test(value);
}

function assertNoPublicSecrets(environment, filename) {
  for (const key of environment.keys()) {
    if (/^NEXT_PUBLIC_.*(KEY|TOKEN|SECRET|PASSWORD)/u.test(key)) {
      throw new Error(`${filename} contiene una variable pública insegura: ${key}`);
    }
  }
}

async function assertPrivate(filename, label) {
  const info = await stat(filename);
  if ((info.mode & 0o077) !== 0) throw new Error(`${label} debe tener permisos 600`);
}
