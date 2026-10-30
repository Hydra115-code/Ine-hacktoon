import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { sessionUiSnapshotSchema } from "../src/integration/session-ui-snapshot.js";
import { SqliteSessionStore } from "../src/repositories/sqlite-session.repository.js";

const actorId = "10000000-0000-4000-8000-000000000001";
const sessionId = "38000000-0000-4000-8000-000000000001";
const firstCorrelation = "39000000-0000-4000-8000-000000000001";
const secondCorrelation = "39000000-0000-4000-8000-000000000002";
const specification = sessionUiSnapshotSchema.parse({
  version: "1",
  sessionId,
  interfaceRevision: 1,
  dataRevision: 1,
  dataKeys: ["participation"],
  specification: {
    version: "1",
    root: { type: "text", id: "summary", content: "Participación ciudadana" },
  },
  data: { participation: { voted: 7_288, nominalList: 14_908 } },
  invalidatedKeys: [],
});

test("INT-06 SQLite conserva sesión y snapshot después de reiniciar el store", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ine-sqlite-session-"));
  const databasePath = path.join(directory, "sessions.sqlite");
  try {
    const first = new SqliteSessionStore(databasePath);
    const started = await first.begin({ actorId, sessionId, correlationId: firstCorrelation });
    assert.equal(started.success, true);
    await first.complete({
      actorId,
      sessionId,
      correlationId: firstCorrelation,
      interfaceRevision: 1,
      dataRevision: 1,
      dataKeys: ["participation"],
      specification: specification.specification,
      dataRegistry: specification.data,
      invalidatedKeys: [],
      prompt: "Muéstrame la participación",
      answer: "Aquí está la participación observada.",
    });
    first.close();

    const restarted = new SqliteSessionStore(databasePath);
    const resumed = await restarted.begin({
      actorId,
      sessionId,
      correlationId: secondCorrelation,
      reference: { interfaceRevision: 1, dataRevision: 1, dataKeys: ["participation"] },
    });
    assert.equal(resumed.success, true);
    if (resumed.success) {
      assert.equal(resumed.isContinuation, true);
      assert.deepEqual(resumed.state.dataRegistry, specification.data);
      assert.equal(resumed.state.turns.at(-1)?.user, "Muéstrame la participación");
    }
    await restarted.release(actorId, sessionId, secondCorrelation);
    assert.deepEqual(restarted.readUiSnapshot(actorId, sessionId), {
      code: "success",
      snapshot: specification,
    });
    restarted.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("INT-06 SQLite mantiene aislamiento por actor y control de revisiones", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ine-sqlite-isolation-"));
  const store = new SqliteSessionStore(path.join(directory, "sessions.sqlite"));
  try {
    assert.equal((await store.begin({ actorId, sessionId, correlationId: firstCorrelation })).success, true);
    await store.release(actorId, sessionId, firstCorrelation);
    assert.deepEqual(await store.begin({
      actorId: "20000000-0000-4000-8000-000000000002",
      sessionId,
      correlationId: secondCorrelation,
    }), { success: false, code: "session_forbidden" });
    assert.deepEqual(await store.begin({
      actorId,
      sessionId,
      correlationId: secondCorrelation,
      reference: { interfaceRevision: 4, dataRevision: 3, dataKeys: [] },
    }), { success: false, code: "session_revision_conflict" });
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
