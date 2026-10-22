import {
  CONTRACT_FINGERPRINT,
  CONTRACT_VERSION,
  systemStatusSchema,
  type SystemStatus,
} from "@banorte/contracts";
import { env } from "../config/env.js";
import { readPlannerStatus, type PlannerStatus } from "../agent/planning/planner-factory.js";

export interface RuntimeCapabilities {
  isAgentReady: boolean;
  isMcpReady: boolean;
  planner?: PlannerStatus;
}

export function readRuntimeCapabilities(planner: PlannerStatus = readPlannerStatus()): RuntimeCapabilities {
  const hasSessionRuntime = env.AUTH_MODE === "local_sqlite"
    ? Boolean(env.AGENT_API_TOKEN && env.SQLITE_DATABASE_PATH)
    : Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
  return {
    isAgentReady: hasSessionRuntime && planner.ready,
    isMcpReady: hasSessionRuntime,
    planner,
  };
}

export function plannerHeaderValue(capabilities: RuntimeCapabilities): string | undefined {
  if (!capabilities.planner) return undefined;
  return `${capabilities.planner.mode}; ${capabilities.planner.ready ? "ready" : "unavailable"}`;
}

export function isAccessTokenFresh(
  token: string | undefined,
  now: () => number = Date.now,
): boolean {
  if (!token) return false;
  const payload = token.split(".")[1];
  if (!payload) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (!claims || typeof claims !== "object") return false;
    const expiration = (claims as Record<string, unknown>).exp;
    return typeof expiration === "number"
      && Number.isInteger(expiration)
      && expiration * 1_000 > now();
  } catch {
    return false;
  }
}

export function createSystemStatus(
  capabilities: RuntimeCapabilities = readRuntimeCapabilities(),
  now: () => Date = () => new Date(),
): SystemStatus {
  const isReady = capabilities.isAgentReady && capabilities.isMcpReady;
  return systemStatusSchema.parse({
    version: CONTRACT_VERSION,
    contractFingerprint: CONTRACT_FINGERPRINT,
    status: isReady ? "ok" : "degraded",
    backend: "ready",
    agent: capabilities.isAgentReady ? "ready" : "unavailable",
    mcp: capabilities.isMcpReady ? "ready" : "unavailable",
    checkedAt: now().toISOString(),
  });
}
