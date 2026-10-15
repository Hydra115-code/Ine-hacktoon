"use client";

import { useEffect, useRef } from "react";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";
import { useWorkspaceStore } from "../state/workspace-store";
import { isWorkspaceBusy } from "../types/workspace-status";
import { PromptComposer } from "./PromptComposer";
import { cleanAnswerText, summarizeAnswer } from "../presentation/summarize-answer";

import { SuggestedQuestions } from "../../civic-ui/components/SuggestedQuestions";

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
    <section className="conversation" aria-labelledby="conversation-title">
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
          <ol ref={listRef} className="conversation__turns" aria-label="Mensajes de esta consulta">
            {conversationTurns.map((turn) => {
              const summary = turn.role === "assistant" ? summarizeAnswer(turn.text) : "";
              const fullAnswer = turn.role === "assistant" ? cleanAnswerText(turn.text) : "";
              return <li className="conversation__turn" data-role={turn.role} key={turn.id}>
                <span className="conversation__speaker">{turn.role === "user" ? "Tú" : "Paper"}</span>
                {turn.role === "user" ? <p>{turn.text}</p> : (
                  <>
                    {summary ? <p className="conversation__summary">{summary}</p> : null}
                    {fullAnswer && fullAnswer !== summary ? (
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
                    aria-label={`Ver resultado de esta respuesta, revisión ${turn.revision}`}
                    onClick={() => { focusTurn(turn.id); onShowResult(); }}
                  >
                    Ver resultado
                  </button>
                ) : null}
                {turn.role === "assistant" && ((turn.sources?.length ?? 0) + (turn.controls?.length ?? 0) + (turn.changes?.length ?? 0) > 0) ? (
                  <details className="conversation__evidence">
                    <summary>Cómo se construyó esta vista</summary>
                    {turn.sources?.length ? <p>Datos solicitados: {turn.sources.join(", ")}</p> : null}
                    {turn.controls?.length ? <p>Controles: {turn.controls.join(", ")}</p> : null}
                    {turn.changes?.length ? <ul>{turn.changes.map((change) => <li key={change}>{change}</li>)}</ul> : null}
                  </details>
                ) : null}
              </li>;
            })}
          </ol>
        )}
        {isBusy ? (
          <div className="conversation__activity">
            <span aria-hidden="true" />
            {activityMessage}
          </div>
        ) : null}
        {isHistoricalView ? (
          <p className="conversation__historical-note">Estás viendo una revisión anterior. Las acciones de esa vista están desactivadas; escribe una nueva petición para continuar con la más reciente.</p>
        ) : displayedInterface && conversationTurns.length > 0 ? (
          <p className="conversation__hint">Puedes pedir cambios como “compáralo por estado” o usar los controles de la interfaz.</p>
        ) : null}
      </div>
      <PromptComposer />
    </section>
  );
}
