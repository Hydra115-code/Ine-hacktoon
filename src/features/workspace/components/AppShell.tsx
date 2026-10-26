"use client";

import { GenerativeCanvas } from "./GenerativeCanvas";
import { ConversationPanel } from "./ConversationPanel";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { AgentSessionProvider } from "../../agent/components/AgentSessionProvider";
import { SystemStatusBar } from "../../system-status/components/SystemStatusBar";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";
import { AnalysisHistory } from "./AnalysisHistory";
import { shouldExposeRuntimeDiagnostics } from "../../../shared/security/runtime-diagnostics-visibility";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const PUBLIC_WORKSPACE_OWNER_KEY = "0000000000000000000000000000000000000000000000000000000000000000";
const SIDEBAR_MIN_PX = 320;
const SIDEBAR_MAX_PX = 576;
const SIDEBAR_KEYBOARD_STEP_PX = 24;

interface AppShellProps {
  diagnostics?: ReactNode;
  showDeveloperDiagnostics?: boolean;
}

export function AppShell({ diagnostics, showDeveloperDiagnostics = false }: AppShellProps = {}) {
  const diagnosticsEnabled = shouldExposeRuntimeDiagnostics(process.env.NODE_ENV, showDeveloperDiagnostics);
  const [mobilePane, setMobilePane] = useState<"conversation" | "result">("result");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>();
  const workspaceMainRef = useRef<HTMLDivElement>(null);
  const sidebarResizingRef = useRef(false);

  const sidebarBounds = useCallback(() => {
    const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
    const mainWidth = workspaceMainRef.current?.getBoundingClientRect().width ?? viewportWidth;
    const rootFontSize = typeof document === "undefined"
      ? 16
      : Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const minimum = Math.max(SIDEBAR_MIN_PX, rootFontSize * 20);
    const maximum = Math.max(minimum, Math.min(SIDEBAR_MAX_PX, mainWidth * 0.46));
    return { minimum, maximum };
  }, []);

  const resizeSidebar = useCallback((requestedWidth: number) => {
    const { minimum, maximum } = sidebarBounds();
    setSidebarWidth(Math.round(Math.min(maximum, Math.max(minimum, requestedWidth))));
  }, [sidebarBounds]);

  useEffect(() => {
    const main = workspaceMainRef.current;
    const conversation = main?.querySelector<HTMLElement>(".workspace__pane--conversation");
    if (!main || !conversation) return;

    const keepWidthInBounds = () => {
      const measured = sidebarWidth ?? conversation.getBoundingClientRect().width;
      resizeSidebar(measured);
    };
    keepWidthInBounds();
    const observer = new ResizeObserver(keepWidthInBounds);
    observer.observe(main);
    return () => observer.disconnect();
  }, [resizeSidebar, sidebarWidth]);

  const finishSidebarResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!sidebarResizingRef.current) return;
    sidebarResizingRef.current = false;
    setIsSidebarResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleSidebarResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const { minimum, maximum } = sidebarBounds();
    const current = sidebarWidth ?? workspaceMainRef.current?.querySelector<HTMLElement>(".workspace__pane--conversation")?.getBoundingClientRect().width ?? minimum;
    if (event.key === "Home") resizeSidebar(minimum);
    else if (event.key === "End") resizeSidebar(maximum);
    else resizeSidebar(current + (event.key === "ArrowRight" ? SIDEBAR_KEYBOARD_STEP_PX : -SIDEBAR_KEYBOARD_STEP_PX));
  }, [resizeSidebar, sidebarBounds, sidebarWidth]);

  const showConversation = () => {
    setIsSidebarCollapsed(false);
    setMobilePane("conversation");
  };

  return (
    <WorkspaceErrorBoundary>
      <AgentSessionProvider ownerKey={PUBLIC_WORKSPACE_OWNER_KEY}>
        {diagnostics}
        <a className="skip-link" href="#workspace-content">Saltar al área de trabajo</a>
        <main className="workspace" data-developer-diagnostics={diagnosticsEnabled || undefined}>
          <WorkspaceHeader />
          {diagnosticsEnabled ? <SystemStatusBar /> : null}
          <div className="workspace__body" id="workspace-content" tabIndex={-1}>
            <div className="workspace__tabs" role="tablist" aria-label="Área de trabajo" aria-orientation="horizontal" onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "conversation" : event.key === "End" ? "result" : mobilePane === "conversation" ? "result" : "conversation";
              setMobilePane(next);
              document.getElementById(`${next}-tab`)?.focus();
            }}>
              <button type="button" role="tab" id="conversation-tab" aria-controls="conversation-pane" aria-selected={mobilePane === "conversation"} tabIndex={mobilePane === "conversation" ? 0 : -1} onClick={() => setMobilePane("conversation")}>Conversación</button>
              <button type="button" role="tab" id="result-tab" aria-controls="result-pane" aria-selected={mobilePane === "result"} tabIndex={mobilePane === "result" ? 0 : -1} onClick={() => setMobilePane("result")}>Vista generada</button>
            </div>
            <div
              className="workspace__main"
              data-mobile-pane={mobilePane}
              data-sidebar-collapsed={isSidebarCollapsed}
              data-sidebar-resizing={isSidebarResizing || undefined}
              ref={workspaceMainRef}
              style={sidebarWidth === undefined ? undefined : { "--workspace-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
            >
              <div
                aria-label="Ajustar ancho de la conversación"
                aria-orientation="vertical"
                aria-valuemax={Math.round(sidebarBounds().maximum)}
                aria-valuemin={Math.round(sidebarBounds().minimum)}
                aria-valuenow={Math.round(sidebarWidth ?? SIDEBAR_MIN_PX)}
                className="workspace__sidebar-resizer"
                data-collapsed={isSidebarCollapsed || undefined}
                onDoubleClick={() => resizeSidebar((workspaceMainRef.current?.getBoundingClientRect().width ?? window.innerWidth) * 0.23)}
                onKeyDown={handleSidebarResizeKeyDown}
                onLostPointerCapture={finishSidebarResize}
                onPointerCancel={finishSidebarResize}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  sidebarResizingRef.current = true;
                  setIsSidebarResizing(true);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (!sidebarResizingRef.current) return;
                  const mainLeft = workspaceMainRef.current?.getBoundingClientRect().left ?? 0;
                  resizeSidebar(event.clientX - mainLeft);
                }}
                onPointerUp={finishSidebarResize}
                role="separator"
                tabIndex={isSidebarCollapsed ? -1 : 0}
                title="Arrastra o usa las flechas para ajustar el ancho de la conversación"
              />
              <button
                aria-controls="conversation-pane"
                aria-expanded={!isSidebarCollapsed}
                aria-label={isSidebarCollapsed ? "Mostrar conversación" : "Ocultar conversación"}
                className="workspace__sidebar-toggle"
                data-collapsed={isSidebarCollapsed || undefined}
                onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
                title={isSidebarCollapsed ? "Mostrar conversación" : "Ocultar conversación"}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d={isSidebarCollapsed ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} />
                </svg>
              </button>
              <div
                aria-hidden={isSidebarCollapsed || undefined}
                className="workspace__pane workspace__pane--conversation"
                id="conversation-pane"
                inert={isSidebarCollapsed || undefined}
                role="tabpanel"
                aria-labelledby="conversation-tab"
                tabIndex={isSidebarCollapsed ? -1 : 0}
              >
                <AnalysisHistory />
                <ConversationPanel onShowResult={() => setMobilePane("result")} />
              </div>
              <div className="workspace__pane workspace__pane--result" id="result-pane" role="tabpanel" aria-labelledby="result-tab" tabIndex={0}>
                <GenerativeCanvas showRuntimeDiagnostics={diagnosticsEnabled} onShowChat={showConversation} />
              </div>
            </div>
          </div>
        </main>
      </AgentSessionProvider>
    </WorkspaceErrorBoundary>
  );
}
