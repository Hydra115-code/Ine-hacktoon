"use client";

import { useWorkspaceStore } from "../state/workspace-store";
import { ThemeToggle } from "@/shared/design-system/components/ThemeToggle";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";
import { CivicBrand } from "./CivicBrand";

export function WorkspaceHeader({ onSignOut }: { onSignOut?: () => Promise<void> }) {
  const status = useWorkspaceStore((state) => state.experience.status);
  const reset = useWorkspaceStore((state) => state.reset);
  const { startNewSession } = useAgentSession();
  const hasStarted = status !== "empty";

  return (
    <header className="workspace-header">
      <div className="workspace-header__identity">
        <CivicBrand />
        <span className="workspace-header__divider" aria-hidden="true" />
        <span className="workspace-header__product">Explorador ciudadano</span>
        <span className="workspace-header__edition">Prototipo Hackathon 2026</span>
      </div>

      <div className="workspace-header__session">
        <span className="session-status">
          <span className="session-status__dot" aria-hidden="true" />
          Sesión segura
        </span>
        <ThemeToggle />
        {hasStarted ? (
          <button className="session-reset" type="button" onClick={() => {
            startNewSession();
            reset();
          }}>
            Nueva consulta
          </button>
        ) : null}
        {onSignOut ? <button className="session-reset" type="button" onClick={() => void onSignOut()}>Salir</button> : null}
      </div>
    </header>
  );
}
