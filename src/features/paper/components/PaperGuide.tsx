"use client";

import type { PaperGuidePresentation, PaperState } from "../types/paper-state";
import { usePaperGuide } from "../state/use-paper-guide";
import { PaperAvatar } from "./PaperAvatar";
import { PaperMessage } from "./PaperMessage";

interface PaperGuideProps {
  className?: string;
  context?: string;
  overrideState?: PaperState;
  presentation?: PaperGuidePresentation;
  size?: "sm" | "md" | "lg" | "hero";
  announce?: boolean;
}

export function PaperGuide({
  className = "",
  context,
  overrideState,
  presentation,
  size = "md",
  announce = true,
}: PaperGuideProps) {
  const workspacePresentation = usePaperGuide({ overrideState });
  const activePresentation = presentation ?? workspacePresentation;

  return (
    <section className={`paper-guide ${className}`.trim()} data-paper-state={activePresentation.state}>
      <div className="paper-guide__avatar" aria-hidden="true">
        <PaperAvatar mood={activePresentation.mood} size={size} interactive={false} followPointer={false} />
      </div>
      <div className="paper-guide__content">
        {context ? <p className="paper-guide__context">{context}</p> : null}
        <PaperMessage announce={announce} presentation={activePresentation} />
      </div>
    </section>
  );
}
