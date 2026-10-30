"use client";

import { useEffect, useRef } from "react";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";
import { useWorkspaceStore } from "../state/workspace-store";
import { isWorkspaceBusy } from "../types/workspace-status";
import { PromptComposer } from "./PromptComposer";
import { cleanAnswerText, summarizeAnswer } from "../presentation/summarize-answer";

import { SuggestedQuestions } from "../../civic-ui/components/SuggestedQuestions";
import { isGuidanceOnly } from "../presentation/is-guidance-only";

const internalDetail = /(?:\b(?:mcp|gemini|json|schema|binding|payload|patch|runtime|correlation|request|revision|ui|zod|http)\b|[_{}[\]]|\b[a-f0-9]{8,}\b)/iu;

function citizenFacingDetails(values: readonly string[] | undefined) {
  return (values ?? [])
    .map((value) => cleanAnswerText(value).replace(/\s+/gu, " ").trim())
    .filter((value) => value.length > 0 && value.length <= 160 && !internalDetail.test(value));
}

export function ConversationPanel({ onShowResult }: { onShowResult: () => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  const status = useWorkspaceStore((state) => state.experience.status);
  const setDraft = useWorkspaceStore((state) => state.setDraft);
  const {
    activityMessage,
    conversationTurns,
    displayedInterface,
    focusedTurnId,
    focusTurn,
    isHistoricalView,
  } = useAgentSession();
  const isBusy = isWorkspaceBusy(status);
  const guidanceOnly = status === "ready" && isGuidanceOnly(
    displayedInterface?.specification,
    Object.keys(displayedInterface?.data ?? {}).length > 0,
  );
  const latestTurnId = conversationTurns.at(-1)?.id;
  const messageCount = conversationTurns.length;
  const messageCountLabel = messageCount === 0
    ? "Sin mensajes todavía"
    : `${messageCount} ${messageCount === 1 ? "mensaje" : "mensajes"}`;
  const prepareQuestion = (question: string) => {
    setDraft(question);
    window.requestAnimationFrame(() => document.getElementById("civic-prompt")?.focus());
  };

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const last = list.lastElementChild;
    last?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [conversationTurns.length, isBusy]);

  return (
    <section className="conversation" aria-busy={isBusy} aria-labelledby="conversation-title">
      <header className="conversation__header">
        <div>
          <p>Consulta ciudadana con Paper</p>
          <h2 id="conversation-title">Pregunta, compara y descubre</h2>
        </div>
        <span>{messageCountLabel}</span>
      </header>
      <div className="conversation__scroll">
        {conversationTurns.length === 0 ? (
          <div className="conversation__empty">
            <SuggestedQuestions
              onSelectQuestion={prepareQuestion}
              title="Tres ideas para empezar"
            />
          </div>
        ) : (
          <ol
            ref={listRef}
            className="conversation__turns"
            aria-label="Mensajes de esta consulta"
            aria-live="polite"
            aria-relevant="additions text"
            role="log"
          >
            {conversationTurns.map((turn) => {
              const summary = turn.role === "assistant" ? summarizeAnswer(turn.text) : "";
              const fullAnswer = turn.role === "assistant" ? cleanAnswerText(turn.text) : "";
              const isDirectResponse = turn.role === "assistant" && turn.revision === undefined;
              const isCurrentGuidance = guidanceOnly && isDirectResponse && turn.id === latestTurnId;
              const sources = citizenFacingDetails(turn.sources);
              const controls = citizenFacingDetails(turn.controls);
              const changes = citizenFacingDetails(turn.changes);
              return <li className="conversation__turn" data-role={turn.role} key={turn.id}>
                <span className="conversation__speaker">{turn.role === "user" ? "Tú" : "Paper"}</span>
                {turn.role === "user" ? <p>{turn.text}</p> : (
                  <>
                    {isDirectResponse && fullAnswer ? (
                      <p className="conversation__direct-answer">{isCurrentGuidance ? "¿Puedes darme estos datos para continuar?" : fullAnswer}</p>
                    ) : summary ? <p className="conversation__summary">{summary}</p> : null}
                    {!isDirectResponse && fullAnswer && fullAnswer !== summary ? (
                      <details className="conversation__full-answer">
                        <summary>Ver explicación completa</summary>
                        <p>{fullAnswer}</p>
                      </details>
                    ) : null}
                  </>
                )}
                {turn.revision !== undefined ? (
                  <button
                    type="button"
                    className="conversation__result-link"
                    aria-current={focusedTurnId === turn.id ? "true" : undefined}
                    aria-label="Ver resultado de esta respuesta"
                    onClick={() => { focusTurn(turn.id); onShowResult(); }}
                  >
                    Ver resultado
                  </button>
                ) : null}
                {turn.role === "assistant" && !isCurrentGuidance && sources.length + controls.length + changes.length > 0 ? (
                  <details className="conversation__evidence">
                    <summary>Qué puedes revisar en esta vista</summary>
                    {sources.length ? <p>Información consultada: {sources.join(", ")}</p> : null}
                    {controls.length ? <p>Opciones disponibles: {controls.join(", ")}</p> : null}
                    {changes.length ? <ul>{changes.map((change) => <li key={change}>{change}</li>)}</ul> : null}
                  </details>
                ) : null}
              </li>;
            })}
          </ol>
        )}
        {isBusy ? (
          <div className="conversation__activity" role="status" aria-live="polite" aria-atomic="true">
            <span aria-hidden="true" />
            {activityMessage}
          </div>
        ) : null}
        {isHistoricalView ? (
          <p className="conversation__historical-note" role="status">Estás viendo una versión anterior. Para hacer cambios, vuelve al resultado más reciente o escribe una nueva petición.</p>
        ) : displayedInterface && conversationTurns.length > 0 && !guidanceOnly ? (
          <p className="conversation__hint">Puedes pedir cambios como “compáralo por estado” o usar las opciones visibles.</p>
        ) : null}
      </div>
      <PromptComposer />
    </section>
  );
}
