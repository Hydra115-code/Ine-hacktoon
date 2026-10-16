"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "../state/workspace-store";
import { isWorkspaceBusy, type WorkspaceStatus } from "../types/workspace-status";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";
import { UIRenderer } from "../../generative-ui/renderer/UIRenderer";
import { UIEventProvider } from "../../generative-ui/interactions/events/UIEventProvider";
import { isGuidanceOnly } from "../presentation/is-guidance-only";
import { ElectoralExplorationStart } from "../../electoral-exploration/components/ElectoralExplorationStart";
import { electoralExplorationIntents } from "../../electoral-exploration/electoral-exploration-intents";
import { PaperAvatar } from "../../paper/components/PaperAvatar";
import { PaperDialogue } from "../../paper/components/PaperDialogue";
import { paperStatusVoices } from "../../paper/paper-voice";

interface StatusContent {
  detail: string;
  label: string;
  title: string;
}

const statusContent: Record<WorkspaceStatus, StatusContent> = {
  empty: {
    label: "Listo para comenzar",
    title: "Convierte una pregunta en una vista clara",
    detail: "Explora participación, territorio e indicadores públicos sin navegar entre reportes rígidos.",
  },
  submitting: {
    label: "Analizando",
    title: "Entendiendo tu consulta",
    detail: "Estamos enviando la consulta y determinando qué información necesita.",
  },
  retrieving_data: {
    label: "Consultando datos",
    title: "Reuniendo la información necesaria",
    detail: "Solo se consultarán las fuentes relevantes para tu petición.",
  },
  generating_ui: {
    label: "Preparando la vista",
    title: "Preparando la vista",
    detail: "Mostraremos la interfaz cuando el análisis esté listo.",
  },
  ready: {
    label: "Actualizado",
    title: "Interfaz preparada",
    detail: "El contenido generado se mostrará aquí.",
  },
  updating: {
    label: "Preparando cambios",
    title: "Preparando la vista",
    detail: "La última vista válida sigue disponible mientras aplicamos el cambio.",
  },
  awaiting_confirmation: {
    label: "Requiere confirmación",
    title: "Revisa y confirma la acción",
    detail: "No se aplicará ningún cambio sin tu confirmación explícita.",
  },
  executing_action: {
    label: "Procesando acción",
    title: "Aplicando la acción confirmada",
    detail: "Conservaremos la interfaz visible mientras termina el proceso.",
  },
  partial: {
    label: "Resultado parcial",
    title: "Mostrando la información disponible",
    detail: "La última interfaz válida permanece disponible mientras decides cómo continuar.",
  },
  cancelled: {
    label: "Cancelado",
    title: "Consulta cancelada",
    detail: "Puedes ajustar tu pregunta o iniciar una nueva consulta.",
  },
  error: {
    label: "Necesita atención",
    title: "No pudimos completar la consulta",
    detail: "Puedes iniciar una nueva consulta e intentarlo otra vez.",
  },
};

const processSteps = ["Comprendiendo", "Consultando", "Construyendo"] as const;

function getActiveProcessStep(status: WorkspaceStatus) {
  if (status === "retrieving_data") return 1;
  if (status === "generating_ui" || status === "updating") return 2;
  return 0;
}

const processProgress = [18, 58, 88] as const;

function elapsedMilliseconds(start: number | undefined, end: number | undefined) {
  return start === undefined || end === undefined ? undefined : Math.max(0, end - start);
}

function formatPayloadSize(bytes: number) {
  return bytes < 1_024 ? `${bytes} B` : `${(bytes / 1_024).toFixed(1)} KB`;
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function GenerativeCanvas({ showRuntimeDiagnostics = false, onShowChat }: { showRuntimeDiagnostics?: boolean; onShowChat?: () => void }) {
  const runtimeRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const previousRevisionRef = useRef<number | undefined>(undefined);
  const [isPaperHelpOpen, setIsPaperHelpOpen] = useState(false);
  const status = useWorkspaceStore((state) => state.experience.status);
  const activePrompt = useWorkspaceStore((state) => state.activePrompt);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const setDraft = useWorkspaceStore((state) => state.setDraft);
  const {
    activityMessage,
    activeAnalysisId,
    canRetry,
    changeSummary,
    correlationId,
    continueWithPartialData,
    failure,
    frontendPerformance,
    displayedInterface: generatedInterface,
    handleUIEvent,
    isHistoricalView,
    pendingNodeIds,
    performance,
    retryLastRequest,
    recoverSnapshot,
    isRecoveringSnapshot,
    runtimeDiagnostics,
    sessionTitle,
  } = useAgentSession();
  const content = statusContent[status];
  const isSettled = !isWorkspaceBusy(status);
  const isProcessing = !isSettled;
  const isPreviousResult = isProcessing || status === "error" || status === "cancelled" || status === "partial";
  const activeProcessStep = getActiveProcessStep(status);
  const hasBoundData = Object.keys(generatedInterface?.data ?? {}).length > 0;
  const guidanceOnly = status === "ready" && !failure && !errorMessage
    && isGuidanceOnly(generatedInterface?.specification, hasBoundData);
  const hasBlockingFailure = status === "error" || Boolean(failure) || Boolean(errorMessage);
  const processPaperMood = status === "retrieving_data"
    ? "pointing"
    : status === "generating_ui" || status === "updating"
      ? "presenting"
      : "thinking";
  const failureCode = failure?.code.toLowerCase() ?? "";
  const paperErrorMessage = failureCode.includes("evidence-validation") || failureCode.includes("financial-reasoning")
    ? "No encontré información suficiente para responderte con confianza. Prueba cambiando el periodo, el lugar o el grupo que quieres comparar."
    : failureCode.includes("mcp") || failureCode.includes("network") || failureCode.includes("connection")
      ? "No pude consultar la fuente en este momento. Tus preguntas siguen aquí y puedes intentarlo nuevamente."
      : "No pude completar esta consulta de forma segura. Puedes ajustar la pregunta o intentarlo de nuevo.";

  const preparePrompt = (prompt: string) => {
    setIsPaperHelpOpen(false);
    setDraft(prompt);
    onShowChat?.();
    window.requestAnimationFrame(() => document.getElementById("civic-prompt")?.focus());
  };

  const askPaperForHelp = () => {
    setIsPaperHelpOpen((open) => !open);
  };

  useEffect(() => {
    if (!isPaperHelpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPaperHelpOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isPaperHelpOpen]);

  useEffect(() => {
    if (!failure) return;
    requestAnimationFrame(() => failureRef.current?.focus({ preventScroll: true }));
  }, [failure]);

  useEffect(() => {
    const revision = generatedInterface?.revision;
    const previousRevision = previousRevisionRef.current;
    previousRevisionRef.current = revision;
    if (revision === undefined || previousRevision === undefined || revision === previousRevision) return;

    const runtime = runtimeRef.current;
    if (!runtime) return;
    const distanceFromBottom = runtime.scrollHeight - runtime.scrollTop - runtime.clientHeight;
    if (distanceFromBottom > 120) return;

    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => runtime.scrollTo({
      behavior: reducedMotion ? "auto" : "smooth",
      top: runtime.scrollHeight,
    }));
  }, [generatedInterface?.revision]);

  return (
    <section className="canvas" aria-labelledby="canvas-title" data-has-result={Boolean(generatedInterface && !guidanceOnly && !hasBlockingFailure)} data-guidance-only={guidanceOnly || undefined}>
      <header className="canvas__header">
        <div>
          <p className="canvas__eyebrow">Laboratorio de datos públicos</p>
          <h1 id="canvas-title">Explorador ciudadano</h1>
        </div>
        {status !== "empty" ? (
          <span className="canvas__status" data-status={status}>
            <span aria-hidden="true" />
            {isHistoricalView ? "Revisión anterior" : content.label}
          </span>
        ) : null}
      </header>

      <div
        ref={runtimeRef}
        className="canvas__runtime"
        data-status={status}
        aria-busy={!isSettled}
      >
        <p className="sr-only" role="status">{isHistoricalView ? "Revisión anterior de solo lectura" : isProcessing ? activityMessage : content.title}</p>
        {hasBlockingFailure ? (
          <div ref={failureRef} className="canvas-paper-error" role="alert" tabIndex={-1}>
            <div className="canvas-paper-error__character" aria-hidden="true">
              <PaperAvatar mood="surprised" size="hero" interactive={false} followPointer={false} />
            </div>
            <div className="canvas-paper-error__response">
              <PaperDialogue
                label="Paper te cuenta"
                message={paperErrorMessage}
              />
              {(failure?.canRetry ?? canRetry) ? (
                <button className="canvas-state__retry" type="button" onClick={retryLastRequest}>Intentar de nuevo</button>
              ) : null}
            </div>
          </div>
        ) : guidanceOnly ? (
          <div className="canvas-guidance">
            <p className="canvas-result__overline">Respuesta en la conversación</p>
            <h2>Construyamos una vista con evidencia pública</h2>
            <p>Esta petición no produjo un análisis visual. Puedes pedir una comparación, una distribución territorial o un cambio concreto en una interfaz existente.</p>
            <div className="canvas-guidance__actions">
              {electoralExplorationIntents.slice(0, 2).map(({ id, prompt }) => (
                <button key={id} type="button" onClick={() => preparePrompt(prompt)}>{prompt}</button>
              ))}
            </div>
          </div>
        ) : generatedInterface ? (
          <div className="canvas-result">
            <header className="canvas-result__header">
              <div>
                <p className="canvas-result__overline">Análisis activo</p>
                <h2>{isHistoricalView ? "Revisión anterior" : isPreviousResult ? "Última vista válida disponible" : "Tu exploración de datos"}</h2>
                {(activePrompt ?? sessionTitle) && !isHistoricalView ? (
                  <details className="canvas-result__query">
                    <summary>Ver petición original</summary>
                    <p>{activePrompt ?? sessionTitle}</p>
                  </details>
                ) : null}
              </div>
              <div className="canvas-result__metadata" aria-label="Estado del resultado">
                <span>Actualizado {formatUpdatedAt(generatedInterface.updatedAt)}</span>
                {hasBoundData ? <span>{isHistoricalView ? "Solo lectura" : isPreviousResult ? "Datos de la vista conservada" : "Datos actualizados"}</span> : null}
              </div>
            </header>
            {isProcessing ? (
              <div className="canvas-result__activity">
                <span className="canvas-result__activity-indicator" aria-hidden="true" />
                <div>
                  <strong>Preparando cambios</strong>
                  <p>{activityMessage}</p>
                </div>
              </div>
            ) : null}
            {failure || errorMessage || status === "partial" || status === "cancelled" ? (
              <div ref={failureRef} className="canvas-result__degradation" data-kind={status === "cancelled" ? "cancelled" : status === "partial" ? "partial" : "error"} role="alert" tabIndex={-1}>
                <div>
                  <strong>{failure?.title ?? "Resultado parcial conservado"}</strong>
                  <p>{failure?.message ?? errorMessage ?? "La consulta fue cancelada antes de completarse."}</p>
                </div>
                <div className="canvas-result__degradation-actions">
                  {failure?.canContinue ? (
                    <button className="canvas-result__degradation-secondary" type="button" onClick={continueWithPartialData}>
                      Continuar con datos parciales
                    </button>
                  ) : null}
                  {(failure?.canRetry ?? canRetry) ? <button type="button" onClick={retryLastRequest}>Reintentar</button> : null}
                  {failure?.code.includes("revision_conflict") ? (
                    <button type="button" disabled={isRecoveringSnapshot} onClick={recoverSnapshot}>
                      {isRecoveringSnapshot ? "Sincronizando…" : "Sincronizar UI y datos"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="canvas-result__surface" inert={isHistoricalView} aria-label={isHistoricalView ? "Interfaz anterior de solo lectura" : undefined}>
              <UIEventProvider key={activeAnalysisId}>
              <UIRenderer
                data={generatedInterface.data}
                degradationReason={generatedInterface.degradationReason}
                onEvent={handleUIEvent}
                pendingNodeIds={pendingNodeIds}
                specification={generatedInterface.specification}
              />
              </UIEventProvider>
            </div>
            {changeSummary && !isProcessing && !isHistoricalView ? (
              <details className="canvas-result__changes">
                <summary>Cómo se adaptó esta vista</summary>
                <ul>
                  {changeSummary.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            ) : null}
            {showRuntimeDiagnostics && (performance || runtimeDiagnostics) ? (
              <details className="canvas-performance">
                <summary>Cómo se obtuvo este resultado</summary>
                <ul className="canvas-performance__evidence">
                  <li>Solicitud interpretada por el agente</li>
                  {hasBoundData ? <li>Datos públicos consultados mediante herramientas MCP</li> : null}
                  <li>{generatedInterface.specification
                    ? "Vista renderizada validada; consulta el estado de la generación actual"
                    : "UI solicitada no disponible; se muestran datos de respaldo"}</li>
                </ul>
                <dl aria-label="Rendimiento de generación">
                  {activeAnalysisId ? <div><dt>Sesión activa</dt><dd>{activeAnalysisId}</dd></div> : null}
                  <div><dt>Revisión UI</dt><dd>{generatedInterface.revision}</dd></div>
                  {performance ? <div><dt>Agente</dt><dd>{performance.agentLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>MCP</dt><dd>{performance.mcpLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>Datos</dt><dd>{performance.dataLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>Plan UI</dt><dd>{performance.uiPlanningLatencyMs} ms</dd></div> : null}
                  {performance ? <div><dt>Primera UI</dt><dd>{performance.timeToFirstUiMs} ms</dd></div> : null}
                  {runtimeDiagnostics?.frontendTimeToFirstUsefulUiMs === undefined && performance ? (
                    <div><dt>Primera UI útil</dt><dd>{performance.timeToFirstUsefulUiMs} ms</dd></div>
                  ) : null}
                  {runtimeDiagnostics?.frontendTimeToFirstUsefulUiMs === undefined ? null : (
                    <div><dt>Primera UI útil real</dt><dd>{runtimeDiagnostics.frontendTimeToFirstUsefulUiMs} ms</dd></div>
                  )}
                  {performance?.frontendRenderLatencyMs === undefined ? null : (
                    <div><dt>Render</dt><dd>{performance.frontendRenderLatencyMs} ms</dd></div>
                  )}
                  {performance ? <div><dt>Total</dt><dd>{performance.totalGenerationMs} ms</dd></div> : null}
                  {runtimeDiagnostics?.milestones.firstEventAt === undefined ? null : (
                    <div><dt>Primer evento</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.promptSubmittedAt, runtimeDiagnostics.milestones.firstEventAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstMcpResultAt === undefined ? null : (
                    <div><dt>Primeros datos</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.promptSubmittedAt, runtimeDiagnostics.milestones.firstMcpResultAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.agentStartedAt === undefined ? null : (
                    <div><dt>Inicio agente</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.agentStartedAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstMcpRequestAt === undefined ? null : (
                    <div><dt>Primera petición MCP</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.firstMcpRequestAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstMcpResultAt === undefined ? null : (
                    <div><dt>Primer resultado MCP</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.firstMcpResultAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.uiGenerationStartedAt === undefined ? null : (
                    <div><dt>Inicio generación UI</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.uiGenerationStartedAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.firstUiNodeAt === undefined ? null : (
                    <div><dt>Primer nodo UI</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.firstUiNodeAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics?.milestones.uiCompletedAt === undefined ? null : (
                    <div><dt>UI completada</dt><dd>{elapsedMilliseconds(runtimeDiagnostics.milestones.requestReceivedAt, runtimeDiagnostics.milestones.uiCompletedAt)} ms</dd></div>
                  )}
                  {runtimeDiagnostics ? <div><dt>Contexto estimado</dt><dd>≈{runtimeDiagnostics.estimatedInputTokens} tokens</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Salida estimada</dt><dd>≈{runtimeDiagnostics.estimatedOutputTokens} tokens</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Request</dt><dd>{formatPayloadSize(runtimeDiagnostics.requestBytes)}</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Stream</dt><dd>{formatPayloadSize(runtimeDiagnostics.streamedPayloadBytes)}</dd></div> : null}
                  {runtimeDiagnostics ? <div><dt>Eventos / patches</dt><dd>{runtimeDiagnostics.eventCount} / {runtimeDiagnostics.uiPatchCount}</dd></div> : null}
                  {frontendPerformance ? <div><dt>Renders frontend</dt><dd>{frontendPerformance.renderCount}</dd></div> : null}
                  {frontendPerformance?.firstFeedbackPaintMs === undefined ? null : <div><dt>Primer feedback pintado</dt><dd>{frontendPerformance.firstFeedbackPaintMs} ms</dd></div>}
                  {frontendPerformance?.patchApplyP50Ms === undefined ? null : <div><dt>Aplicar patch p50</dt><dd>{frontendPerformance.patchApplyP50Ms} ms</dd></div>}
                  {frontendPerformance?.patchApplyP95Ms === undefined ? null : <div><dt>Aplicar patch p95</dt><dd>{frontendPerformance.patchApplyP95Ms} ms</dd></div>}
                  {frontendPerformance?.patchToPaintP50Ms === undefined ? null : <div><dt>Patch a pintura p50</dt><dd>{frontendPerformance.patchToPaintP50Ms} ms</dd></div>}
                  {frontendPerformance?.patchToPaintP95Ms === undefined ? null : <div><dt>Patch a pintura p95</dt><dd>{frontendPerformance.patchToPaintP95Ms} ms</dd></div>}
                  {performance ? <div><dt>Traza</dt><dd title={performance.correlationId}>{performance.correlationId.slice(0, 8)}</dd></div> : null}
                </dl>
              </details>
            ) : showRuntimeDiagnostics && correlationId ? <p className="canvas-trace" title={correlationId}>Traza {correlationId.slice(0, 8)}</p> : null}
          </div>
        ) : isProcessing ? (
          <div className="canvas-process" data-step={activeProcessStep}>
            <div className="canvas-process__copy" key={status}>
              <p>{activePrompt}</p>
              <h2>{paperStatusVoices[status]?.title ?? content.title}</h2>
              <span>{paperStatusVoices[status]?.detail ?? activityMessage}</span>
            </div>
            <div className="canvas-process__paper" aria-hidden="true">
              <PaperAvatar mood={processPaperMood} size="hero" interactive={false} followPointer={false} />
            </div>
            <div className="canvas-process__progress">
              <div
                className="canvas-process__progress-track"
                role="progressbar"
                aria-label="Progreso de la consulta"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={processProgress[activeProcessStep]}
              >
                <span />
              </div>
              <ol className="canvas-process__steps" aria-label="Etapas de la consulta">
                {processSteps.map((step, index) => (
                  <li key={step} data-state={index === activeProcessStep ? "active" : index < activeProcessStep ? "complete" : "pending"}>
                    <span aria-hidden="true" />
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="canvas-state" data-settled={status !== "empty"}>
            {status === "empty" ? (
              <div className="canvas-welcome">
                <div className="canvas-welcome__paper">
                  <PaperAvatar mood="presenting" size="hero" interactive={false} followPointer={false} />
                  <PaperDialogue
                    label="Paper · Tu guía"
                    message="Dime qué quieres entender. Yo convierto tu pregunta en una vista hecha para explorarla."
                  />
                </div>
                <ElectoralExplorationStart onSelect={preparePrompt} />
              </div>
            ) : (
              <div className="canvas-state__copy">
                <div className="canvas-state__label">
                  Interfaz generativa
                </div>
                {activePrompt ? <p className="canvas-state__prompt">{activePrompt}</p> : null}
                <h2>{failure?.title ?? content.title}</h2>
                <p>{failure?.message ?? errorMessage ?? content.detail}</p>
                {(failure?.canRetry ?? canRetry) ? (
                  <button className="canvas-state__retry" type="button" onClick={retryLastRequest}>Reintentar</button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
      {status !== "empty" && !isProcessing && !hasBlockingFailure ? (
        <>
          {isPaperHelpOpen ? (
            <aside id="paper-context-help" className="canvas-paper-help-panel" role="dialog" aria-label="Ayuda de Paper">
              <div className="canvas-paper-help-panel__header">
                <div>
                  <span>Paper te ayuda</span>
                  <strong>¿Qué quieres descubrir?</strong>
                </div>
                <button type="button" onClick={() => setIsPaperHelpOpen(false)} aria-label="Cerrar ayuda">×</button>
              </div>
              <p>Elige un punto de partida. Puedes editar la pregunta antes de enviarla.</p>
              <div className="canvas-paper-help-panel__actions">
                {electoralExplorationIntents.map(({ id, title, prompt }) => (
                  <button key={id} type="button" onClick={() => preparePrompt(prompt)}>{title}</button>
                ))}
              </div>
            </aside>
          ) : null}
          <button
            className="canvas-paper-help"
            type="button"
            onClick={askPaperForHelp}
            aria-label={isPaperHelpOpen ? "Cerrar ayuda de Paper" : "Pedir ayuda a Paper"}
            aria-controls="paper-context-help"
            aria-expanded={isPaperHelpOpen}
          >
            <span className="canvas-paper-help__portrait" aria-hidden="true">
              <PaperAvatar mood={isProcessing ? "thinking" : "idle"} size="md" interactive={false} followPointer={false} />
            </span>
            <span className="canvas-paper-help__badge" aria-hidden="true">?</span>
          </button>
        </>
      ) : null}
    </section>
  );
}
