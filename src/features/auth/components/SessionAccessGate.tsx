"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { clearSessionArchive } from "@/features/agent/session/session-snapshot-storage";
import { resetWorkspaceStore } from "@/features/workspace/state/workspace-store";

type AccessState =
  | { kind: "checking" }
  | { kind: "authenticated"; ownerKey: string }
  | { kind: "sign-in" };

interface SessionStatus {
  authenticated: boolean;
  demoAvailable: boolean;
  ownerKey?: string;
}

function isSessionStatus(value: unknown): value is SessionStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Record<string, unknown>;
  return typeof status.authenticated === "boolean"
    && typeof status.demoAvailable === "boolean"
    && (!status.authenticated || (typeof status.ownerKey === "string" && /^[a-f0-9]{64}$/u.test(status.ownerKey)));
}

function createLocalOwnerKey() {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function SessionAccessGate({ children }: {
  children: (session: { ownerKey: string; signOut: () => Promise<void> }) => ReactNode;
}) {
  const [state, setState] = useState<AccessState>({ kind: "checking" });
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const currentOwner = useRef<string | undefined>(undefined);

  const checkSession = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible comprobar la sesión");
      const body: unknown = await response.json();
      if (!isSessionStatus(body)) throw new Error("Respuesta de sesión inválida");
      if (sequence !== requestSequence.current) return;
      setDemoAvailable(body.demoAvailable);
      if (body.authenticated && body.ownerKey) {
        if (currentOwner.current && currentOwner.current !== body.ownerKey) {
          clearSessionArchive(window.sessionStorage);
          resetWorkspaceStore();
        }
        currentOwner.current = body.ownerKey;
        setState({ kind: "authenticated", ownerKey: body.ownerKey });
      } else {
        setState({ kind: "sign-in" });
      }
    } catch {
      if (sequence !== requestSequence.current) return;
      const ownerKey = createLocalOwnerKey();
      currentOwner.current = ownerKey;
      setState({ kind: "authenticated", ownerKey });
    }
  }, []);

  useEffect(() => {
    void checkSession();
    const onFocus = () => { void checkSession(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    const onAuthenticationRequired = () => {
      requestSequence.current += 1;
      setState({ kind: "sign-in" });
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("ine:authentication-required", onAuthenticationRequired);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      requestSequence.current += 1;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("ine:authentication-required", onAuthenticationRequired);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkSession]);

  const confirmAccess = async () => {
    setBusy(true);
    try {
      if (demoAvailable) {
        const response = await fetch("/api/auth/demo", { method: "POST" });
        if (!response.ok) throw new Error("La sesión demo no está disponible en este momento.");
        await checkSession();
        return;
      }

      const ownerKey = createLocalOwnerKey();
      currentOwner.current = ownerKey;
      setState({ kind: "authenticated", ownerKey });
    } catch {
      const ownerKey = createLocalOwnerKey();
      currentOwner.current = ownerKey;
      setState({ kind: "authenticated", ownerKey });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (state.kind === "sign-in" && !busy) void confirmAccess();
  }, [state.kind, busy]);

  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("logout_failed");
      requestSequence.current += 1;
      currentOwner.current = undefined;
      clearSessionArchive(window.sessionStorage);
      resetWorkspaceStore();
      setState({ kind: "sign-in" });
    } catch {
      setState({ kind: "sign-in" });
    }
  };

  if (state.kind === "authenticated") {
    return children({ ownerKey: state.ownerKey, signOut });
  }

  return null;
}
