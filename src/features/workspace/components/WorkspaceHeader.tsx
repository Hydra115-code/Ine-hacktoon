"use client";

import { useWorkspaceStore } from "../state/workspace-store";
import { ThemeToggle } from "@/shared/design-system/components/ThemeToggle";
import { AccessibilityCenter } from "@/shared/design-system/components/AccessibilityCenter";
import { useAgentSession } from "../../agent/components/AgentSessionProvider";
import { CivicBrand } from "./CivicBrand";

import Link from "next/link";

export function WorkspaceHeader({ onSignOut }: { onSignOut?: () => Promise<void> }) {
  const status = useWorkspaceStore((state) => state.experience.status);
  const reset = useWorkspaceStore((state) => state.reset);
  const { startNewSession } = useAgentSession();
  const hasStarted = status !== "empty";

  return (
    <header className="workspace-header" aria-label="Cabecera del explorador ciudadano">
      <div className="workspace-header__identity">
        <Link href="/" className="workspace-header__brand-link" aria-label="Ir al inicio de INE Explora">
          <CivicBrand />
        </Link>
        <span className="workspace-header__divider" aria-hidden="true" />
        <span className="workspace-header__product">Conversar con Paper</span>
      </div>
      <div className="workspace-header__session">
        <Link href="/" className="session-reset workspace-header__home">
          ← Inicio
        </Link>
        <AccessibilityCenter />
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
