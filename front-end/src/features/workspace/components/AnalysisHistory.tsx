"use client";

import { useAgentSession } from "../../agent/components/AgentSessionProvider";

function formatHistoryTime(timestamp: number) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function AnalysisHistory() {
  const { activeAnalysisId, analysisHistory, selectAnalysis } = useAgentSession();

  if (analysisHistory.length <= 1) return null;

  return (
    <details className="analysis-history">
      <summary>
        <span className="analysis-history__summary-title">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 7h16M4 12h12M4 17h8" />
          </svg>
          <span>Consultas anteriores</span>
        </span>
        <span className="analysis-history__summary-actions">
          <span className="analysis-history__count" aria-label={`${analysisHistory.length} consultas`}>
            {analysisHistory.length}
          </span>
          <span className="analysis-history__disclosure" aria-hidden="true">
            <span className="analysis-history__disclosure-closed">Mostrar</span>
            <span className="analysis-history__disclosure-open">Ocultar</span>
            <svg viewBox="0 0 24 24">
              <path d="m7 10 5 5 5-5" />
            </svg>
          </span>
        </span>
      </summary>
      <nav aria-label="Resultados anteriores">
        <ol>
          {analysisHistory.map((item) => {
            const isActive = item.id === activeAnalysisId;
            return (
              <li key={item.id}>
                <button
                  aria-current={isActive ? "page" : undefined}
                  data-active={isActive || undefined}
                  type="button"
                  onClick={() => selectAnalysis(item.id)}
                >
                  <span>{item.title}</span>
                  <small>{isActive ? "Hilo activo" : formatHistoryTime(item.updatedAt)}</small>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </details>
  );
}
