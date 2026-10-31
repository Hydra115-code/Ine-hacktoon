import assert from "node:assert/strict";
import test from "node:test";
import { type SupabaseClient } from "@supabase/supabase-js";
import { SupabaseSessionStore } from "../src/repositories/supabase-session.repository.js";

const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "80000000-0000-4000-8000-000000000001";

test("SupabaseSessionStore recupera el estado después de crear una instancia nueva", async () => {
  let persisted: Record<string, unknown> | undefined;
  let activeCorrelationId: string | undefined;
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      if (name === "begin_agent_session") {
        if (!persisted) {
          if (parameters.p_is_continuation === true) {
            return { data: [failureRow("session_not_found")], error: null };
          }
          persisted = emptyRow();
        }
        if (
          parameters.p_is_continuation === true
          && (
            persisted.interface_revision !== parameters.p_interface_revision
            || persisted.data_revision !== parameters.p_data_revision
            || JSON.stringify(persisted.data_keys) !== JSON.stringify(parameters.p_data_keys)
          )
        ) {
          return { data: [failureRow("session_revision_conflict")], error: null };
        }
        activeCorrelationId = String(parameters.p_correlation_id);
        return { data: [{ result_code: "success", ...persisted }], error: null };
      }
      if (name === "complete_agent_session") {
        assert.equal(parameters.p_correlation_id, activeCorrelationId);
        persisted = {
          ...persisted,
          interface_revision: parameters.p_interface_revision,
          data_revision: parameters.p_data_revision,
          data_keys: parameters.p_data_keys,
          specification: parameters.p_specification,
          turns: parameters.p_turns,
          interaction_state: parameters.p_interaction_state,
        };
        activeCorrelationId = undefined;
        return { data: [{ result_code: "success" }], error: null };
      }
      if (name === "release_agent_session") {
        if (activeCorrelationId === parameters.p_correlation_id) activeCorrelationId = undefined;
        return { data: [{ result_code: "success" }], error: null };
      }
      throw new Error("RPC inesperada: " + name);
    },
  } as unknown as SupabaseClient;

  const firstProcess = new SupabaseSessionStore(client);
  const first = await firstProcess.begin({
    actorId: userId,
    sessionId,
    correlationId: "80000000-0000-4000-8000-000000000002",
  });
  assert.equal(first.success, true);
  await firstProcess.complete({
    actorId: userId,
    sessionId,
    correlationId: "80000000-0000-4000-8000-000000000002",
    interfaceRevision: 3,
    dataRevision: 2,
    dataKeys: ["source_1"],
    prompt: "¿Cuál fue la participación en Jalisco en 2024?",
    answer: "La participación oficial fue de 61.2 %.",
  });

  const processAfterRestart = new SupabaseSessionStore(client);
  const recovered = await processAfterRestart.begin({
    actorId: userId,
    sessionId,
    correlationId: "80000000-0000-4000-8000-000000000003",
    reference: {
      interfaceRevision: 3,
      dataRevision: 2,
      dataKeys: ["source_1"],
    },
  });
  assert.equal(recovered.success, true);
  if (!recovered.success) return;
  assert.equal(recovered.state.turns[0]?.user, "¿Cuál fue la participación en Jalisco en 2024?");

  await processAfterRestart.complete({
    actorId: userId,
    sessionId,
    correlationId: "80000000-0000-4000-8000-000000000003",
    interfaceRevision: 4,
    dataRevision: 3,
    dataKeys: ["source_2"],
    prompt: "¿Y en 2018?",
    answer: "Filtro actualizado.",
  });

  const thirdProcess = new SupabaseSessionStore(client);
  const final = await thirdProcess.begin({
    actorId: userId,
    sessionId,
    correlationId: "80000000-0000-4000-8000-000000000004",
    reference: {
      interfaceRevision: 4,
      dataRevision: 3,
      dataKeys: ["source_2"],
    },
  });
  assert.equal(final.success, true);
  if (final.success) {
    assert.equal(final.state.turns.length, 2);
  }
});

function emptyRow(): Record<string, unknown> {
  return {
    user_id: userId,
    session_id: sessionId,
    interface_revision: 0,
    data_revision: 0,
    data_keys: [],
    specification: null,
    turns: [],
    interaction_state: {},
  };
}

function failureRow(resultCode: string): Record<string, unknown> {
  return {
    result_code: resultCode,
    user_id: null,
    session_id: null,
    interface_revision: null,
    data_revision: null,
    data_keys: null,
    specification: null,
    turns: null,
    interaction_state: null,
  };
}
