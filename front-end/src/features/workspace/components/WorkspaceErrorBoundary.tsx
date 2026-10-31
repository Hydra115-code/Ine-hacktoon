"use client";

import { Component, createRef, type ReactNode } from "react";

interface WorkspaceErrorBoundaryProps {
  children: ReactNode;
}

interface WorkspaceErrorBoundaryState {
  hasError: boolean;
}

export class WorkspaceErrorBoundary extends Component<WorkspaceErrorBoundaryProps, WorkspaceErrorBoundaryState> {
  state: WorkspaceErrorBoundaryState = { hasError: false };
  private readonly errorRef = createRef<HTMLElement>();

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(_: WorkspaceErrorBoundaryProps, previousState: WorkspaceErrorBoundaryState) {
    if (!previousState.hasError && this.state.hasError) {
      window.requestAnimationFrame(() => this.errorRef.current?.focus());
    }
  }

  retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main ref={this.errorRef} className="workspace-failure" role="alert" aria-atomic="true" tabIndex={-1}>
          <div className="workspace-failure__mark" aria-hidden="true">!</div>
          <p className="canvas__eyebrow">Explorador ciudadano</p>
          <h1>Paper tuvo un problema al mostrar la página</h1>
          <p>Tu consulta sigue guardada. Intenta abrirla nuevamente.</p>
          <button type="button" onClick={this.retry}>Intentar de nuevo</button>
        </main>
      );
    }

    return this.props.children;
  }
}
