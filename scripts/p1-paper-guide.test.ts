import assert from "node:assert/strict";
import test from "node:test";
import { paperCopy } from "../src/features/paper/copy/paper-copy.ts";
import {
  paperStateForWorkspaceStatus,
  resolvePaperGuide,
} from "../src/features/paper/state/paper-guide-state.ts";
import { paperStates } from "../src/features/paper/types/paper-state.ts";
import { experienceStatuses as workspaceStatuses } from "../src/features/workspace/state/experience-state-machine.ts";

test("P1 cubre todos los estados semánticos de Paper", () => {
  assert.deepEqual(Object.keys(paperCopy), paperStates);
  for (const state of paperStates) {
    assert.ok(paperCopy[state].title.length > 0);
    assert.ok(paperCopy[state].detail.length > 0);
  }
});

test("P1 traduce cada estado del workspace sin dejar casos indefinidos", () => {
  for (const status of workspaceStatuses) {
    const state = paperStateForWorkspaceStatus(status);
    const presentation = resolvePaperGuide(status);
    assert.ok(paperStates.includes(state));
    assert.equal(presentation.state, state);
    assert.equal(presentation.title, paperCopy[state].title);
  }
});

test("P1 separa comprender, consultar y construir", () => {
  assert.equal(paperStateForWorkspaceStatus("submitting"), "understanding");
  assert.equal(paperStateForWorkspaceStatus("retrieving_data"), "consulting");
  assert.equal(paperStateForWorkspaceStatus("generating_ui"), "building");
  assert.equal(paperStateForWorkspaceStatus("updating"), "building");
});

test("P1 reserva recuperación para resultados parciales, errores y cancelaciones", () => {
  for (const status of ["partial", "error", "cancelled"] as const) {
    const presentation = resolvePaperGuide(status);
    assert.equal(presentation.state, "recovering");
    assert.equal(presentation.announcement, "assertive");
    assert.doesNotMatch(presentation.detail, /json|zod|http|stack|mcp|gemini/iu);
  }
});

test("P1 permite una sobreescritura semántica futura sin cambiar el workspace", () => {
  const presentation = resolvePaperGuide("ready", "suggesting");
  assert.equal(presentation.state, "suggesting");
  assert.equal(presentation.title, paperCopy.suggesting.title);
});
