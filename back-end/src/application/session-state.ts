import {
  type AgentSessionSnapshot,
  type CompleteSessionInput,
} from "./ports/session-store.js";

const MAX_SESSION_TURNS = 6;
const MAX_CONTEXT_ANSWER_LENGTH = 2_000;

export function applySessionCompletion(
  current: AgentSessionSnapshot,
  input: CompleteSessionInput,
): AgentSessionSnapshot {
  const turns = input.prompt
    ? [
      ...current.turns,
      {
        user: input.prompt,
        assistant: input.answer.slice(0, MAX_CONTEXT_ANSWER_LENGTH),
      },
    ].slice(-MAX_SESSION_TURNS)
    : current.turns;
  const interactionState = { ...current.interactionState };
  if (input.interaction) {
    interactionState[input.interaction.name] = input.interaction.value ?? null;
  }

  const replacesView = input.specification !== undefined && current.specification !== undefined
    && JSON.stringify(input.specification) !== JSON.stringify(current.specification);
  const previousSpecification = replacesView ? current.specification : current.previousSpecification;

  return {
    sessionId: input.sessionId,
    interfaceRevision: input.interfaceRevision,
    dataRevision: input.dataRevision,
    dataKeys: [...input.dataKeys],
    ...((input.dataRegistry ?? current.dataRegistry) ? {
      dataRegistry: structuredClone(input.dataRegistry ?? current.dataRegistry),
      invalidatedKeys: [...(input.invalidatedKeys ?? current.invalidatedKeys ?? [])],
    } : {}),
    ...(input.specification
      ? { specification: input.specification }
      : current.specification ? { specification: current.specification } : {}),
    ...(previousSpecification ? { previousSpecification } : {}),
    turns,
    interactionState,
  };
}
