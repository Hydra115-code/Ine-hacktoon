import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { type AuthenticatedSupabaseSession } from "../src/config/supabase.js";
import { RateLimitError } from "../src/application/errors/rate-limit.error.js";
import { ToolRateLimiter } from "../src/application/tool-rate-limiter.js";
import { createSystemApi } from "../src/http/system-api.js";
import {
  CivicMcpClient,
  CivicToolError,
} from "../src/agent/mcp-client/civic-mcp-client.js";
import { crearServidor } from "../src/server.js";

test("comparte contadores entre scopes derivados y aísla usuarios", () => {
  let now = 1_000;
  const limiter = new ToolRateLimiter({
    maxCalls: 2,
    windowMs: 1_000,
    now: () => now,
  });

  limiter.forScope("user-a").consume("get_participation_summary");
  limiter.forScope("user-a").consume("get_participation_summary");
  assert.throws(
    () => limiter.forScope("user-a").consume("get_participation_summary"),
    (error: unknown) => error instanceof RateLimitError && error.retryAfterMs === 1_000,
  );
  assert.doesNotThrow(() => limiter.forScope("user-b").consume("get_participation_summary"));

  now = 2_001;
  assert.doesNotThrow(() => limiter.forScope("user-a").consume("get_participation_summary"));
});

test("aplica un límite propio a una operación específica", () => {
  const limiter = new ToolRateLimiter({
    maxCalls: 3,
    windowMs: 60_000,
    policyForOperation: (operation) => operation === "compare_elections"
      ? { maxCalls: 1, windowMs: 60_000 }
      : undefined,
  }).forScope("user-a");

  limiter.consume("get_participation_summary");
  limiter.consume("get_participation_summary");
  limiter.consume("compare_elections");
  assert.throws(() => limiter.consume("compare_elections"), RateLimitError);
  assert.doesNotThrow(() => limiter.consume("get_participation_summary"));
});

test("conserva el límite MCP al recrear el runtime del mismo usuario", async () => {
  const limiter = new ToolRateLimiter({ maxCalls: 1, windowMs: 60_000 });
  const first = await connectStatusClient("user-a", limiter);
  const second = await connectStatusClient("user-a", limiter);
  const otherUser = await connectStatusClient("user-b", limiter);

  try {
    await first.callTool(statusCall());
    await assert.rejects(
      second.callTool(statusCall()),
      (error: unknown) => error instanceof CivicToolError && error.code === "rate_limited",
    );
    await assert.doesNotReject(otherUser.callTool(statusCall()));
  } finally {
    await Promise.all([first.close(), second.close(), otherUser.close()]);
  }
});

test("la API limita autenticación por red y peticiones costosas por usuario", async () => {
  const authenticationRateLimiter = new ToolRateLimiter({ maxCalls: 2, windowMs: 60_000 });
  const requestRateLimiter = new ToolRateLimiter({ maxCalls: 1, windowMs: 60_000 });
  const server = createSystemApi({
    authenticationRateLimiter,
    requestRateLimiter,
    createUserSession: async (token) => session(token.endsWith("a") ? "user-a" : "user-b"),
    realtimeTranscription: async () => ({ token: "token-efimero-de-prueba" }) as never,
  });

  const first = await dispatch(server, "valid-supabase-access-token-user-a", "10.0.0.1");
  assert.equal(first.statusCode, 200);

  const sameUser = await dispatch(server, "valid-supabase-access-token-user-a", "10.0.0.1");
  assert.equal(sameUser.statusCode, 429);
  assert.equal(sameUser.headers["Retry-After"], "60");

  const networkLimited = await dispatch(server, "valid-supabase-access-token-user-b", "10.0.0.1");
  assert.equal(networkLimited.statusCode, 429);

  const otherNetworkAndUser = await dispatch(server, "valid-supabase-access-token-user-b", "10.0.0.2");
  assert.equal(otherNetworkAndUser.statusCode, 200);
  server.removeAllListeners();
});

function session(userId: string): AuthenticatedSupabaseSession {
  return {
    client: {} as AuthenticatedSupabaseSession["client"],
    user: { id: userId },
  };
}

function connectStatusClient(userId: string, rateLimiter: ToolRateLimiter) {
  return CivicMcpClient.connect(crearServidor(
    { client: {} as AuthenticatedSupabaseSession["client"], user: { id: userId } },
    { rateLimiter },
  ));
}

function statusCall() {
  return {
    name: "get_participation_summary",
    arguments: { year: 2024, office: "presidencia" },
  };
}

function dispatch(
  server: ReturnType<typeof createSystemApi>,
  accessToken: string,
  remoteAddress: string,
): Promise<{ statusCode: number; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const request = Object.assign(new EventEmitter(), {
      method: "POST",
      url: "/api/transcription/realtime-session",
      headers: { authorization: `Bearer ${accessToken}` },
      socket: { remoteAddress },
    }) as unknown as IncomingMessage;
    const response = {
      statusCode: 200,
      headersSent: false,
      writableEnded: false,
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      end() {
        this.writableEnded = true;
        resolve({ statusCode: this.statusCode, headers });
      },
    } as unknown as ServerResponse;

    server.emit("request", request, response);
  });
}
