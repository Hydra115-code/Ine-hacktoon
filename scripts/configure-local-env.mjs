import { randomBytes } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendFile = path.join(repositoryRoot, "back-end", ".env");
const frontendFile = path.join(repositoryRoot, "front-end", ".env.local");

const backendText = await readFile(backendFile, "utf8");
const frontendText = await readFile(frontendFile, "utf8");
const backendEnv = parseEnv(backendText);
const frontendEnv = parseEnv(frontendText);

assertNoPublicSecrets(backendEnv, "back-end/.env");
assertNoPublicSecrets(frontendEnv, "front-end/.env.local");

const currentToken = decodeValue(backendEnv.get("AGENT_API_TOKEN") ?? "");
const agentToken = isUsableToken(currentToken) ? currentToken : randomBytes(32).toString("hex");

const configuredBackend = updateEnv(backendText, {
  AUTH_MODE: "local_sqlite",
  SQLITE_DATABASE_PATH: ".local/ine-explora.sqlite",
  CCPC_DATA_DIR: "../data-release/Ine-hacktoon-DATA-06",
  CCPC_DATASET_PATH: "data/ccpc/full/participation.compact.json",
  AGENT_API_HOST: "127.0.0.1",
  AGENT_API_PORT: "3101",
  AGENT_API_ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
  AGENT_API_TOKEN: agentToken,
});

const configuredFrontend = updateEnv(frontendText, {
  AI_PROVIDER: "google",
  AGENT_API_URL: "http://127.0.0.1:3101/api/agent",
  AGENT_SESSION_MODE: "local_service",
  AGENT_API_TOKEN: agentToken,
});

await writePrivateFile(backendFile, configuredBackend);
await writePrivateFile(frontendFile, configuredFrontend);

console.log("Entorno local conectado; los secretos existentes se conservaron y no se mostraron.");

function parseEnv(source) {
  const result = new Map();
  for (const line of source.split(/\r?\n/u)) {
    if (!line || /^\s*#/u.test(line)) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (match) result.set(match[1], match[2].trim());
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

function isUsableToken(value) {
  return value.length >= 32 && !/(replace|reemplaza|mismo|same|example|ejemplo)/iu.test(value);
}

function assertNoPublicSecrets(environment, filename) {
  for (const key of environment.keys()) {
    if (/^NEXT_PUBLIC_.*(KEY|TOKEN|SECRET|PASSWORD)/u.test(key)) {
      throw new Error(`${filename} contiene una variable pública insegura: ${key}`);
    }
  }
}

function updateEnv(source, values) {
  let result = source;
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${key}=.*$`, "mu");
    result = pattern.test(result)
      ? result.replace(pattern, line)
      : `${result.replace(/\s*$/u, "")}\n${line}\n`;
  }
  return `${result.replace(/\s*$/u, "")}\n`;
}

async function writePrivateFile(filename, contents) {
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filename);
  await chmod(filename, 0o600);
}
