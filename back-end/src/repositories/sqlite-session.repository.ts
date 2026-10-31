import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  dataRegistrySchema,
  uiSpecificationSchema,
} from "@banorte/contracts";
import { z } from "zod";
import {
  type AgentSessionSnapshot,
  type BeginSessionInput,
  type BeginSessionResult,
  type CompleteSessionInput,
  type SessionStore,
} from "../application/ports/session-store.js";
import { applySessionCompletion } from "../application/session-state.js";
import { sessionUiSnapshotSchema } from "../integration/session-ui-snapshot.js";

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1_000;
const InteractionValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(500)).max(24),
  z.object({ start: z.string().max(10), end: z.string().max(10) }).strict(),
]);
const SnapshotSchema = z.object({
  sessionId: z.string().uuid(),
  interfaceRevision: z.number().int().nonnegative(),
  dataRevision: z.number().int().nonnegative(),
  dataKeys: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u)).max(100),
  specification: uiSpecificationSchema.optional(),
  previousSpecification: uiSpecificationSchema.optional(),
  dataRegistry: dataRegistrySchema.optional(),
  invalidatedKeys: z.array(z.string().min(1).max(64)).max(20).optional(),
  turns: z.array(z.object({
    user: z.string().max(10_000),
    assistant: z.string().max(2_000),
  }).strict()).max(6),
  interactionState: z.record(InteractionValueSchema),
}).strict();
const LEGACY_SNAPSHOT_KEYS = ["financialConstraints", "pendingPaymentIntentId"] as const;
const StoredSessionSchema = z.object({
  actorId: z.string().uuid(),
  activeCorrelationId: z.string().uuid().optional(),
  state: SnapshotSchema,
}).strict();

interface SessionRow {
  actor_id: string;
  snapshot_json: string;
  active_correlation_id: string | null;
  updated_at: number;
}

interface StoredSession {
  actorId: string;
  activeCorrelationId?: string;
  state: AgentSessionSnapshot;
}

export class SqliteSessionStore implements SessionStore {
  private readonly database: DatabaseSync;

  constructor(
    databasePath: string,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = DEFAULT_SESSION_TTL_MS,
  ) {
    const resolved = path.resolve(databasePath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    this.database = new DatabaseSync(resolved);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        session_id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        active_correlation_id TEXT,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS agent_sessions_actor_updated_idx
        ON agent_sessions(actor_id, updated_at);
    `);
  }

  async begin(input: BeginSessionInput): Promise<BeginSessionResult> {
    return this.transaction(() => {
      this.pruneExpired();
      let stored = this.read(input.sessionId);
      const isContinuation = input.reference !== undefined;
      if (!stored && isContinuation) return { success: false, code: "session_not_found" };
      if (stored && stored.actorId !== input.actorId) return { success: false, code: "session_forbidden" };
      if (stored?.activeCorrelationId) return { success: false, code: "session_busy" };
      if (stored && input.reference && !hasMatchingRevision(stored.state, input.reference)) {
        return { success: false, code: "session_revision_conflict" };
      }
      stored ??= {
        actorId: input.actorId,
        state: {
          sessionId: input.sessionId,
          interfaceRevision: 0,
          dataRevision: 0,
          dataKeys: [],
          turns: [],
          interactionState: {},
        },
      };
      stored.activeCorrelationId = input.correlationId;
      this.write(stored);
      return { success: true, state: structuredClone(stored.state), isContinuation };
    });
  }

  async complete(input: CompleteSessionInput): Promise<void> {
    this.transaction(() => {
      const stored = this.requireActive(input.actorId, input.sessionId, input.correlationId);
      stored.state = applySessionCompletion(stored.state, input);
      delete stored.activeCorrelationId;
      this.write(stored);
    });
  }

  async release(actorId: string, sessionId: string, correlationId: string): Promise<void> {
    this.transaction(() => {
      const stored = this.read(sessionId);
      if (!stored || stored.actorId !== actorId || stored.activeCorrelationId !== correlationId) return;
      delete stored.activeCorrelationId;
      this.write(stored);
    });
  }

  readUiSnapshot(actorId: string, sessionId: string) {
    const stored = this.read(sessionId);
    if (!stored) return { code: "session_not_found" as const };
    if (stored.actorId !== actorId) return { code: "session_forbidden" as const };
    if (stored.activeCorrelationId) return { code: "session_busy" as const };
    const { state } = stored;
    if (!state.specification || !state.dataRegistry) return { code: "snapshot_unavailable" as const };
    const snapshot = sessionUiSnapshotSchema.parse({
      version: "1",
      sessionId: state.sessionId,
      interfaceRevision: state.interfaceRevision,
      dataRevision: state.dataRevision,
      dataKeys: state.dataKeys,
      specification: state.specification,
      data: state.dataRegistry,
      invalidatedKeys: state.invalidatedKeys ?? [],
    });
    return { code: "success" as const, snapshot };
  }

  clear(): void {
    this.database.exec("DELETE FROM agent_sessions");
  }

  close(): void {
    this.database.close();
  }

  private read(sessionId: string): StoredSession | undefined {
    const row = this.database.prepare(`
      SELECT actor_id, snapshot_json, active_correlation_id, updated_at
      FROM agent_sessions WHERE session_id = ?
    `).get(sessionId) as unknown as SessionRow | undefined;
    if (!row) return undefined;
    return StoredSessionSchema.parse({
      actorId: row.actor_id,
      ...(row.active_correlation_id ? { activeCorrelationId: row.active_correlation_id } : {}),
      state: withoutLegacyKeys(JSON.parse(row.snapshot_json) as unknown),
    }) as StoredSession;
  }

  private write(stored: StoredSession): void {
    const validated = StoredSessionSchema.parse(stored);
    this.database.prepare(`
      INSERT INTO agent_sessions(session_id, actor_id, snapshot_json, active_correlation_id, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        actor_id = excluded.actor_id,
        snapshot_json = excluded.snapshot_json,
        active_correlation_id = excluded.active_correlation_id,
        updated_at = excluded.updated_at
    `).run(
      validated.state.sessionId,
      validated.actorId,
      JSON.stringify(validated.state),
      validated.activeCorrelationId ?? null,
      this.now(),
    );
  }

  private requireActive(actorId: string, sessionId: string, correlationId: string): StoredSession {
    const stored = this.read(sessionId);
    if (!stored || stored.actorId !== actorId || stored.activeCorrelationId !== correlationId) {
      throw new Error("La sesión local no pertenece a esta solicitud");
    }
    return stored;
  }

  private pruneExpired(): void {
    this.database.prepare(`
      DELETE FROM agent_sessions
      WHERE active_correlation_id IS NULL AND updated_at < ?
    `).run(this.now() - this.ttlMs);
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function withoutLegacyKeys(state: unknown): unknown {
  if (typeof state !== "object" || state === null || Array.isArray(state)) return state;
  const copy = { ...(state as Record<string, unknown>) };
  for (const key of LEGACY_SNAPSHOT_KEYS) delete copy[key];
  return copy;
}

function hasMatchingRevision(
  state: AgentSessionSnapshot,
  reference: NonNullable<BeginSessionInput["reference"]>,
): boolean {
  return state.interfaceRevision === reference.interfaceRevision
    && state.dataRevision === reference.dataRevision
    && [...state.dataKeys].sort().every((key, index) => key === [...reference.dataKeys].sort()[index])
    && state.dataKeys.length === reference.dataKeys.length;
}
