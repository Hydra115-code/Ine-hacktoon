"use client";

import { useEffect, useRef } from "react";

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const errorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    errorRef.current?.focus();
  }, []);

  return (
    <main ref={errorRef} className="workspace-failure" role="alert" aria-atomic="true" tabIndex={-1}>
      <div className="workspace-failure__mark" aria-hidden="true">!</div>
      <p className="canvas__eyebrow">Paper conserva tu consulta</p>
      <h1>No pude abrir esta página</h1>
      <p>Inténtalo de nuevo. Si el problema continúa, vuelve al inicio y abre una consulta nueva.</p>
      <button type="button" onClick={reset}>Reintentar</button>
    </main>
  );
}
