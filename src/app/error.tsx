"use client";

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="workspace-failure">
      <div className="workspace-failure__mark" aria-hidden="true">!</div>
      <p className="canvas__eyebrow">Paper conserva tu consulta</p>
      <h1>No pude abrir esta página</h1>
      <p>Inténtalo de nuevo. Si el problema continúa, vuelve al inicio y abre una consulta nueva.</p>
      <button type="button" onClick={reset}>Reintentar</button>
    </main>
  );
}
